import type { ArgumentNode, DirectiveNode, ValueNode } from '../common/index.js'
import { GraphQLError, Kind } from '../common/index.js'
import { type Attributes, type AttributeValue } from '@opentelemetry/api'

type ValueTypes = string | number | boolean | null | ValueTypes[]
/**
 * @description Converts a scalar based value node into the correct native type
 * @param value {ValueNode}
 */
export const convertValueNode = (value: ValueNode): ValueTypes => {
  switch (value.kind) {
    case Kind.BOOLEAN:
    case Kind.ENUM:
    case Kind.STRING:
      return value.value
    case Kind.INT:
      return parseInt(value.value)
    case Kind.FLOAT:
      return parseFloat(value.value)
    case Kind.LIST:
      return value.values.map(convertValueNode)
    case Kind.NULL:
      return null
    case Kind.OBJECT:
    case Kind.VARIABLE:
      throw new GraphQLError('Complex common in operation directive', { extensions: { code: 'INVALID_TYPE_IN_DIRECTIVE_ARGS' } })
  }
}
/**
 * @description A convenience function to extract operation directive args and turn them into a JSON map.
 * @param directive {DirectiveNode}
 * @param defaults {Record<string, any>} A map of optional default values
 */
export const getDirectiveArgs = (directive?: DirectiveNode, defaults: Record<string, ValueTypes> = {}): Record<string, ValueTypes> => {
  return directive?.arguments?.reduce((acc: Record<string, ValueTypes>, i: ArgumentNode) => {
    return {
      ...acc,
      [i.name.value]: convertValueNode(i.value)
    }
  }, defaults) ?? defaults
}

const convertValueTypeToAttribute = (value: ValueNode): AttributeValue => {
  switch (value.kind) {
    case Kind.BOOLEAN:
    case Kind.ENUM:
    case Kind.STRING:
      return value.value
    case Kind.INT:
      return parseInt(value.value)
    case Kind.FLOAT:
      return parseFloat(value.value)
    case Kind.LIST:
      return value.values.map(i => convertValueTypeToAttribute(i).toString())
    case Kind.NULL:
      return 'null'
    case Kind.OBJECT:
    case Kind.VARIABLE:
      throw new GraphQLError('Complex common in operation directive', { extensions: { code: 'INVALID_TYPE_IN_DIRECTIVE_ARGS' } })
  }
}
export const getDirectiveAttributes = (directive?: DirectiveNode, defaults: Record<string, ValueTypes> = {}): Attributes => {
  const newDefaults = Object.entries(defaults).reduce<Attributes>((acc, [key, value]) => {
    if (value === null) {
      value = 'null'
    } else if (Array.isArray(value)) {
      value = value.map(i => (i || 'null').toString())
    }
    return {
      ...acc,
      [key]: value as AttributeValue
    }
  }, {})
  return directive?.arguments?.reduce((acc: Attributes, i: ArgumentNode) => {
    return {
      ...acc,
      [i.name.value]: convertValueTypeToAttribute(i.value)
    }
  }, newDefaults) ?? newDefaults
}
