import { ApolloServer } from '@apollo/server'
import express from 'express'
import { expressMiddleware } from '@apollo/server/express4'
import { hasuraWrapper } from './hasura-wrapper.js'
import assert from 'assert'
import { hasuraContext } from './hasura-context.js'
import { HASURA_ADMIN_SECRET, HASURA_URI, PORT } from './config.js'
import { type HasuraContext, type HasuraPlugin } from '../common/index.js'
import { startActiveTrace } from './telemetry.js'
import { FileFormat } from '../plugins/file-plugin/output-file.js'

/**
 * @description Abstracts away all details of instantiating the Apollo Server as a Hasura Proxy.
 * @param hasuraPlugins {HasuraPlugin[]} A collection of Hasura Plugins you want to apply to the results of data
 * retrieved from the call the HGE.
 */
export const startServer = async (hasuraPlugins: HasuraPlugin[]): Promise<void> => {
  await startActiveTrace(import.meta.url, async (span) => {
    assert(HASURA_URI, 'Valid Hasura URI graphql endpoint is required.')
    assert(HASURA_ADMIN_SECRET, 'Valid Hasura Admin Secret is required.')
    assert(PORT, 'Valid PORT # is required.')

    span?.setAttributes({
      HASURA_URI,
      PORT,
      pluginCount: hasuraPlugins.length
    })

    const app = express()
    const server = new ApolloServer<HasuraContext>({
      ...await hasuraWrapper({
        uri: new URL(HASURA_URI),
        adminSecret: HASURA_ADMIN_SECRET,
        hasuraPlugins
      })
    })
    await server.start()

    app.get('/', (req, res, next) => {
      if (req.url === '/') {
        res.redirect('/graphql')
      }
    })
    app.post('/gql/:file', express.json(), (req, res, next) => {
      const formatString = req.params.file.toLowerCase()
      const format: FileFormat = FileFormat[formatString as keyof typeof FileFormat]
      if (format) {
        process.env.TEMP_AUTO_DIRECTIVES = `@file(format: ${format}, output: BASE64)`
      }
      expressMiddleware(server, {
        context: hasuraContext
      })(req, res, next)
    })
    app.use('/graphql', express.json(), expressMiddleware(server, {
      context: hasuraContext
    }))

    const port = parseInt(PORT ?? '4000')
    app.listen(port, () => {
      console.log(`🚀 Server listening on port ${port}`)
    })
  })
}
