import { plugin } from '../plugin-builder/index.js'
import * as aq from 'arquero'
import { Kind } from '../common/index.js'

/**
 * @description Adds @sample operation directive to queries, which will
 * reduce the output to the number of sampled items. This useful when combined
 * with validate or profile plugins. It will validate and profile the entire dataset
 * but only return the # sampled items.
 *
 * @returns {HasuraPlugin} The plugin that is passed to our Hasura proxy server. The plugin is passed
 * dynamically by supplying a local or remote path to the module.
 */

export const samplePlugin = plugin({
  // Define you operation directive here....in SDL
  operationDirective: '@sample(count: Int!, random: Boolean = false, fromEnd: Boolean = false)',

  // Define your arg defaults in TypeScript - to match the arg defaults in your SDL
  argDefaults: {
    random: false,
    fromEnd: false
  },

  // Define how to process your operation directive here...
  willSendResponsePluginResolver: async ({
    operation,
    context,
    singleResult,
    args,
    span
  }) => {
    // Destructure your operation args...like this
    if (operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !singleResult.data) {
      return
    }
    const {
      count,
      random,
      fromEnd
    } = args as SamplePluginArgs
    const {
      args: ctxArgs,
      addToErrors,
      addToExtensions
    } = context

    span?.setAttributes(ctxArgs)
    try {
      const actualDatasetSize = {}
      for (const entry of Object.entries(singleResult.data)) {
        const [key, dataset] = entry
        if (Array.isArray(dataset)) {
          actualDatasetSize[key] = dataset.length
          if (random) {
            singleResult.data[key] = [...aq.from(dataset).sample(count, { shuffle: true })]
          } else if (fromEnd) {
            singleResult.data[key] = dataset.slice(-count)
          } else {
            singleResult.data[key] = dataset.slice(0, count)
          }
        }
      }
      addToExtensions(singleResult, { actualDatasetSize })
    } catch (error) {
      // Trap processing errors like this...
      addToErrors(singleResult, error as Error, { code: 'PROBLEM_WITH_SAMPLING' })
    }
  }
})

/**
 * @description Create an interface describing your directive arguments
 */
interface SamplePluginArgs {
  count: number
  random: boolean
  fromEnd: boolean
}

// Always export it as the default
export default samplePlugin
export { samplePlugin as plugin }
