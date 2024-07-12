import { type GraphQLSchema } from 'graphql'
import { generateMessageFromObjectType } from '../grpc/generate-message-from-object-type'
import { type IMessage, Message } from '../grpc/message'
import _ from 'lodash'
import fs from 'fs'
import { staticTypes } from './static-types'

export const generateJsonSchemaFromSdl = (schema: GraphQLSchema): string => {
  const { definitions } = JSON.parse(fs.readFileSync('./json-rpc/graphql-schema.json').toString('utf-8'))
  const { message, supportingMessages } = generateMessageFromObjectType(schema.getQueryType(), {})
  const messages = { ...supportingMessages, [message?.name || '']: message }
  const components = Object.entries(messages)
    .reduce((acc, [name, message]) => {
      return { ...acc, [name]: new Message(message as IMessage).jsonschema() }
    }, { ...staticTypes, ...definitions })
  const jsonRPCCompiledTemplate = _.template(fs.readFileSync('./json-rpc/json-rpc.template').toString('utf-8'))
  const jsonRPCSpecString = jsonRPCCompiledTemplate({
    components: JSON.stringify(components, null, 2),
    server: process.env.JSON_RPC_SERVER ?? 'http://localhost',
    port: process.env.JSON_RPC_HTTP_PORT ?? '3330',
    basePath: process.env.JSON_RPC_BASEPATH ?? 'jsonrpc',
    contentDescriptors: JSON.stringify(definitions, null, 2)
  })
  const parsed = JSON.parse(jsonRPCSpecString)
  return JSON.stringify(parsed, null, 2)
}
