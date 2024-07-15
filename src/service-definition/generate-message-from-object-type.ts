import { type GraphQLArgument, type GraphQLInputObjectType, type GraphQLObjectType, type GraphQLType } from 'graphql'
import { generateFieldFromType } from './generate-field-from-type.js'
import { Message } from './message.js'
import { Field } from './field.js'
import { type Enum } from './enum.js'

export const generateMessageFromObjectType = (type?: GraphQLObjectType | GraphQLInputObjectType | null, messages?: Record<string, Partial<Message | Enum>>): {
  message?: Message | Enum
  supportingMessages?: Record<string, Partial<Message | Enum>>
} => {
  if (type) {
    messages = messages ?? {}
    const message = new Message({ name: type.name, fields: [] })
    const queryFields = Object.entries(type.getFields() ?? {})
    for (const [name, queryField] of queryFields) {
      const response = generateFieldFromType({ name, type: (queryField.type as GraphQLType), field: {}, messages })
      message.fields.push(new Field(response.field))
      messages = { ...messages, ...response.supportingMessages }
      for (const arg of queryField.args ?? [] as GraphQLArgument[]) {
        const argResponse = generateFieldFromType({
          name: (arg.name as string),
          type: arg.type as GraphQLType,
          field: {},
          messages
        })
        messages = { ...messages, ...argResponse.supportingMessages }
      }
    }
    return { message, supportingMessages: messages }
  }
  return { message: undefined, supportingMessages: messages }
}
