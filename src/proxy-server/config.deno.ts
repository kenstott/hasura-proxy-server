import {altProcess} from "../common/index.ts";
import {config} from 'dotenv'

config({path: '.deno.env'})
export const {
    HASURA_URI,
    HASURA_ADMIN_SECRET,
    PORT,
    PLUGINS,
    OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_SERVICE_NAME,
    MONGODB_CONNECTION_STRING,
    MONGODB_TO_CONSOLE
} = altProcess.env
