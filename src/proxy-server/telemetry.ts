import {
  altProcess,
  ConsoleMetricExporter,
  ConsoleSpanExporter,
  OTLPTraceExporter,
  PeriodicExportingMetricReader,
  type MetricReader
} from '../common/index.js'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { SimpleSpanProcessor, type SpanExporter } from '@opentelemetry/sdk-trace-base'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { type Attributes, type Span, SpanStatusCode, trace } from '@opentelemetry/api'
import {
  MONGODB_CONNECTION_STRING, MONGODB_SPAN_ATTRIBUTE_FILTERS,
  MONGODB_TO_CONSOLE,
  OTEL_EXPORTER_OTLP_ENDPOINT,
  OTEL_SERVICE_NAME
} from './config.js'
import { MongoTraceExporter } from '../trace-exporters/mongodb-trace-exporter.js'
import { NodeSDK } from '@opentelemetry/sdk-node'

const spanProcessors = [new SimpleSpanProcessor(new ConsoleSpanExporter() as SpanExporter) as any]
const consoleMetricExporter = new ConsoleMetricExporter()
let oltpMetricExports: OTLPMetricExporter | null = null
if (OTEL_EXPORTER_OTLP_ENDPOINT) {
  spanProcessors.push(new SimpleSpanProcessor(new OTLPTraceExporter({ url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` }) as SpanExporter) as any)
  oltpMetricExports = new OTLPMetricExporter({ url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics` })
}
const exporter = oltpMetricExports ?? consoleMetricExporter

if (MONGODB_TO_CONSOLE || MONGODB_CONNECTION_STRING) {
  const spanFilters = (MONGODB_SPAN_ATTRIBUTE_FILTERS || '').split(',').map(i => {
    const [name, value] = i.split(':')
    return { name, value }
  })
  const matchSpanAttributeNameAndValue = (attributes: Attributes): boolean => {
    return Object.entries(attributes).reduce((acc, [name, value]) => {
      return acc && spanFilters.findIndex(i => i.name === name && i.value === value) === -1
    }, true)
  }
  const mongodbTraceExporter = new MongoTraceExporter(
    MONGODB_CONNECTION_STRING ?? '',
    MONGODB_TO_CONSOLE === 'true',
    (span) => !!span.attributes.directiveName && matchSpanAttributeNameAndValue(span.attributes))
  const mongoSpanProcessor = new SimpleSpanProcessor(mongodbTraceExporter)
  spanProcessors.push(mongoSpanProcessor)
}

const sdk = new NodeSDK({
  spanProcessors,
  metricReader: (new PeriodicExportingMetricReader({ exporter })) as MetricReader,
  autoDetectResources: true,
  instrumentations: [getNodeAutoInstrumentations()]
})

sdk.start()

altProcess.on('SIGTERM', () => {
  sdk.shutdown().then(
    () => {
      console.log('SDK shut down successfully')
    },
    (err: any) => {
      console.log('Error shutting down SDK', err)
    }
  ).finally(() => altProcess.exit(0))
})

export const startActiveTrace = <T>(name: string, fn: (span?: Span) => Promise<T>): T => {
  return trace.getTracer(OTEL_SERVICE_NAME ?? 'hasura-plugin-proxy', '1').startActiveSpan(name.split('/').pop() ?? 'unknown', async (span) => {
    try {
      const result = await fn(span)
      spanOK(span)
      return result
    } catch (error) {
      spanError(span, error as Error)
    } finally {
      span.end()
    }
  }) as T
}

export const spanError = (span: Span, error: Error): void => {
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message
  })
}

export const spanOK = (span: Span, attributes?: Attributes): void => {
  if (attributes) {
    span.setAttributes(attributes)
  }
  span.setStatus({ code: SpanStatusCode.OK })
}
