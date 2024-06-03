import type { FormattedExecutionResult } from 'graphql/execution'

export enum ScalarType {
  string,
  number,
  boolean,
  date,
  unknown
}

export interface ValueObservation {
  key: string
  normalizedKey: string
  value: any
}

export interface Stats {
  min: number | string
  max: number | string
  average: number | string
  median: number | string
  mode: number | string
  mean: number | string
  stdev: number
  variance: number
  sum?: number
}

export interface ColumnAnalysis {
  unique?: boolean
  dups?: Record<string, number>
  stats?: Stats
  quartiles?: Record<string, number>
  deciles?: Record<string, number>
  counts?: number | Record<string, number>
}

export type Analysis = Record<string, Record<string, ColumnAnalysis>>
export type ObjMap<T> = Record<string, T>
export type ExecutionResult = FormattedExecutionResult<ObjMap<Array<Record<string, unknown>>>>
