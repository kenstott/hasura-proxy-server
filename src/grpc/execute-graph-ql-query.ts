import type { FormattedExecutionResult, GraphQLFormattedError } from 'graphql/index'
import { type JsonObject, struct } from 'pb-util'
import type { ObjMap } from 'graphql/jsutils/ObjMap'
import { type Express } from 'express'

export interface ExecuteGraphQLQuery {
  operationName: string
  query: string
  variables: Record<string, unknown>
  headers: Record<string, unknown>
  callback: (_: null, response: { data?: any, errors?: any, extensions?: any }) => void
}
export function executeGraphQLQuery (app: Express) {
  return ({ operationName, query, variables, headers, callback }: ExecuteGraphQLQuery): void => {
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
