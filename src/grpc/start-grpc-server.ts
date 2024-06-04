import grpc, { type UntypedHandleCall } from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'
import { ReflectionService } from '@grpc/reflection'
import * as fs from 'fs'
import { type Express } from 'express'
import { type JsonObject, struct } from 'pb-util'
import type { FormattedExecutionResult, GraphQLFormattedError } from 'graphql'
import { type ObjMap } from 'graphql/jsutils/ObjMap'

interface MyProtoBuf extends grpc.ProtobufTypeDefinition {
  GraphQLService: {
    service: grpc.ServiceDefinition
  }
}

interface GraphQLProtoImplementation extends grpc.UntypedServiceImplementation {
  ExecuteQuery: UntypedHandleCall
}

export const startServer = async (app: Express): Promise<void> => {
  const PROTO_PATH = './proto/graphql.proto' // Path to your proto file
  if (!fs.existsSync(PROTO_PATH)) {
    return
  }
  const packageDefinition = protoLoader.loadSync(PROTO_PATH)
  const graphqlProto = grpc.loadPackageDefinition(packageDefinition).graphql as MyProtoBuf
  const server = new grpc.Server()

  const executeGraphQLQuery = (
    operationName: string,
    query: string,
    variables: Record<string, unknown>,
    headers: Record<string, unknown>,
    callback: (_: null, response: { data?: any, errors?: any, extensions?: any }) => void
  ): void => {
    const req = {
      method: 'POST', // HTTP method (e.g., GET, POST, PUT, DELETE)
      url: '/graphql-internal', // URL path
      params: { }, // Route parameters
      query: { }, // Query parameters
      headers: { 'Content-Type': 'application/json', ...headers }, // Request headers
      body: { operationName, query, variables }
    }
    const res = {
      setHeader: function (name: string, value: string) {
        this.header = { ...this.header, [name]: value }
      },
      status: function (code: string) {
        this.statusCode = code
        return this // For method chaining
      },
      send: function (data: string) {
        const parseData = JSON.parse(data) as FormattedExecutionResult
        if (parseData.extensions) {
          parseData.extensions = struct.encode(parseData.extensions as JsonObject) as ObjMap<unknown>
        }
        if (parseData.errors) {
          parseData.errors = parseData.errors.map(i => struct.encode(i as unknown as JsonObject) as GraphQLFormattedError)
        }
        callback(null, parseData)
      }
    }
    const next = function (err: Error): void {
      if (err) {
        console.error('Error handling route:', err)
        // Handle the error (e.g., send an error response)
      } else {
        // Continue to the next middleware or route handler
        console.log('Route handled successfully')
      }
    }

    app._router.handle(req, res, next)
  }

  const reflection = new ReflectionService(packageDefinition)
  reflection.addToServer(server)
  server.addService(graphqlProto.GraphQLService.service, {
    ExecuteQuery: (call, callback) => {
      const headers = call.metadata.getMap()
      let { operationName, query, variables, variablesString } = call.request
      variables = variables || {}
      if (variablesString) {
        variables = JSON.parse(variablesString)
      } else {
        variables = struct.decode(variables)
      }
      executeGraphQLQuery(
        operationName as string,
        query as string,
        variables as Record<string, string>,
        headers as Record<string, string>,
        callback)
    }
  } satisfies GraphQLProtoImplementation)

  server.bindAsync(`${process.env.SERVER_NAME || 'localhost'}:50051`, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      console.error('Failed to bind server:', error)
      return
    }
    console.log('Server bound on port:', port)
    server.start()
  })
}
