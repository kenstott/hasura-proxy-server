import { flatten } from 'flat'
import type { ObjMap, ValueObservation } from './types'
import { getKeyMap } from './get-key-map'
import * as aq from 'arquero'

type ColumnTable = aq.internal.ColumnTable

export const createNarrowTable = (data: ObjMap<unknown>, keyMap: Map<[string, string], string>): ColumnTable => {
  const flattened = Object.entries(data)
    .filter(([, dataset]) => Array.isArray(dataset))
    .reduce<Record<string, Array<Record<string, unknown>>>>((acc, [key, dataset]) =>
    ({ ...acc, [key]: (dataset as Array<Record<string, unknown>>).map(i => flatten(i)) }), {})
  const narrow = (datasetKey: string, dataset: Array<Record<string, unknown>>): ValueObservation[] => {
    return dataset.reduce<ValueObservation[]>((acc, record, row) => {
      const observations = Object.entries(record).map(([originalColumnKey, value]) => {
        const columnKey = getKeyMap(keyMap, datasetKey, originalColumnKey)
        return { datasetKey, row, columnKey, value }
      })
      return [...acc, ...observations]
    }, [])
  }
  const narrowed = Object.entries(flattened).reduce((acc, [key, dataset]) => {
    return [...acc, ...narrow(key, dataset)]
  }, [])
  return aq.from(narrowed)
}
