import {
  altProcess,
  ConsoleMetricExporter,
  ConsoleSpanExporter,
  OTLPTraceExporter,
  PeriodicExportingMetricReader,
  type MetricReader
} from '../common/index.js'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { type ReadableSpan, SimpleSpanProcessor, type SpanExporter } from '@opentelemetry/sdk-trace-base'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { type Attributes, type Span, SpanStatusCode, trace } from '@opentelemetry/api'
import {
  MONGODB_CONNECTION_STRING, MONGODB_TRACE_FILTERS,
  MONGODB_TO_CONSOLE,
  OTEL_EXPORTER_OTLP_ENDPOINT,
  OTEL_SERVICE_NAME
} from './config.js'
import { MongoTraceExporter } from '../trace-exporters/mongodb-trace-exporter.js'
import { NodeSDK } from '@opentelemetry/sdk-node'
import _ from 'lodash'

const spanProcessors = [new SimpleSpanProcessor(new ConsoleSpanExporter() as SpanExporter) as any]
const consoleMetricExporter = new ConsoleMetricExporter()
let oltpMetricExports: OTLPMetricExporter | null = null
if (OTEL_EXPORTER_OTLP_ENDPOINT) {
  spanProcessors.push(new SimpleSpanProcessor(new OTLPTraceExporter({ url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` }) as SpanExporter) as any)
  oltpMetricExports = new OTLPMetricExporter({ url: `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics` })
}
const exporter = oltpMetricExports ?? consoleMetricExporter

if (MONGODB_TO_CONSOLE || MONGODB_CONNECTION_STRING) {
  const spanFilters = (MONGODB_TRACE_FILTERS || '').split(',').map(i => {
    const [, name, op, value] = [...i.match(/([A-Za-z0-9._-]+)(=|<>|>|<|=>|=<)(.*)/) || []]
    if (_.isNumber(value)) {
      return { name, op, value: parseFloat(value) }
    }
    return { name, op, value }
  })
  const matchSpanNameAndValue = (span: ReadableSpan): boolean => {
    for (const entry of spanFilters) {
      const { name, op, value } = entry
      const realValue: string | number | undefined = _.get(span, name)
      if (realValue) {
        switch (op) {
          case '=':
            if (value === realValue) {
              return true
            }
            break
          case '<>':
            if (value !== realValue) {
              return true
            }
            break
          case '>':
            if (value > realValue) {
              return true
            }
            break
          case '<':
            if (value < realValue) {
              return true
            }
            break
          case '>=':
            if (value >= realValue) {
              return true
            }
            break
          case '<=':
            if (value <= realValue) {
              return true
            }
            break
        }
      }
    }
    return false
  }
  const mongodbTraceExporter = new MongoTraceExporter({
    connectionString: MONGODB_CONNECTION_STRING,
    toConsole: MONGODB_TO_CONSOLE === 'true',
    filter: matchSpanNameAndValue
  })
  const mongoSpanProcessor = new SimpleSpanProcessor(mongodbTraceExporter)
  spanProcessors.push(mongoSpanProcessor)
}

const sdk = new NodeSDK({
  spanProcessors,
  metricReader: (new PeriodicExportingMetricReader({ exporter })) as MetricReader,
  autoDetectResources: true,
  instrumentations: [getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } })]
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

export const startActiveTrace = async <T>(name: string, fn: (span?: Span) => Promise<T>): Promise<T> => {
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
