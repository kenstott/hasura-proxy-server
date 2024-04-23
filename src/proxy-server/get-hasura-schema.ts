import gql from 'graphql-tag'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { type GraphQLSchema } from '../common/index.js'
import { startActiveTrace } from './telemetry'

const introspectionQuery = {
  operationName: 'SDLQuery',
  query: `
    query SDLQuery {
        _service {
         sdl
        }
      }
  `
}

interface SdlResponse {
  data: { _service: { sdl: string } }
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
      headers: { 'X-Hasura-Admin-Secret': adminSecret },
      body: JSON.stringify(introspectionQuery)
    })
    const { data: { _service: { sdl } } } = await response.json() as SdlResponse
    return makeExecutableSchema({ typeDefs: gql(sdl) })
  })
}
