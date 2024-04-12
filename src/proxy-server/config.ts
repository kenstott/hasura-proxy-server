import { config } from 'dotenv'
import { altProcess } from '../common/index.js'

// @ts-expect-error
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
  MONGODB_SPAN_ATTRIBUTE_FILTERS
} = altProcess.env
