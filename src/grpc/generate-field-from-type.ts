import { type GraphQLType, isListType, isNonNullType, isObjectType, isScalarType } from 'graphql'
import { generateMessageFromObjectType } from './generate-message-from-object-type'
import { type IField } from './field'
import { type IMessage } from './message'

export const generateFieldFromType = (name: string, type: GraphQLType, field: Partial<IField>, messages?: Record<string, Partial<IMessage>>): { field: Partial<IField>, supportingMessages: Record<string, Partial<IMessage>> } => {
  field.name = name
  messages = messages ?? {}
  if (isNonNullType(type)) {
    const response = generateFieldFromType(name, type.ofType, field, messages)
    messages = { ...messages, ...response.supportingMessages }
    field = response.field
  } else if (isListType(type)) {
    field.repeated = true
    delete field.required
    const response = generateFieldFromType(name, type.ofType, field, messages)
    messages = { ...messages, ...response.supportingMessages }
    field = response.field
  } else if (isScalarType(type)) {
    field.type = ScalarTypeToGrpcType[type.name]
  } else if (isObjectType(type)) {
    field.type = type.name
    if (!messages[type.name]) {
      messages = { ...messages, [type.name]: {} }
      const response = generateMessageFromObjectType(type, messages)
      messages = {
        ...messages,
        ...response.supportingMessages,
        [type.name]: response.message as IMessage
      }
    }
  }
  return { field, supportingMessages: messages }
}
const ScalarTypeToGrpcType = {
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
