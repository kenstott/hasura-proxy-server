import type { FormattedExecutionResult, GraphQLFormattedError } from 'graphql'
import { type JsonObject, struct } from 'pb-util'
import type { ObjMap } from 'graphql/jsutils/ObjMap'
import { type Express } from 'express'

/**
 * @param {string} operationName - The name of the operation.
 * @param {string} query - The GraphQL query string.
 * @param {Object} variables - The variables to be passed to the query.
 * @param {Object} headers - Additional headers to be included in the request.
 * @param {function} callback - The callback function to handle the response.
 */
export interface InternalProxyGraphQLQuery {
  operationName: string
  query: string
  variables: Record<string, unknown>
  headers: Record<string, unknown>
  callback: (_: null, response: { data?: any, errors?: any, extensions?: any } | any) => void
}

export type InternalProxyFunction = (params: InternalProxyGraphQLQuery) => void

/**
 * Creates an internal proxy GraphQL query function. It proxies to the HTTP server hosted by the app.
 *
 * @param {Express} app - The Express app to make the query to.
 * @return {(params: InternalProxyGraphQLQuery) => void}
 */
export function internalProxyGraphQLQuery (app: Express): InternalProxyFunction {
  return ({ operationName, query, variables, headers, callback }: InternalProxyGraphQLQuery): void => {
    const req = {
      method: 'POST',
      url: '/graphql-internal',
      params: {},
      query: {},
      headers: { 'Content-Type': 'application/json', ...headers }, // Request headers
      body: { operationName, query, variables }
    }
    const res = {
      setHeader: function (name: string, value: string) {
        this.header = { ...this.header, [name]: value }
      },
      status: function (code: number) {
        this.statusCode = code
        return this // For method chaining
      },
      send: function (data: string) {
        const parseData = JSON.parse(data) as FormattedExecutionResult
        if (parseData.extensions) {
          if (!this.header['json-rpc']) {
            parseData.extensions = struct.encode(parseData.extensions as JsonObject) as ObjMap<unknown>
          }
        }
        if (parseData.errors) {
          if (!this.header['json-rpc']) {
            parseData.errors = parseData.errors.map(i => struct.encode(i as unknown as JsonObject) as GraphQLFormattedError)
          }
        }
        callback(null, parseData)
      }
    }
    const next = function (err: Error): void {
      if (err) {
        // should be reflected in 'extensions'
        res.status(500)
      } else {
        console.log('Route handled successfully')
      }
    }

    app._router.handle(req, res, next)
  }
}
