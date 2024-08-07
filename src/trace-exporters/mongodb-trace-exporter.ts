import { type ReadableSpan, type SpanExporter } from '@opentelemetry/sdk-trace-base'
import { type ExportResult, ExportResultCode } from '../common/problem-imports.js'
import { MongoClient } from 'mongodb'
import _ from 'lodash'
import { stringify } from 'flatted'

type MongoDBSpan = ReadableSpan & {
  traceId: string
  spanId: string
  isRemote?: boolean
  traceFlags: number
  timestamp: Date
}

interface MongoDbTraceExporterOptions {
  connectionString?: string
  toConsole?: boolean
  filter?: (span: ReadableSpan) => boolean
  rewriter?: (span: ReadableSpan) => MongoDBSpan
  omitFields?: string[]
}

const defaultRewriter = (span: ReadableSpan): MongoDBSpan => {
  if (span.attributes?.extensionJson) {
    span.attributes.extension = JSON.parse(span.attributes.extensionJson as string)
    delete span.attributes.extensionJson
  }
  return {
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
    isRemote: span.spanContext().isRemote,
    traceFlags: span.spanContext().traceFlags,
    timestamp: new Date(),
    ...span
  }
}
const defaultOmitFields = ['_spanContext', 'instrumentationLibrary', 'resource', '_spanProcessor',
  '_spanLimits', '_droppedAttributesCount', '_droppedEventsCount', '_droppedLinksCount', '_attributeValueLengthLimit',
  '_performanceStartTime', '_performanceOffset', '_startTimeProvided']

export class MongoTraceExporter implements SpanExporter {
  private static readonly _defaultOmitFields: string[] = defaultOmitFields
  private readonly db: MongoClient
  private readonly toConsole: boolean
  private readonly rewriter: (span: ReadableSpan) => MongoDBSpan = defaultRewriter
  private readonly omitFields = MongoTraceExporter._defaultOmitFields

  constructor ({ toConsole, connectionString, filter, rewriter, omitFields }: MongoDbTraceExporterOptions) {
    this.toConsole = toConsole ?? true
    if (connectionString) {
      this.db = new MongoClient(connectionString)
    }
    this.filter = filter || this.filter
    this.rewriter = rewriter || this.rewriter
    this.omitFields = MongoTraceExporter._defaultOmitFields || omitFields
  }

  get defaultOmitFields (): string[] {
    return MongoTraceExporter._defaultOmitFields
  }

  export (spans: any[], resultCallback: (result: ExportResult) => void): void {
    const documents = spans.filter(this.filter).map((span: ReadableSpan) => {
      return this.rewriter(span)
    })

    if (this.db !== undefined && documents.length) {
      const directiveNames = [...new Set(documents.map(i => i.attributes?.directiveName ?? 'other'))] as string[]

      for (const directiveName of directiveNames) {
        const collection = this.db.db().collection(directiveName)
        collection.insertMany(documents.map(i => _.omit(i, this.omitFields)).filter(i => i.attributes?.directiveName === directiveName || (!i.attributes?.directiveName && directiveName === 'other'))).then(() => {
          if (directiveName === directiveNames[directiveNames.length - 1]) {
            resultCallback({ code: ExportResultCode.SUCCESS })
          }
        }).catch((error) => {
          resultCallback({ code: ExportResultCode.FAILED, error })
        })
      }
    }
    if (this.toConsole && documents.length) {
      for (const document of documents) {
        console.info(stringify(document, undefined, 2))
      }
      resultCallback({ code: ExportResultCode.SUCCESS })
    }
  }

  async shutdown (): Promise<void> {
    // Clean up any resources if needed
    await this.db.close()
  }

  private readonly filter = (span: ReadableSpan): boolean => !!span
}
