import { Server } from '@open-rpc/server-js'
import { type HTTPServerTransportOptions } from '@open-rpc/server-js/build/transports/http'
import { type WebSocketServerTransportOptions } from '@open-rpc/server-js/build/transports/websocket'
import { parseOpenRPCDocument } from '@open-rpc/schema-utils-js'
import { type Express } from 'express'
import { type MethodMapping } from '@open-rpc/server-js/build/router'
import fs from 'fs'
import { type TransportNames, type TransportOptions } from '@open-rpc/server-js/build/transports'
import { spanError, spanOK, startActiveTrace } from '../proxy-server/telemetry'
import { type Span } from '@opentelemetry/api'
import assert from 'assert'
import _ from 'lodash'
import { getMethodMapping } from './get-method-mapping.js'
import { generateServices } from '../service-definition/index.js'

interface TransportConfig {
  type: TransportNames
  options: TransportOptions
}

export async function startServer (app: Express): Promise<void> {
  assert(app, 'app must be defined')
  assert(process.env.JSON_RPC_HTTP_PORT || process.env.JSON_RPC_SOCKETS_PORT, 'env variables JSON_RPC_HTTP_PORT or JSON_RPC_SOCKETS_PORT must be defined')
  await startActiveTrace(import.meta.url, async (span: Span) => {
    try {
      const { services: serviceResponse } = generateServices()
      const methods = _.flatten<Record<string, any>>((Object.entries(serviceResponse)
        .map(([_service, rpcs]) =>
          Object.entries(rpcs).map(([_rpcName, rpc]) => rpc.jsonRpc())) as never[]))
      const methodMapping: MethodMapping = getMethodMapping(app, methods)
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
