import grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { ReflectionService } from '@grpc/reflection'
import * as fs from 'fs'
import { type Express } from 'express'
import { type Struct, struct } from 'pb-util'
import { executeGraphQLQuery } from './execute-graph-ql-query'
import { type FormattedExecutionResult } from 'graphql/execution'

interface ServiceCall {
  metadata: {
    getMap: () => Record<string, unknown> }
  request: { operationName: any, query: any, variablesStruct: any, variablesString: any }
}

type Callback = (_: null, response: FormattedExecutionResult) => void

export const startServer = async (app: Express): Promise<void> => {
  if (!fs.existsSync(process.env.PROTO_PATH || '')) {
    return
  }
  const packageDefinition = protoLoader.loadSync(process.env.PROTO_PATH || '')
  const graphqlProto = grpc.loadPackageDefinition(packageDefinition).graphql as grpc.GrpcObject
  const graphQLService = (graphqlProto.GraphQLService as grpc.ServiceClientConstructor).service
  const server = new grpc.Server()
  const reflection = new ReflectionService(packageDefinition)
  reflection.addToServer(server)
  server.addService(graphQLService, {
    ExecuteQuery: (call: ServiceCall, callback: Callback) => {
      const headers = call.metadata.getMap()
      const { operationName, query, variablesStruct, variablesString } = call.request
      const variables = variablesString ? JSON.parse(variablesString as string) : struct.decode((variablesStruct ?? {}) as Struct)
      executeGraphQLQuery(app)({ operationName, query, variables, headers, callback })
    }
  })

  server.bindAsync(`${process.env.SERVER_NAME || 'localhost'}:50051`, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      console.error('Failed to bind server:', error)
    } else {
      console.log('GRPC Server bound on port:', port)
    }
  })
}
