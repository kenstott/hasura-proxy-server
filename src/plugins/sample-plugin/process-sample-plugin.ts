import type { ExecutionResult } from '../helpers'
import type { OperationResolveContext } from '../../plugin-builder'
import { processDataset } from './process-dataset'
import { type SamplePluginArgs } from './sample-plugin'

export const processSamplePlugin = async (operationResult: ExecutionResult, args: SamplePluginArgs, context: OperationResolveContext): Promise<void> => {
  const { count, random, fromEnd } = args

  const actualDatasetSize = processDataset(operationResult, count, random, fromEnd)
  context.addToExtensions(operationResult, { actualDatasetSize })
}
