import { type GraphQLSchema } from 'graphql'
import * as fs from 'fs'
import _ from 'lodash'
import { generateMessageFromObjectType } from './generate-message-from-object-type'
import { type IMessage, Message } from './message'

export const generateProtoFromSdl = (schema: GraphQLSchema): string => {
  const { message, supportingMessages } = generateMessageFromObjectType(schema.getQueryType(), {})
  const messages = { ...supportingMessages, [message?.name || '']: message }
  const proto = Object.values(messages)
    .map(i => new Message(i as IMessage).print()).join('\n')
  const compiled = _.template(fs.readFileSync('./proto/graphql.proto.template').toString('utf-8'))
  return compiled({ query_root: message?.name, messages: proto })
}
