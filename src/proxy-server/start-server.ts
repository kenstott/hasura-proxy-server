import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'
import { hasuraWrapper } from './hasura-wrapper.js'
import assert from 'assert'
import { hasuraContext } from './hasura-context.js'
import { HASURA_ADMIN_SECRET, HASURA_URI, PORT } from './config.js'
import { type HasuraContext, type HasuraPlugin } from '../common/index.js'
import { startActiveTrace } from './telemetry.js'

/**
 * @description Abstracts away all details of instantiating the Apollo Server as a Hasura Proxy.
 * @param hasuraPlugins {HasuraPlugin[]} A collection of Hasura Plugins you want to apply to the results of data
 * retrieved from the call the HGE.
 */
export const startServer = async (hasuraPlugins: HasuraPlugin[]): Promise<void> => {
  startActiveTrace(import.meta.url, async (span) => {
    assert(HASURA_URI, 'Valid Hasura URI graphql endpoint is required.')
    assert(HASURA_ADMIN_SECRET, 'Valid Hasura Admin Secret is required.')
    assert(PORT, 'Valid PORT # is required.')

    span?.setAttributes({
      HASURA_URI,
      PORT,
      pluginCount: hasuraPlugins.length
    })

    const server = new ApolloServer<HasuraContext>({
      ...await hasuraWrapper({
        uri: new URL(HASURA_URI),
        adminSecret: HASURA_ADMIN_SECRET,
        hasuraPlugins
      })
    })

    const { url } = await startStandaloneServer<HasuraContext>(server, {
      context: hasuraContext,
      listen: { port: parseInt(PORT) }
    })

    console.log(`🚀  Server ready at: ${url}`)
  })
}
