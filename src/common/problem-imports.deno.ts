import path from "node:path";
import process from 'node:process'

export * from 'npm:graphql@16.8.1'

export {ConsoleSpanExporter} from 'npm:@opentelemetry/sdk-trace-node'
export {ConsoleMetricExporter, PeriodicExportingMetricReader} from 'npm:@opentelemetry/sdk-metrics'
export {OTLPTraceExporter} from 'npm:@opentelemetry/exporter-trace-otlp-proto'
export const altProcess = process
export const altPath = path