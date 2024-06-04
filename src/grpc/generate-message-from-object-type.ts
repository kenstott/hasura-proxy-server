import type { GraphQLObjectType } from 'graphql'

import { generateFieldFromType } from './generate-field-from-type'
import { type IMessage } from './message'

export const generateMessageFromObjectType = (type?: GraphQLObjectType | null, messages?: Record<string, Partial<IMessage>>): { message?: Partial<IMessage>, supportingMessages?: Record<string, Partial<IMessage>> } => {
  if (type) {
    messages = messages ?? {}
    const message: IMessage = { name: type.name, fields: [] }
    const queryFields = Object.entries(type.getFields() ?? {})
    for (const [name, queryField] of queryFields) {
      const response = generateFieldFromType(name, queryField.type, {}, messages)
      message.fields.push(response.field)
      messages = { ...response.supportingMessages }
    }
    return { message, supportingMessages: messages }
  }
  return { message: undefined, supportingMessages: messages }
}
