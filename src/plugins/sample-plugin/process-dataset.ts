// Extract Sampling Function Logic
import type { ExecutionResult } from '../helpers'
import * as aq from 'arquero'

export const processDataset = (operationResult: ExecutionResult, count: number, random: boolean, fromEnd: boolean): Record<string, number> => {
  const actualDatasetSize = {}
  if (operationResult.data) {
    for (const entry of Object.entries(operationResult.data)) {
      const [key, dataset] = entry
      if (Array.isArray(dataset)) {
        actualDatasetSize[key] = dataset.length
        if (random) {
          operationResult.data[key] = [...aq.from(dataset).sample(count, { shuffle: true })] as Array<Record<string, unknown>>
        } else if (fromEnd) {
          operationResult.data[key] = dataset.slice(-count)
        } else {
          operationResult.data[key] = dataset.slice(0, count)
        }
      }
    }
  }
  return actualDatasetSize
}
