import { type FormattedExecutionResult } from '../common/index.js'

/**
 * @description a helper function that assists a server plugin to mutate a GraphQL response by adding to the
 * extension of the GraphQL response from a server plugin.
 * @param executionResult {FormattedExecutionResult}
 * @param item {Record<string, any>} the object to add to extensions
 */
export const addToExtensions = (executionResult: FormattedExecutionResult, item: Record<string, any>): void => {
  executionResult.extensions = {
    ...(executionResult.extensions ?? {}),
    ...item
  }
}
