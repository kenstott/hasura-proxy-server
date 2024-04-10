import process from 'node:process'
import path from 'node:path'

export * from 'graphql'

export { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
export { ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
export { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
export const altProcess = process
export const altPath = path
