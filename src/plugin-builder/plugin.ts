import {
    type FormattedExecutionResult,
    type GraphQLSchema,
    HasuraContext,
    type HasuraPlugin,
    Kind,
    OperationDefinitionNode
} from '../common/index.js'
import {getDirectiveArgs, getDirectiveAttributes} from './get-directive-args'
import {type Attributes, type Span} from '@opentelemetry/api'
import {startActiveTrace} from '../proxy-server/telemetry'
import {GraphQLRequestContextDidResolveOperation, type HTTPGraphQLRequest} from '@apollo/server'
import {addToExtensions} from './add-extensions'
import {addToErrors} from './add-errors'

export type VariableValues = {
    [name: string]: any;
};

type ArgsContext = {
    directiveName: string
    userID: string
    operationName: string,
    variables: VariableValues
    query: string
} & Attributes

interface OperationResolveContext {
    args: ArgsContext
    startActiveTrace: <T>(name: string, fn: (span?: Span) => Promise<T>) => T
    addToExtensions: (executionResult: FormattedExecutionResult, item: Record<string, any>) => void
    addToErrors: (executionResult: FormattedExecutionResult, error: Error, extensions?: Record<string, any>) => void
}

interface WillSendResponsePluginResolverOptions {
    singleResult: FormattedExecutionResult
    http?: HTTPGraphQLRequest
    span?: Span
    args?: Record<string, any>
    context: OperationResolveContext
    schema: GraphQLSchema
    operation: OperationDefinitionNode
    userID?: string | string[]
}

type WillSendResponsePluginResolver = (options: WillSendResponsePluginResolverOptions) => Promise<void>

export interface MakeHasuraPluginOptions {
    operationDirectiveHelp?: string
    operationDirective?: string
    additionalSDL?: string
    willSendResponsePluginResolver?: WillSendResponsePluginResolver
    didResolveOperationPluginResolver?: (requestContext: GraphQLRequestContextDidResolveOperation<HasuraContext>) => Promise<void>
    argDefaults?: Record<string, any>
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
                           didResolveOperationPluginResolver,
                           willSendResponsePluginResolver,
                           argDefaults
                       }: MakeHasuraPluginOptions): HasuraPlugin => {
    const operationDirectiveName = operationDirective?.replace(/\n/g, ' ').trim().match(/^@(.+?(?=\())(\(.*\))$/)?.[1] ?? ''
    return {
        operationDirectiveHelp,
        operationDirective,
        additionalSDL,
        async requestDidStart(requestContext) {

            return {
                async didResolveOperation(context) {
                    if (context.contextValue.stopProcessing) {
                        return
                    }
                    await didResolveOperationPluginResolver?.(context)
                },
                async willSendResponse(context) {
                    if (context.contextValue.stopProcessing) {
                        return
                    }
                    if (!willSendResponsePluginResolver) {
                        return
                    }
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
                    const operationName = _operationName ?? ''
                    const variables = _variables ?? {}
                    return startActiveTrace(import.meta.url, async (span) => {
                        if (response.body.kind === 'single') {
                            const directive = operation?.directives?.find(i => i.name.value === operationDirectiveName)
                            if (directive !== undefined || !operationDirectiveName) {
                                const userID = http?.headers.get('x-hasura-user-id') ?? ''
                                const directiveArgs = getDirectiveAttributes(directive, argDefaults)
                                const args = getDirectiveArgs(directive, argDefaults)
                                const {singleResult} = response.body
                                const query = originalQuery ?? ''
                                const context = {
                                    args: {
                                        ...directiveArgs,
                                        operationName,
                                        directiveName: operationDirectiveName,
                                        variables,
                                        query,
                                        userID
                                    },
                                    startActiveTrace,
                                    addToExtensions,
                                    addToErrors
                                } as OperationResolveContext
                                span?.setAttributes({
                                    query,
                                    userID,
                                    directiveName: operationDirectiveName,
                                    ...directiveArgs
                                })
                                await willSendResponsePluginResolver({
                                    singleResult,
                                    operation,
                                    http,
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
