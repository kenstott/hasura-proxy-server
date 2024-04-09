import dayjs from 'dayjs'
import { ScalarType } from './types.js'

const isNumeric = (value: unknown): boolean => typeof value === 'number'
const isBoolean = (value: unknown): boolean => typeof value === 'boolean'
const isString = (value: unknown): boolean => typeof value === 'string'
const isDate = (value: unknown): boolean => typeof value === 'string' && dayjs(value).isValid()
export const getScalarType = (value: unknown): ScalarType => {
  if (isBoolean(value)) {
    return ScalarType.boolean
  }
  if (isNumeric(value)) {
    return ScalarType.number
  }
  if (isDate(value)) {
    return ScalarType.date
  }
  if (isString(value)) {
    return ScalarType.string
  }
  return ScalarType.unknown
}
