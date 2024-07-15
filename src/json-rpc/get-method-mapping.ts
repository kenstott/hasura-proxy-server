import type { Express } from 'express'
import type { FormattedExecutionResult } from 'graphql'
import { internalProxyGraphQLQuery } from '../common/index.js'

export function getMethodMapping (app: Express, methods: Array<Record<string, any>>): Record<string, (args: never[]) => Promise<FormattedExecutionResult>> {
  return {
    query: async (args): Promise<FormattedExecutionResult> => {
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
    ...methods.reduce((acc, rpc) => {
      return {
        ...acc,
        [rpc.name]: async (...args: never[]): Promise<FormattedExecutionResult> => {
          const variables = rpc.params.reduce((acc: Record<string, never>, i: { name: never }, index: number) => {
            return { ...acc, [i.name]: args[index] }
          }, {} satisfies Record<string, never>)
          delete variables.auth
          const headers = { ...(args[0] as Record<string, never>), 'json-rpc': true }
          return await new Promise<FormattedExecutionResult>((resolve, _reject) => {
            internalProxyGraphQLQuery(app)({
              operationName: rpc.name,
              query: rpc.description || '',
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
