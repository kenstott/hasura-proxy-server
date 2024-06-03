import { plugin } from '../../plugin-builder/index.js'
import { profileData } from './profile-data.js'
import { Kind } from '../../common/index.js'

/**
 * @description Adds @validate operation directive to queries, which will
 * execute json schema validations against the returned data set, and return
 * the results in the extensions
 *
 * @returns {HasuraPlugin} The plugin that is passed to our Hasura proxy server. The plugin is passed
 * dynamically by supplying a local or remote path to the module.
 */

export const profilePlugin = plugin({
  // Define you operation directive here....in SDL
  operationDirective: '@profile("""If not specified profiles all fields, other wise this can be a comma delimited list, of dot delimited field names.""" fields: [String])',
  operationDirectiveHelp: 'Creates a data profile for your query results',

  // Define your arg defaults in TypeScript - to match the arg defaults in your SDL
  argDefaults: { fields: ['*'] },

  // Define how to process your operation directive here...
  willSendResponsePluginResolver: async ({
    operation,
    context,
    singleResult,
    args,
    span
  }) => {
    if (operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !singleResult.data) {
      return
    }

    // Destructure your operation args...like this
    const { fields } = args as ProfilePluginArgs
    const {
      args: ctxArgs,
      addToErrors,
      addToExtensions
    } = context
    span?.setAttributes(ctxArgs)

    const profiling = await profileData(singleResult.data)
    span?.setAttributes({ extensionJson: JSON.stringify(profiling) })
    try {
      // Add your new data into the extensions - OR - augment the original data
      addToExtensions(singleResult, { profiling })
    } catch (error) {
      // Trap processing errors like this...
      addToErrors(singleResult, error as Error, {
        code: 'BAD_FIELD_LIST',
        fields
      })
    }
  }
})

/**
 * @description Create an interface describing your directive arguments
 */
interface ProfilePluginArgs {
  fields: string[]
}

// Always export it as the default
export default profilePlugin
