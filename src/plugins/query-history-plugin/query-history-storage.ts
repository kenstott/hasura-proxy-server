import { MongoClient, type WithId } from 'mongodb'
import { type TypeFieldPair, type ObjMap } from '../helpers/index.js'
import _ from 'lodash'
import { type VariableValues } from '../../plugin-builder/index.js'

interface StoreQueryResultsOptions {
  operationName: string
  query: string
  fields: TypeFieldPair
  timeField?: string
  metaFields?: string[]
  collection?: string
  ttlDays?: number
  variables: VariableValues
  granularity?: Granularity
  root: string
  dataset: Array<ObjMap<unknown>>
  queryID: string
}

interface HistoricalRecordMetadata extends Record<string, unknown> {
  fields: Array<{ field: string, type: string }>
  operationName: string
  query: string
  root: string
}
interface HistoricalRecord extends Record<string, unknown> {
  _timestamp: Date
  metadata: HistoricalRecordMetadata
  queryID: string
}

export class QueryHistoryStorage {
  private readonly db: Promise<MongoClient>

  constructor (connectionString: string) {
    if (connectionString) {
      this.db = MongoClient.connect(connectionString)
    }
  }

  retrieveQueryResults = async (queryID: string, collection?: string): Promise<Record<string, Array<Record<string, unknown>>>> => {
    const db = (await this.db).db()
    collection = collection ?? 'QueryHistory'
    const results = await db.collection(collection).find({ queryID }, { projection: { _timestamp: 0, queryID: 0, _id: 0 } }).toArray() as Array<WithId<HistoricalRecord>>
    return results.reduce((acc: Record<string, Array<Record<string, unknown>>>, record: HistoricalRecord) =>
      ({ ...acc, [record.metadata.root]: [...(acc[record.metadata.root] || []), _.omit(record, ['metadata'])] })
    , {} satisfies Record<string, Array<Record<string, unknown>>>)
  }

  storeQueryResults = async ({
    collection,
    ttlDays,
    query,
    timeField,
    fields,
    metaFields,
    granularity,
    operationName,
    root,
    dataset,
    queryID
  }: StoreQueryResultsOptions): Promise<void> => {
    const db = (await this.db).db()
    ttlDays = ttlDays ?? 120
    collection = collection ?? 'QueryHistory'
    granularity = granularity ?? Granularity.seconds
    metaFields = metaFields ?? []
    timeField = timeField ?? '_timestamp'

    const _timestamp = new Date()
    const metadata = {
      operationName,
      query,
      fields,
      root
    }
    const collectionExists = await db.listCollections({ name: collection }).hasNext()
    if (!collectionExists) {
      await db.createCollection(collection, {
        timeseries: {
          timeField,
          metaField: 'metadata',
          granularity: Object.keys(Granularity)[granularity]
        },
        expireAfterSeconds: ttlDays * 86400
      })
    }
    const timeseriesDataset = dataset.map(i => ({
      ...i,
      queryID,
      _timestamp,
      metadata: { ...metadata, ..._.pick(i, metaFields) }
    }))
    await db.collection(collection).insertMany(timeseriesDataset)
  }
}

export enum Granularity {
  hours = 'HOURS',
  minutes = 'MINUTES',
  seconds = 'SECONDS'
}
