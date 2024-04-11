import { MongoClient } from 'mongodb'
import { type TypeFieldPair } from '../helpers/get-type-field-pairs'
import { type ObjMap } from '../helpers/index.js'
import _ from 'lodash'
import { type VariableValues } from '../../plugin-builder'

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
  dataset: Array<ObjMap<unknown>>
}

export class QueryHistoryStorage {
  private readonly db: Promise<MongoClient>

  constructor (connectionString: string) {
    if (connectionString) {
      this.db = MongoClient.connect(connectionString)
    }
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
    dataset
  }: StoreQueryResultsOptions): Promise<void> => {
    const db = (await this.db).db()
    timeField = timeField ?? '_timestamp'
    ttlDays = ttlDays ?? 120
    collection = collection ?? 'QueryHistory'
    granularity = granularity ?? Granularity.seconds
    metaFields = metaFields ?? []
    const _timestamp = new Date()
    const metadata = {
      operationName,
      query,
      fields
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
