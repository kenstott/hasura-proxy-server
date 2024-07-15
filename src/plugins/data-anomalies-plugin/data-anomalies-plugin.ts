import { plugin } from '../../plugin-builder/index.js'
import { GetAnomalousRecords, type ModelOutput } from './get-anomalous-records.js'
import { Kind } from '../../common/index.js'
import { getSelectionSetHash } from '../helpers/index.js'

/**
 * @description Adds @validate operation directive to queries, which will
 * execute json schema validations against the returned data set, and return
 * the results in the extensions
 *
 * @returns {HasuraPlugin} The plugin that is passed to our Hasura proxy server. The plugin is passed
 * dynamically by supplying a local or remote path to the module.
 */

export const dataAnomaliesPlugin = plugin({
  // Define you operation directive here....in SDL
  operationDirective: `@anomalies(
  """A value in the range of -.5 to .5, being most anomalous to least anomalous. Defaults 0.""" 
  threshold: Float = 0, 
  """If set generates a data detection anomaly model that can be reused. When used will not evaluate for suspicious records."""
  modelOut: ModelOutput = NONE
  """Explain where to retrieve a previous model to reuse it. If NONE creates model from input data."""
  modelIn: ModelInput = NONE
  """When using modelIn of BASE64, this is the binary representation of the model"""
  modelInData: String
  )`,
  operationDirectiveHelp: 'Vectorizes all text attributes as enumerables. Trains against same dataset. And returns anomalous records in the extensions',
  additionalSDL: `
  """ Model output options """
  enum ModelOutput {
  """ base64 """
  BASE64
  """ database keyed to selection set """
  SELECTION_SET
  """ database keyed to operation name """
  OPERATION_NAME
  """ do not generate a model - create a model from current dataset and then use it to detect suspicious records """
  NONE
  }
  """ Model input options """
  enum ModelInput {
  """ base64 """
  BASE64
  """ database keyed to selection set """
  SELECTION_SET
  """ database keyed to operation name """
  OPERATION_NAME
  """ use input dataset to generate model - and then detect suspicious records """
  NONE
}
  `,
  // Define your arg defaults in TypeScript - to match the arg defaults in your SDL
  argDefaults: {
    threshold: 0
  },
  useWithReplays: true,

  // Define how to process your operation directive here...
  willSendResponsePluginResolver: async ({
    operation,
    context,
    singleResult,
    span,
    args,
    schema
  }) => {
    if (operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !singleResult.data) {
      return
    }
    const {
      args: ctxArgs,
      addToErrors,
      addToExtensions
    } = context
    const { threshold, modelOut, modelIn, modelInData } = args as DataAnomaliesPluginArgs
    span?.setAttributes(ctxArgs)
    try {
      const operationName = ctxArgs.operationName
      const selectionSetHash = getSelectionSetHash(ctxArgs.query, schema)
      const getAnomalousRecords = new GetAnomalousRecords('./.venv/bin/python3')
      const anomalies = await getAnomalousRecords.getScores({
        data: singleResult.data,
        threshold,
        modelOut,
        modelIn,
        modelInData,
        selectionSetHash,
        operationName
      })
      getAnomalousRecords.destroy()
      // Add your new data into the extensions - OR - augment the original data
      span?.setAttributes({ extensionJson: JSON.stringify(anomalies) })
      addToExtensions(singleResult, { anomalies })
    } catch (error) {
      // Trap processing errors like this...
      addToErrors(singleResult, error as Error, {
        code: 'ANOMALIES_ERROR'
      })
    }
  }
})

/**
 * @description Create an interface describing your directive arguments
 */
interface DataAnomaliesPluginArgs {
  threshold: number
  modelOut?: ModelOutput
  modelIn?: ModelOutput
  modelInData?: string
}

// Always export it as the default
export default dataAnomaliesPlugin
export { dataAnomaliesPlugin as plugin }
