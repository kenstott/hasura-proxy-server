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
  AUTO_DIRECTIVES
} = altProcess.env
