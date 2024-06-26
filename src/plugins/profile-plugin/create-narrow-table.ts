import { flatten } from 'flat'
import type { ObjMap } from '../helpers/index.js'
import * as aq from 'arquero'
import _ from 'lodash'
import type ColumnTable from 'arquero/dist/types/table/column-table'

export const createNarrowTable = async (data: ObjMap<unknown>): Promise<Record<string, ColumnTable>> => {
  const flattened = Object.entries(data)
    .filter(([, dataset]) => Array.isArray(dataset))
    .reduce<Record<string, Array<Record<string, unknown>>>>((acc, [key, dataset]) =>
    ({ ...acc, [key]: (dataset as Array<Record<string, unknown>>).map(i => flatten(i)) }), {})

  const narrow = (dataset: Array<Record<string, unknown>>): ColumnTable => {
    const keyList = dataset.map(i => Object.entries(i)
      .filter(([_, v]) => !Array.isArray(v) || v.length !== 0)
      .map(([k, _]) => k))
    const keys = [...new Set(_.flatten(keyList))]
    const wideTable = aq.from(dataset, keys)
    return wideTable
      .fold(keys, { as: ['key', 'value'] }).derive(({
        normalizedKey: (d: Record<string, unknown>) => aq.op.replace(d.key, /\.[0-9.]+/g, '.')
      }))
  }
  return Object.entries(flattened).reduce<Record<string, ColumnTable>>((acc, [key, dataset]) => {
    return { ...acc, [key]: narrow(dataset) }
  }, {})
}
