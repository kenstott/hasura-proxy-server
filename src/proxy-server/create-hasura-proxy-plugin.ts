import { type GraphQLRequestListener, type GraphQLResponse, type HTTPGraphQLHead } from '@apollo/server'
import {
  type FormattedExecutionResult,
  type HasuraContext,
  type HasuraPlugin,
  parse,
  print,
  visit
} from '../common/index.js'
import { startActiveTrace } from './telemetry'

/**
 * @description An Apollo Server plugin that proxies to a remote Hasura GraphQL Engine.
 * @param directiveName {string[]} An array of the custom directives & args, for example: ["@validate(schema: String)"]
 * These must be known, so they can be stripped from the proxy call that goes to HGE.
 * @param hasuraUri {string} The URI of the remote server should
 */
export const createHasuraProxyPlugin = async (directiveName: string[], hasuraUri: string): Promise<HasuraPlugin> => {
  return startActiveTrace(import.meta.url, async () => {
    const plainDirectiveNames = directiveName.map(i => {
      const matches = i.replace(/\n/g, ' ').trim().match(/^(.+?(?=\())(\(.*\))$/)
      if (matches === null) {
        throw new Error('Bad directive name. Directive name must be in this form: "@<name>(<SDL arg list>)"')
      } else {
        return matches[1].slice(1)
      }
    })
    return {
      operationDirective: '',
      async requestDidStart () {
        return {
          async responseForOperation (requestContext) {
            return startActiveTrace('response-for-operation', async (span) => {
              const {
                http,
                query,
                variables
              } = requestContext.request
              const {
                method,
                headers: headersMap
              } = http ?? {}
              const {
                operationName,
                operation,
                contextValue: { isSchemaQuery }
              } = requestContext
              span?.setAttributes({
                operationName: operationName ?? undefined,
                type: operation.operation
              })
              if (!query || isSchemaQuery) {
                return null
              }
              span?.setAttributes({ query })
              const ast = parse(query)
              const hasuraAST = visit(ast, {
                Directive: {
                  leave: (node) => {
                    if (plainDirectiveNames.includes(node.name.value)) {
                      return null
                    }
                    return node
                  }
                }
              })
              const modifiedQuery = print(hasuraAST)
              headersMap?.delete('content-length')
              const headers = [...headersMap ?? []]
              const body = JSON.stringify({
                operationName,
                variables,
                query: modifiedQuery
              })
              const response = await fetch(hasuraUri, {
                method,
                headers,
                body
              })
              const singleResult = await response.json() as FormattedExecutionResult
              return {
                http: requestContext.request.http as HTTPGraphQLHead,
                body: {
                  kind: 'single',
                  singleResult
                }
              } satisfies GraphQLResponse
            })
          }
        } satisfies GraphQLRequestListener<HasuraContext>
      }
    }
  })
}
