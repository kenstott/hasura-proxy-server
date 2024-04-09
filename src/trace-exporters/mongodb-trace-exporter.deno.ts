import {type ReadableSpan, type SpanExporter} from 'npm:@opentelemetry/sdk-trace-base'
import {type ExportResult, ExportResultCode} from 'npm:@opentelemetry/core'
import {MongoClient} from 'npm:mongodb'
import _ from 'npm:lodash'

export class MongoTraceExporter implements SpanExporter {
    private readonly db: Promise<MongoClient>
    private readonly toConsole: boolean

    constructor(connectionString: string, toConsole: boolean, filter?: (span: ReadableSpan) => boolean) {
        if (toConsole) {
            this.toConsole = toConsole
        } else {
            this.db = MongoClient.connect(connectionString)
        }
        if (filter) {
            this.filter = filter
        }
    }

    export(spans: any[], resultCallback: (result: ExportResult) => void): void {
        const documents = spans.filter(this.filter).map((span: ReadableSpan) => {
            if (span.attributes?.extensionJson) {
                span.attributes.extension = JSON.parse(span.attributes.extensionJson as string)
                delete span.attributes.extensionJson
            }
            return {
                traceId: span.spanContext().traceId,
                spanId: span.spanContext().spanId,
                ..._.omit(span, ['spanContext', 'instrumentationLibrary', 'resource'])
            }
        })

        if (this.toConsole) {
            for (const document of documents) {
                console.log(JSON.stringify(document, null, 2))
            }
            resultCallback({code: ExportResultCode.SUCCESS})
        } else {
            const directiveNames = [...new Set(documents.map(i => i.attributes.directiveName ?? ''))] as string[]
            this.db.then(db => {
                for (const directiveName of directiveNames) {
                    const collection = db.db().collection(directiveName)
                    collection.insertMany(documents.filter(i => i.attributes.directiveName === directiveName)).then(() => {
                        if (directiveName === directiveNames[directiveNames.length - 1]) {
                            resultCallback({code: ExportResultCode.SUCCESS})
                        }
                    })
                }
            }).catch(error => {
                resultCallback({code: ExportResultCode.FAILED, error})
            })
        }
    }

    async shutdown(): Promise<void> {
        // Clean up any resources if needed
        return await this.db.then((client) => client.close())
    }

    private readonly filter = (span: ReadableSpan): boolean => !!span
}
