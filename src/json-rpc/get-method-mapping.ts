import type { Express } from 'express'
import type { FormattedExecutionResult } from 'graphql'
import { internalProxyGraphQLQuery } from '../common/index.js'
import { type JsonRPC } from '../service-definition'

type Method = (...args: never[]) => Promise<FormattedExecutionResult>

/**
 * Retrieves the method mapping for the given Express app and methods.
 *
 * @param {Express} app - The Express app instance.
 * @param {Array<Record<string, any>>} methods - The array of method definitions.
 * @returns {Record<string, (args: never[]) => Promise<FormattedExecutionResult>>} - The method mapping object.
 */
export function getMethodMapping (app: Express, methods: JsonRPC[]): Record<string, Method> {
  return {
    query: async (...args: never[]): Promise<FormattedExecutionResult> => {
      const [operationName, query, variables, auth] = args
      const headers = { ...auth as Record<string, never>, 'json-rpc': true }
      return await new Promise<FormattedExecutionResult>((resolve, _reject) => {
        internalProxyGraphQLQuery(app)({
          operationName,
          query,
          variables,
          headers,
          callback: (_, result) => {
            resolve(result as never)
          }
        })
      })
    },
    ...methods.reduce<Record<string, Method>>((acc, remoteProcedureCall) => {
      return {
        ...acc,
        [remoteProcedureCall.name]: async (...args: never[]): Promise<FormattedExecutionResult> => {
          const variables = remoteProcedureCall.params?.reduce((acc, i, index: number) => {
            if (args[index] && i.name !== 'auth') {
              return { ...acc, [i.name]: args[index] }
            }
            return acc
          }, {} satisfies Record<string, never>) || {}
          const headers = { ...(args[0] as Record<string, never>), 'json-rpc': true }
          return await new Promise<FormattedExecutionResult>((resolve, _reject) => {
            internalProxyGraphQLQuery(app)({
              operationName: remoteProcedureCall.name.split(process.env.JSON_RPC_PATH_SEPARATOR || '__').slice(-1)[0],
              query: remoteProcedureCall.description || '',
              variables,
              headers,
              callback: (_, result) => {
                resolve(result as never)
              }
            })
          })
        }
      }
    }, {})
  }
}
