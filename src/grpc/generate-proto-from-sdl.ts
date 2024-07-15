import { type GraphQLSchema } from 'graphql'
import * as fs from 'fs'
import _ from 'lodash'
import { generateMessagesAndServices } from '../service-definition/index.js'

export const generateProtoFromSdl = (schema: GraphQLSchema): string => {
  const { queryRoot, messages, services } = generateMessagesAndServices(schema)
  const rootServices = Object.entries(services.GraphQLService ?? {})
    .map(([_name, rpc]) => rpc.print()).join('\n  ')
  const otherServices = Object.entries(services)
    .filter(([serviceName, _remoteProcedureCalls]) => serviceName !== 'GraphQLService')
    .map(([serviceName, remoteProcedureCalls]) =>
            `service ${serviceName} {\n` +
            Object.entries(remoteProcedureCalls).map(([_name, remoteProcedureCall]) => '  ' + remoteProcedureCall.print())
              .join('\n') + '\n}')
  const proto = Object.values(messages)
    .map(i => i?.print?.() || '').join('\n')
  const compiled = _.template(fs.readFileSync('./proto/graphql.proto.template').toString('utf-8'))
  return compiled({
    query_root: queryRoot?.name,
    messages: proto,
    rootServices,
    otherServices: otherServices.join('\n')
  })
}
