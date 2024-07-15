import * as aq from 'arquero'
import { op } from 'arquero'
import { type ColumnAnalysis, ScalarType, type Stats } from '../helpers/index.js'

export interface Stringable {
  /**
     * String coercion method.
     */
  toString: () => string
}

export type Params = Record<string, any>
export type TableExprString = string | Stringable
/**
 * A struct object with arbitrary named properties.
 */
export type Struct = Record<string, any>
/**
 * A function defined over a table row.
 */
export type TableExprFunc = (d?: Struct, $?: Params) => any
export type TableExpr = TableExprFunc | TableExprString

export type ExprObject = Record<string, TableExpr>
const statOps = (column: string): ExprObject => ({
  mean: op.mean(column),
  min: op.min(column),
  max: op.max(column),
  average: op.average(column),
  median: op.median(column),
  mode: op.mode(column),
  variance: op.variance(column),
  stdev: op.stdev(column),
  sum: op.sum(column)
})
const quantiles = (column: string, range: number[]): ExprObject => range.reduce((acc, i) => ({
  ...acc,
  [i.toString()]: op.quantile(column, i)
}), {})
const analyzeStrings = (table: aq.internal.ColumnTable): ColumnAnalysis => {
  const unique = aq.agg(table, op.distinct('value')) === table.numRows()
  if (!unique) {
    const countRollup = table
      .groupby('value')
      .rollup({ count: op.count() })
    const stats = countRollup.rollup(statOps('count')).object() as Stats
    const counts = [...countRollup].reduce<Record<string, number>>((acc, i: { value: string, count: number }) => ({
      ...acc,
      [i.value]: i.count
    }), {})
    const dups = Object.entries(counts).reduce((acc, [name, count]) => {
      if (count > 1) {
        acc[name] = count
      }
      return acc
    }, {})
    return { unique, dups, stats }
  }
  return { unique }
}
const analyzeNumbers = (table: aq.internal.ColumnTable): ColumnAnalysis => {
  const unique = aq.agg(table, op.distinct('value')) === table.numRows()
  if (!unique) {
    const stats = table.rollup(statOps('value')).object() as Stats
    const quartiles = table.rollup(quantiles('value', [0.25, 0.50, 0.75, 1.00])).object() as Record<string, number>
    const deciles = table.rollup(quantiles('value', [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])).object() as Record<string, number>
    return { unique, stats, quartiles, deciles }
  }
  return { unique }
}
const analyzeBooleans = (table: aq.internal.ColumnTable): ColumnAnalysis => {
  const countRollup = table
    .groupby('value')
    .rollup({ count: op.count() })
  const counts = [...countRollup].reduce<Record<string, number>>((acc, i: { value: string, count: number }) => ({
    ...acc,
    [i.value]: i.count
  }), {})
  return { counts }
}
const analyzeDates = (table: aq.internal.ColumnTable): ColumnAnalysis => {
  const unique = aq.agg(table, op.distinct('value')) === table.numRows()
  if (!unique) {
    const dates = table.spread(
      {
        value: aq.escape((d: { value: string }) => [
          new Date(d.value).getFullYear().toString(),
          (new Date(d.value).getMonth() + 1).toString(),
          ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(d.value).getDay()],
          new Date(d.value).getDate().toString(),
          new Date(d.value).getHours().toString(),
          (new Date(d.value)).getTime()
        ])
      },
      { as: ['year', 'month', 'dayOfWeek', 'dayOfMonth', 'hourOfDay', 'epoch'] }
    )
    const rollupDate = (part: string): any => [...dates.groupby(part)
      .rollup({ count: op.count() })].reduce<Record<string, number>>((acc, i: {
      count: number
    } & Record<string, string>) => ({
      ...acc,
      [i[part]]: i.count
    }), {})
    const counts = {
      year: rollupDate('year'),
      month: rollupDate('month'),
      dayOfWeek: rollupDate('dayOfWeek'),
      dayOfMonth: rollupDate('dayOfMonth'),
      hourOfDay: rollupDate('hourOfDay')
    }
    const stats = dates.rollup(statOps('epoch')).object() as Stats
    delete stats.sum
    stats.max = new Date(stats.max).toISOString()
    stats.min = new Date(stats.min).toISOString()
    stats.mean = new Date(stats.mean).toISOString()
    stats.median = new Date(stats.median).toISOString()
    stats.mode = new Date(stats.mode).toISOString()
    stats.average = new Date(stats.average).toISOString()
    return { unique, counts, stats }
  }
  return { unique }
}

export const analyze = {
  [ScalarType.string]: analyzeStrings,
  [ScalarType.number]: analyzeNumbers,
  [ScalarType.boolean]: analyzeBooleans,
  [ScalarType.date]: analyzeDates
}
