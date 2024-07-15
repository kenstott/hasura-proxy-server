import { config } from 'dotenv'
import { altProcess } from '../common/index.js'

// @ts-expect-error Deno is only available when running under Deno engine
if (typeof Deno !== 'undefined') {
  config({ path: '.deno.env' })
} else {
  config({ path: '.env' })
}

export const {
  HASURA_URI,
  HASURA_ADMIN_SECRET,
  PORT,
  PLUGINS,
  OTEL_EXPORTER_OTLP_ENDPOINT,
  OTEL_SERVICE_NAME,
  MONGODB_CONNECTION_STRING,
  MONGODB_TO_CONSOLE,
  MONGODB_TRACE_FILTERS,
  AUTO_DIRECTIVES,
  JSON_RPC_BASEPATH,
  JSON_RPC_HTTP_PORT,
  JSON_RPC_PATH_SEPARATOR,
  JSON_RPC_SERVER,
  JSON_RPC_SOCKETS_PORT,
  JSON_RPC_SPEC_PATH,
  GRPC_PORT
} = altProcess.env
