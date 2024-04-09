import {FormattedExecutionResult, GraphQLError} from '../common/index.js'

/**
 * @description a helper function that assists a server plugin to mutate a GraphQL response by adding an error
 * to the GraphQL response from a server plugin. This is handled automatically within a resolver, this is
 * required to support plugin errors.
 * @param executionResult {FormattedExecutionResult}
 * @param error {Error}
 * @param extensions
 */
export const addToErrors = (executionResult: FormattedExecutionResult, error: Error, extensions?: Record<string, any>): void => {
    executionResult.errors = [...executionResult.errors ?? [], new GraphQLError(error.message, {extensions})]
}
