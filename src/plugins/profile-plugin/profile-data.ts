import { createNarrowTable } from './create-narrow-table.js'
import type { Analysis, ObjMap, ScalarType, ValueObservation } from '../helpers/index.js'
import * as aq from 'arquero'
import { getScalarType } from './get-scalar-type.js'
import { analyze } from './create-stats.js'

export const profileData = async (data: ObjMap<unknown>): Promise<Analysis> => {
  const tables = await createNarrowTable(data)
  const typeMap = new Map<[string, string], ScalarType>()
  const keysMap = Object.entries(tables)
    .map(([name, table]) =>
      [
        name,
        table.select('normalizedKey').dedupe('normalizedKey').objects().map((k: Record<string, string>) => k.normalizedKey)
      ] as [string, string[]])
  for (const [name, keys] of keysMap) {
    for (const key of keys) {
      const value = tables[name].filter(aq.escape((d: Record<string, unknown>) => d.normalizedKey === key && d.value !== undefined)).get('value', 0)
      const scalarType = getScalarType(value || undefined)
      typeMap.set([name, key], scalarType)
    }
  }
  return [...typeMap.entries()].reduce<Analysis>((acc, [[datasetKey, columnKey], scalarType]): Analysis => {
    if (!acc[datasetKey]) {
      acc[datasetKey] = {}
    }
    acc[datasetKey][columnKey] = analyze[scalarType]?.(tables[datasetKey].filter(aq.escape((d: ValueObservation) => d.normalizedKey === columnKey)))
    return acc
  }, {})
}
