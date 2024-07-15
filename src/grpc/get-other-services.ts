import type { Express } from 'express'
import type grpc from '@grpc/grpc-js'
import path from 'path'
import { internalProxyGraphQLQuery, traverseDirectories } from '../common/index.js'
import fs from 'fs'
import { type Callback, type ServiceCall } from './start-grpc-server.js'

export const getOtherServices = async (app: Express, server: grpc.Server, graphqlProto: grpc.GrpcObject): Promise<void> => {
  if (!process.env.RESTIFIED_OPS) {
    return
  }
  const basePath = path.resolve(process.env.RESTIFIED_OPS)
  traverseDirectories(basePath, (filePath: string, _stat: fs.Stats) => {
    const restOp = path.basename(filePath)
    const services = {}
    if (['get', 'post'].includes(restOp)) {
      const servicePath = path.parse(filePath).dir.replace(basePath, '')
        .split(/[/\\]/).slice(1).join(process.env.JSON_RPC_PATH_SEPARATOR || '__')
      if (servicePath.length) {
        const service = (graphqlProto[servicePath + 'Service'] as grpc.ServiceClientConstructor).service
        const files = fs.readdirSync(filePath).filter((i) => i.toLowerCase().endsWith('.gql'))
        for (const filename of files) {
          const operationName = path.parse(filename).name
          const query = fs.readFileSync(path.resolve(filePath, filename)).toString('utf-8')
          server.unregister('/graphql.' + servicePath + 'Service' + '/' + operationName)
          services[operationName] = (call: ServiceCall, callback: Callback) => {
            internalProxyGraphQLQuery(app)({
              operationName,
              query,
              variables: call.request,
              headers: { ...call.metadata.getMap(), 'x-grpc': 'true' },
              callback
            })
          }
        }
        server.addService(service, services)
      }
    }
  })
}
