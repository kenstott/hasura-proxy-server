import {
  type GraphQLType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType
} from 'graphql'
import { generateMessageFromObjectType } from './generate-message-from-object-type.js'
import { type Field } from './field.js'
import { Enum } from './enum.js'
import { type Message } from './message.js'

interface ParamsStruct {
  name: string
  type: GraphQLType
  field: Partial<Field>
  messages?: Record<string, Partial<Message | Enum>>
}

/**
 * Generates a field from a given GraphQL Type.
 *
 * @param {ParamsStruct} params - The parameters for generating the field.
 * @returns {Object} - A object containing the generated field and supporting messages.
 */
export const generateFieldFromType = ({
  name,
  type,
  field,
  messages = {}
}: ParamsStruct): {
  field: Partial<Field>
  supportingMessages: Record<string, Partial<Message | Enum>>
} => {
  field.name = name
  if (isNonNullType(type)) {
    const response = generateFieldFromType({ name, type: type.ofType, field, messages })
    messages = { ...messages, ...response.supportingMessages }
    field = response.field
  } else if (isListType(type)) {
    field.repeated = true
    delete field.required
    const response = generateFieldFromType({ name, type: type.ofType, field, messages })
    messages = { ...messages, ...response.supportingMessages }
    field = response.field
  } else if (isScalarType(type)) {
    field.type = ScalarTypeToGrpcType[type.name]
  } else if (isObjectType(type) || isInputObjectType(type)) {
    field.type = type.name
    if (!messages[type.name]) {
      messages = { ...messages, [type.name]: {} }
      const response = generateMessageFromObjectType(type, messages)
      messages = {
        ...messages,
        ...response.supportingMessages
      }
      if (response.message) {
        messages[type.name] = response.message
      }
    }
  } else if (isEnumType(type)) {
    messages = {
      ...messages,
      [type.name]: new Enum({
        name: type.name,
        descriptions: type.getValues().reduce((acc, i) => ({ ...acc, [i.name]: i.description }), {}),
        values: type.getValues().reduce((acc, i) => ({ ...acc, [i.name]: i.value }), {})
      })
    }
    field.type = type.name
  }
  return { field, supportingMessages: messages }
}
export const ScalarTypeToGrpcType = {
  String: 'string',
  bigint: 'int32',
  Int: 'int32',
  Float: 'float',
  float8: 'float',
  Boolean: 'bool',
  ID: 'bytes',
  timestamp: 'string',
  timestampz: 'string'
}
