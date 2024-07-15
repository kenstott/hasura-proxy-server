import { type GraphQLSchema } from 'graphql'
import _ from 'lodash'
import fs from 'fs'
import { staticTypes } from './static-types.js'
import { generateMessagesAndServices } from '../service-definition/index.js'

export const generateJsonSchemaFromSdl = (schema: GraphQLSchema): string => {
  const { definitions } = JSON.parse(fs.readFileSync('./json-rpc/graphql-schema.json').toString('utf-8'))
  const { services, messages } = generateMessagesAndServices(schema)
  const components = Object.entries(messages)
    .reduce((acc, [name, message]) => {
      return { ...acc, [name]: message?.jsonSchema?.() }
    }, { ...staticTypes, ...definitions })
  const methods = _.flatten(Object.entries(services)
    .map(([service, rpcs]) =>
      Object.entries(rpcs).map(([rpcName, rpc]) => rpc.jsonRpc())))
  const jsonRPCCompiledTemplate = _.template(fs.readFileSync('./json-rpc/json-rpc.template').toString('utf-8'))
  const jsonRPCSpecString = jsonRPCCompiledTemplate({
    components: JSON.stringify(components, null, 2),
    server: process.env.JSON_RPC_SERVER ?? 'http://localhost',
    port: process.env.JSON_RPC_HTTP_PORT ?? '3330',
    basePath: process.env.JSON_RPC_BASEPATH ?? 'jsonrpc',
    contentDescriptors: JSON.stringify(definitions, null, 2),
    methods: methods.length ? ',' + JSON.stringify(methods).slice(1, -1) : ''
  })
  const parsed = JSON.parse(jsonRPCSpecString)
  return JSON.stringify(parsed, null, 2)
}
