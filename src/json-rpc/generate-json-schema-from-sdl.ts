import { type GraphQLSchema } from 'graphql'
import { generateMessageFromObjectType } from '../grpc/generate-message-from-object-type'
import { type IMessage, Message } from '../grpc/message'
import _ from 'lodash'
import fs from 'fs'

export const generateJsonSchemaFromSdl = (schema: GraphQLSchema): string => {
  const { message, supportingMessages } = generateMessageFromObjectType(schema.getQueryType(), {})
  const messages = { ...supportingMessages, [message?.name || '']: message }
  const components = Object.entries(messages)
    .reduce((acc, [name, message]) => {
      return { ...acc, [name]: new Message(message as IMessage).jsonschema() }
    }, {})
  const compiled = _.template(fs.readFileSync('./json-rpc/json-rpc.template').toString('utf-8'))
  const test = compiled({
    components: JSON.stringify(components, null, 2),
    server: process.env.JSON_RPC_SERCER ?? 'localhost',
    port: process.env.JSON_RPC_HTTP_PORT ?? '3330',
    basePath: process.env.JSON_RPC_BASEPATH ?? 'jsonrpc'
  })
  const parsed = JSON.parse(test)
  return JSON.stringify(parsed, null, 2)
}
