import gql from 'graphql-tag'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { type GraphQLSchema } from '../common/index.js'
import { startActiveTrace } from './telemetry'
import { buildClientSchema, getIntrospectionQuery, type IntrospectionQuery } from 'graphql'

const introspectionQuery = {
  operationName: 'SDLQuery',
  query: getIntrospectionQuery().replace('IntrospectionQuery', 'SDLQuery')
}

interface SdlResponse {
  data: { __schema: never }
}

/**
 * @description Retrieves the SDL from a remote Hasura GraphQL Engine. It is required that HGE as the
 * Apollo Federated implemented.
 * @param adminSecret {string}
 * @param uri {string}
 */
export const getHasuraSchema = async (adminSecret: string, uri: string): Promise<GraphQLSchema> => {
  return await startActiveTrace(import.meta.url, async () => {
    const response = await fetch(uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hasura-Admin-Secret': adminSecret,
        hasura_cloud_pat: adminSecret,
        'X-Hasura-Role': process.env.HASURA_ADMIN_ROLE || ''
      },
      body: JSON.stringify(introspectionQuery)
    })
    const text = await response.text()
    const data = JSON.parse(text) as { data: IntrospectionQuery }
    return buildClientSchema(data.data)
  })
}
