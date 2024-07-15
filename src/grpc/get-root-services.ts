import type { Express } from 'express'
import type { UntypedServiceImplementation } from '@grpc/grpc-js/src/server'
import path from 'path'
import { internalProxyGraphQLQuery, traverseDirectories } from '../common/index.js'
import fs from 'fs'
import { type Callback, type ServiceCall } from './start-grpc-server.js'

export const getRootServices = async (app: Express): Promise<Record<string, UntypedServiceImplementation>> => {
  if (!process.env.RESTIFIED_OPS) {
    return {}
  }
  const services = {}
  const basePath = path.resolve(process.env.RESTIFIED_OPS)
  traverseDirectories(basePath, (filePath: string, _stat: fs.Stats) => {
    const restOp = path.basename(filePath)
    if (['get', 'post'].includes(restOp)) {
      const servicePath = path.parse(filePath).dir.replace(basePath, '').split(/[/\\]/).slice(1)
      if (!servicePath.length) {
        const files = fs.readdirSync(filePath).filter((i) => i.toLowerCase().endsWith('.gql'))
        for (const filename of files) {
          const operationName = path.parse(filename).name
          const query = fs.readFileSync(path.resolve(basePath, restOp, filename)).toString('utf-8')
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
      }
    }
  })
  return services
}
