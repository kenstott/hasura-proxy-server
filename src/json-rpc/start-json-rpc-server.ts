import { Server } from '@open-rpc/server-js'
import { type HTTPServerTransportOptions } from '@open-rpc/server-js/build/transports/http'
import { type WebSocketServerTransportOptions } from '@open-rpc/server-js/build/transports/websocket'
import { parseOpenRPCDocument } from '@open-rpc/schema-utils-js'
import { type Express } from 'express'
import { type MethodMapping } from '@open-rpc/server-js/build/router'
import fs from 'fs'
import { executeGraphQLQuery } from '../grpc/execute-graph-ql-query'
import { type FormattedExecutionResult } from 'graphql/execution'
import { type TransportNames, type TransportOptions } from '@open-rpc/server-js/build/transports'
import { spanError, spanOK, startActiveTrace } from '../proxy-server/telemetry'
import { type Span } from '@opentelemetry/api'

interface TransportConfig {
  type: TransportNames
  options: TransportOptions
}
export async function startServer (app: Express): Promise<void> {
  await startActiveTrace(import.meta.url, async (span: Span) => {
    try {
      const methodMapping: MethodMapping = {
        query: async (operationName: string, query: string, variables: Record<string, any>, secret: string): Promise<FormattedExecutionResult> => {
          variables = variables ?? {}
          const headers = { 'x-hasura-admin-secret': secret }
          return await new Promise<FormattedExecutionResult>((resolve, _reject) => {
            executeGraphQLQuery(app)({
              operationName,
              query,
              variables,
              headers,
              callback: (_, result) => {
                resolve(result)
              }
            })
          })
        }
      }
      const spec =
          fs.readFileSync(process.env.JSON_RPC_SPEC_PATH ?? './json-rpc/graphql.rpc-spec')
            .toString('utf-8')

      const openrpcDocument = await parseOpenRPCDocument(spec, { dereference: false })
      const transportConfigs: TransportConfig[] = []
      if (process.env.JSON_RPC_HTTP_PORT) {
        transportConfigs.push({
          type: 'HTTPTransport',
          options: {
            port: parseInt(process.env.JSON_RPC_HTTP_PORT ?? '3330'),
            middleware: []
          } satisfies HTTPServerTransportOptions
        })
      }
      if (process.env.JSON_RPC_SOCKETS_PORT) {
        transportConfigs.push({
          type: 'WebSocketTransport',
          options: {
            port: parseInt(process.env.JSON_RPC_SOCKETS_PORT ?? '3331'),
            middleware: []
          } satisfies WebSocketServerTransportOptions
        })
      }
      const server = new Server({ openrpcDocument, transportConfigs, methodMapping })
      server.start()
      spanOK(span)
    } catch (e) {
      spanError(span, e as Error)
    } finally {
      span.end()
    }
  })
}
