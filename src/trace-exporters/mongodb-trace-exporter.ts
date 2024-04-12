import { type ReadableSpan, type SpanExporter } from '@opentelemetry/sdk-trace-base'
import { type ExportResult, ExportResultCode } from '../common/problem-imports.js'
import { MongoClient } from 'mongodb'
import _ from 'lodash'

export class MongoTraceExporter implements SpanExporter {
  private readonly db: MongoClient
  private readonly toConsole: boolean

  constructor (connectionString: string, toConsole: boolean, filter?: (span: ReadableSpan) => boolean) {
    if (toConsole) {
      this.toConsole = toConsole
    }
    if (connectionString) {
      this.db = new MongoClient(connectionString)
    }
    if (filter) {
      this.filter = filter
    }
  }

  export (spans: any[], resultCallback: (result: ExportResult) => void): void {
    const documents = spans.filter(this.filter).map((span: ReadableSpan) => {
      if (span.attributes?.extensionJson) {
        span.attributes.extension = JSON.parse(span.attributes.extensionJson as string)
        delete span.attributes.extensionJson
      }
      return {
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        timestamp: new Date(),
        ..._.omit(span, ['_spanContext', 'instrumentationLibrary', 'resource', '_spanProcessor',
          '_spanLimits', '_droppedAttributesCount', '_droppedEventsCount', '_droppedLinksCount', '_attributeValueLengthLimit',
          '_performanceStartTime', '_performanceOffset', '_startTimeProvided'])
      }
    })

    if (this.toConsole && documents.length) {
      for (const document of documents) {
        console.log(JSON.stringify(document, null, 2))
      }
      resultCallback({ code: ExportResultCode.SUCCESS })
    }
    if (this.db !== undefined && documents.length) {
      const directiveNames = [...new Set(documents.map(i => i.attributes?.directiveName ?? ''))] as string[]

      for (const directiveName of directiveNames) {
        const collection = this.db.db().collection(directiveName)
        collection.insertMany(documents.filter(i => i.attributes?.directiveName === directiveName)).then(() => {
          if (directiveName === directiveNames[directiveNames.length - 1]) {
            resultCallback({ code: ExportResultCode.SUCCESS })
          }
        }).catch((error) => {
          resultCallback({ code: ExportResultCode.FAILED, error })
        })
      }
    }
  }

  async shutdown (): Promise<void> {
    // Clean up any resources if needed
    await this.db.close()
  }

  private readonly filter = (span: ReadableSpan): boolean => !!span
}
