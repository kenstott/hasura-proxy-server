import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { plugin } from '../../plugin-builder'
import _ from 'lodash'
import { Kind } from '../../common'

/**
 * @description Adds @validate operation directive to queries, which will
 * execute json schema validations against the returned data set, and return
 * the results in the extensions
 *
 * @returns {HasuraPlugin} The plugin that is passed to our Hasura proxy server. The plugin is passed
 * dynamically by supplying a local or remote path to the module.
 */

export const validatePlugin = plugin({
  // Define you operation directive here....in SDL
  operationDirective: '@validate(jsonSchema: String!, verbose: Boolean = true, allErrors: Boolean = true, strict: Boolean = true)',

  // Define your arg defaults in TypeScript - to match the arg defaults in your SDL
  argDefaults: { verbose: true, allErrors: true, strict: false },

  // Define how to process your operation directive here...
  willSendResponsePluginResolver: async ({ operation, context, singleResult, args, span }) => {
    if (operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !singleResult.data) {
      return
    }

    // Destructure your operation args...like this
    const { jsonSchema, verbose, allErrors, strict } = args as ValidatePluginArgs
    const { args: ctxArgs, startActiveTrace, addToErrors, addToExtensions } = context

    span?.setAttributes(ctxArgs)
    try {
      // Instantiate the json validator engine
      const ajv = new Ajv({ verbose, allErrors, strict })
      addFormats(ajv)

      // Generate the validator
      const validator = ajv.compile(JSON.parse(jsonSchema))

      // Generate the results
      validator(singleResult.data)

      // Extract any errors
      const errors = validator.errors?.filter(i => i.keyword !== 'if')

      // Report errors - decided to do these as discrete traces...but not a requirement
      for (const error of errors ?? []) {
        await startActiveTrace(import.meta.url, async (span) => {
          span?.setAttributes({ ..._.omit(ctxArgs, 'variables'), extensionJson: JSON.stringify(error) })
        })
      }

      // Add your new data into the extensions - OR - augment the original data
      addToExtensions(singleResult, { validation: { errors } })
    } catch (error) {
      // Trap processing errors like this...
      addToErrors(singleResult, error as Error, { code: 'BAD_JSON_SCHEMA_VALIDATOR', jsonSchema })
    }
  }
})

/**
 * @description Create an interface describing your directive arguments
 */
interface ValidatePluginArgs {
  jsonSchema: string
  verbose: boolean
  allErrors: boolean
  strict: boolean
}

// Always export it as the default
export default validatePlugin
export { validatePlugin as plugin }
