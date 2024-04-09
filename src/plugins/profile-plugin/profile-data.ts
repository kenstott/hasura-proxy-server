import { createNarrowTable } from './create-narrow-table.js'
import type { Analysis, ObjMap, ScalarType, ValueObservation } from './types.js'
import * as aq from 'arquero'
import { getScalarType } from './get-scalar-type.js'
import { analyze } from './create-stats.js'

export const profileData = (data: ObjMap<unknown>): Analysis => {
  const keyMap = new Map<[string, string], string>()
  const table = createNarrowTable(data, keyMap)
  const validValues = table
    .filter((d: ValueObservation) => d.value !== null && d.value !== undefined && d.value !== '')
    .filter(aq.escape((d: ValueObservation) => typeof d.value !== 'number' || !isNaN(d.value)))
  const typeMap = new Map<[string, string], ScalarType>()
  const keys = new Set([...keyMap.entries()].map(([[datasetKey], columnKey]) => `${datasetKey}:${columnKey}`))
  for (const entry of keys) {
    const [datasetKey, columnKey] = entry.split(':')
    const values = validValues.filter(aq.escape((d: ValueObservation) => d.datasetKey === datasetKey && d.columnKey === columnKey)).array('value')
    const scalarType = getScalarType(values?.[0] ?? undefined)
    typeMap.set([datasetKey, columnKey], scalarType)
  }
  return [...typeMap.entries()].reduce<Analysis>((acc, [[datasetKey, columnKey], scalarType]): Analysis => {
    if (!acc[datasetKey]) {
      acc[datasetKey] = {}
    }
    acc[datasetKey][columnKey] = analyze[scalarType]?.(table.filter(aq.escape((d: ValueObservation) => d.datasetKey === datasetKey && d.columnKey === columnKey)))
    return acc
  }, {})
}
