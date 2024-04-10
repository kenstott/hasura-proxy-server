import { getHasuraSchema } from './get-hasura-schema'
import { mergeSchemas } from '@graphql-tools/schema'
import { type ApolloServerPlugin } from '@apollo/server'
import { createHasuraProxyPlugin } from './create-hasura-proxy-plugin'
import { type GraphQLSchema, type HasuraPlugin } from '../common/index.js'
import { startActiveTrace } from './telemetry'

interface HasuraWrapperOptions {
  uri: URL
  adminSecret: string
  hasuraPlugins: HasuraPlugin[]
}

/**
 * @description Generates the local executable schema from the remote Hasura schema and the local Hasura plugin-builder.
 * @param uri
 * @param adminSecret
 * @param hasuraPlugins
 * @returns {{schema: GraphQLSchema, plugin-builder: ApolloServerPlugin[]}}
 */
export const hasuraWrapper = async ({
  uri,
  adminSecret,
  hasuraPlugins
}: HasuraWrapperOptions): Promise<{
  schema: GraphQLSchema
  plugins: ApolloServerPlugin[]
}> => {
  return startActiveTrace(import.meta.url, async (span) => {
    const typeDefs = hasuraPlugins.map(i => `
    ${i.operationDirectiveHelp ? '"""' + i.operationDirectiveHelp + '"""' : ''}
    ${i.operationDirective ? 'directive ' + i.operationDirective.replace(/\n/g, ' ') + ' on QUERY' : ''}
    ${i.additionalSDL ?? ''}
    `).join('\n')

    const hasuraSchema = await getHasuraSchema(
      adminSecret,
      uri.toString()
    )

    const schema = mergeSchemas({
      schemas: [hasuraSchema],
      typeDefs: [typeDefs]
    })
    const hasuraProxyPlugin = await createHasuraProxyPlugin(hasuraPlugins.map(i => i.operationDirective ?? '').filter(Boolean), uri.toString())
    const plugins = [
      hasuraProxyPlugin,
      ...hasuraPlugins]
    const loadedPlugins = hasuraPlugins.map(i => i.operationDirective)
    if (span) {
      span.setAttributes({ loadedPlugins })
    }
    return {
      schema,
      plugins
    }
  })
}
