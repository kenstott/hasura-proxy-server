import { plugin } from '../../plugin-builder/index.js'
import gql from 'graphql-tag'
import { getFieldList } from '../helpers/get-field-list'
import { Kind } from '../../common'

/**
 * @description Adds @sample operation directive to queries, which will
 * reduce the output to the number of sampled items. This useful when combined
 * with validate or profile plugins. It will validate and profile the entire dataset
 * but only return the # sampled items.
 *
 * @returns {HasuraPlugin} The plugin that is passed to our Hasura proxy server. The plugin is passed
 * dynamically by supplying a local or remote path to the module.
 */

export const fieldTrackingPlugin = plugin({
  // Define how to process your operation directive here...
  willSendResponsePluginResolver: async ({
    operation,
    schema,
    context,
    singleResult
  }) => {
    if (operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !singleResult.data) {
      return
    }
    // Destructure your operation args...like this
    const {
      startActiveTrace,
      addToErrors,
      args: { query }
    } = context

    try {
      if (singleResult.data) {
        const { list: info } = getFieldList(gql(query), schema)
        for (const fieldTracker of info ?? []) {
          await startActiveTrace(import.meta.url, async (span) => {
            span?.setAttributes({
              directiveName: 'field-tracking',
              query,
              field: `${fieldTracker.type}.${fieldTracker.field}`
            })
          })
        }
      }
    } catch (error) {
      // Trap processing errors like this...
      addToErrors(singleResult, error as Error, { code: 'PROBLEM_WITH_SAMPLING' })
    }
  }
})

/**
 * @description Create an interface describing your directive arguments
 */
export default fieldTrackingPlugin
export { fieldTrackingPlugin as plugin }
