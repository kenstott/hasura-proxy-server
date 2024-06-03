import { getHasuraSchema } from './get-hasura-schema'
import { mergeSchemas } from '@graphql-tools/schema'
import { createHasuraProxyPlugin } from './create-hasura-proxy-plugin.js'
import { type GraphQLSchema, type HasuraContext, type HasuraPlugin } from '../common/index.js'
import { startActiveTrace } from './telemetry'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import type * as http from 'http'
import { ApolloServer, type ApolloServerPlugin } from '@apollo/server'
import assert from 'assert'
import _ from 'lodash'

interface HasuraWrapperOptions {
  uri: URL
  adminSecret: string
  hasuraPlugins: HasuraPlugin[]
  httpServer?: http.Server
}

interface HasuraReloadOptions {
  uri: URL
  adminSecret: string
  hasuraPlugins: HasuraPlugin[]
  server: ApolloServer<HasuraContext>
}

/**
 * @description Generates the local executable schema from the remote Hasura schema and the local Hasura plugin-builder.
 * @param uri
 * @param adminSecret
 * @param hasuraPlugins
 * @param httpServer
 * @returns {{schema: GraphQLSchema, plugin-builder: ApolloServerPlugin[]}}
 */
export const hasuraWrapper = async ({ uri, adminSecret, hasuraPlugins, httpServer }: HasuraWrapperOptions): Promise<{
  schema: GraphQLSchema
  plugins: ApolloServerPlugin[]
}> => {
  assert(httpServer)
  return await startActiveTrace(import.meta.url, async (span) => {
    const schema = await createSchema({ uri, adminSecret, hasuraPlugins, httpServer })
    const hasuraProxyPlugin = await createHasuraProxyPlugin(hasuraPlugins.map(i => i.operationDirective ?? '').filter(Boolean), uri.toString())
    const plugins = [
      ApolloServerPluginDrainHttpServer({ httpServer }),
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

export const createSchema = async ({ uri, adminSecret, hasuraPlugins }: HasuraWrapperOptions): Promise<GraphQLSchema> => {
  const typeDefs = hasuraPlugins.map(i => `
    ${i.operationDirectiveHelp ? '"""' + i.operationDirectiveHelp + '"""' : ''}
    ${i.operationDirective ? 'directive ' + i.operationDirective.replace(/\n/g, ' ') + ' on QUERY' : ''}
    ${i.additionalSDL ?? ''}
    `).join('\n')

  const hasuraSchema = await getHasuraSchema(
    adminSecret,
    uri.toString()
  )
  return mergeSchemas({
    schemas: [hasuraSchema],
    typeDefs: [typeDefs]
  })
}

export const reloadSchema = async ({ uri, adminSecret, hasuraPlugins, server }: HasuraReloadOptions): Promise<void> => {
  const schema = await createSchema({ uri, adminSecret, hasuraPlugins })
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const schemaDerivedData = await ApolloServer.generateSchemaDerivedData(schema)
  _.set(server, 'internals.state.schemaManager.schemaDerivedData', schemaDerivedData)
}
