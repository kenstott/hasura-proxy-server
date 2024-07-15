import {
  type DirectiveNode,
  type FormattedExecutionResult,
  type GraphQLSchema,
  type HasuraContext,
  type HasuraPlugin,
  Kind,
  type OperationDefinitionNode
} from '../common/index.js'
import { getDirectiveArgs, getDirectiveAttributes } from './get-directive-args.js'
import { type Attributes, type Span } from '@opentelemetry/api'
import { startActiveTrace } from '../proxy-server/telemetry.js'
import {
  type GraphQLRequest,
  type GraphQLRequestContextDidResolveOperation,
  type GraphQLRequestContextResponseForOperation,
  type GraphQLResponse
} from '@apollo/server'
import { addToExtensions } from './add-extensions.js'
import { addToErrors } from './add-errors.js'

export type VariableValues = Record<string, any>

type ArgsContext = Attributes & {
  directiveName: string
  userID: string
  operationName: string
  query: string
}

export interface OperationResolveContext {
  args: ArgsContext
  variables: VariableValues
  startActiveTrace: <T>(name: string, fn: (span?: Span) => Promise<T>) => Promise<T>
  addToExtensions: (executionResult: FormattedExecutionResult, item: Record<string, any>) => void
  addToErrors: (executionResult: FormattedExecutionResult, error: Error, extensions?: Record<string, any>) => void
}

interface WillSendResponsePluginResolverOptions {
  singleResult: FormattedExecutionResult
  request?: GraphQLRequest
  span?: Span
  args?: Record<string, any>
  context: OperationResolveContext
  schema: GraphQLSchema
  operation: OperationDefinitionNode
  contextValue: HasuraContext
  userID?: string | string[]
}

type WillSendResponsePluginResolver = (options: WillSendResponsePluginResolverOptions) => Promise<void>

export interface MakeHasuraPluginOptions {
  operationDirectiveHelp?: string
  operationDirective?: string
  additionalSDL?: string
  responseForOperationPluginResolver?: (requestContext: GraphQLRequestContextResponseForOperation<HasuraContext>) => Promise<GraphQLResponse | null>
  willSendResponsePluginResolver?: WillSendResponsePluginResolver
  didResolveOperationPluginResolver?: (requestContext: GraphQLRequestContextDidResolveOperation<HasuraContext>) => Promise<void>
  argDefaults?: Record<string, any>
  useWithReplays?: boolean
}

/**
 * @description abstracts away the boilerplate code used to convert the Hasura Plugin into an ApolloServerPlugin.
 * @param operationDirective {string} the operation directive name and optional arguments in this format: "@<directive-name>(<SDL argument list>)"
 * @param additionalSDL
 * @param operationResolver {WillSendResponsePluginResolver} a function that mutates the GraphQL response based on the operation directive
 * @param argDefaults {Record<string, any>} a map of argument defaults to assist in using the argument directives
 */
export const plugin = ({
  operationDirectiveHelp,
  operationDirective,
  additionalSDL,
  responseForOperationPluginResolver,
  didResolveOperationPluginResolver,
  willSendResponsePluginResolver,
  useWithReplays,
  argDefaults
}: MakeHasuraPluginOptions): HasuraPlugin => {
  const operationDirectiveName = operationDirective?.replace(/\n/g, ' ').trim().match(/^@(.+?(?=\())(\(.*\))$/)?.[1] ?? ''
  return {
    operationDirectiveHelp,
    operationDirective,
    additionalSDL,
    async requestDidStart (_requestContext) {
      return {
        async responseForOperation (requestContext: GraphQLRequestContextResponseForOperation<HasuraContext>): Promise<GraphQLResponse | null> {
          if (!requestContext.contextValue.isSchemaQuery) {
            return await responseForOperationPluginResolver?.(requestContext) ?? null
          }
          return null
        },
        async didResolveOperation (context) {
          if (context.contextValue.stopProcessing) {
            return
          }
          await didResolveOperationPluginResolver?.(context)
        },
        async willSendResponse (context) {
          if (context.contextValue.stopProcessing || !willSendResponsePluginResolver) {
            return
          }
          const { request } = context
          const {
            operationName: _operationName,
            schema,
            request: {
              http,
              query: originalQuery,
              variables: _variables
            },
            contextValue,
            operation,
            response
          } = context
          if (contextValue.isSchemaQuery || response.body.kind !== 'single' || operation?.kind !== Kind.OPERATION_DEFINITION) {
            return
          }
          if (contextValue.history && !useWithReplays) {
            return
          }
          const operationName = _operationName || context.operation?.name?.value || ' '
          const variables = _variables ?? {}
          await startActiveTrace(import.meta.url, async (span) => {
            if (response.body.kind === 'single') {
              const directive: DirectiveNode | undefined =
                                operation?.directives?.find((i: DirectiveNode) => i.name.value === operationDirectiveName) ||
                                contextValue.revisedOperation?.directives?.find((i: DirectiveNode) => i.name.value === operationDirectiveName)
              if (directive !== undefined || !operationDirectiveName) {
                const userID = http?.headers.get('x-hasura-user-id') ?? ''
                const directiveArgs = getDirectiveAttributes(directive, argDefaults)
                const args = getDirectiveArgs(directive, argDefaults)
                const { singleResult } = response.body
                const query = originalQuery ?? ''
                const context = {
                  args: {
                    ...directiveArgs,
                    operationName,
                    directiveName: operationDirectiveName,
                    query,
                    userID
                  } satisfies ArgsContext,
                  variables,
                  startActiveTrace,
                  addToExtensions,
                  addToErrors
                } satisfies OperationResolveContext
                span?.setAttributes({
                  query,
                  userID,
                  directiveName: operationDirectiveName,
                  ...directiveArgs
                })
                await willSendResponsePluginResolver({
                  singleResult,
                  operation,
                  request,
                  contextValue,
                  span,
                  args,
                  context,
                  schema,
                  userID
                })
              }
            }
          })
        }
      }
    }
  }
}
