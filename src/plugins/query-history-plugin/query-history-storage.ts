import { MongoClient, type SortDirection, type WithId } from 'mongodb'
import { type TypeFieldPair, type ObjMap } from '../helpers/index.js'
import _ from 'lodash'
import { type VariableValues } from '../../plugin-builder/index.js'
import diff from 'deep-diff'
import objectHash from 'object-hash'

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
  replayID: string
  clean?: boolean
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
  replayID: string
}

interface RetrieveResultsOptions {
  replayID?: string
  collection?: string
  replayTo?: string
  replayFrom?: string
  timeField?: string
  operationName?: string
  deltaKey?: string
  clean?: boolean
  fields: TypeFieldPair
}

export class QueryHistoryStorage {
  private readonly db: Promise<MongoClient>

  constructor (connectionString: string) {
    if (connectionString) {
      this.db = MongoClient.connect(connectionString)
    }
  }

  retrieveQueryResults = async ({
    replayID,
    collection,
    replayTo,
    replayFrom,
    timeField,
    operationName,
    deltaKey, clean, fields
  }: RetrieveResultsOptions): Promise<Record<string, Array<Record<string, unknown>>>> => {
    const db = (await this.db).db()
    collection = collection ?? 'QueryHistory'
    timeField = timeField ?? '_timestamp'
    let results: Array<Record<string, unknown>>
    if ((replayFrom || replayTo) && operationName) {
      let to: Date, from: Date
      if (replayTo && _.isNumber(replayTo) && parseInt(replayTo) < 0) {
        const date = new Date()
        date.setDate(date.getDate() + parseInt(replayTo))
        to = date
      } else {
        to = replayTo ? new Date(replayTo.toString()) : new Date(3000, 1, 1)
      }
      if (replayFrom && _.isNumber(replayFrom) && parseInt(replayFrom) < 0) {
        const date = new Date()
        date.setDate(date.getDate() + parseInt(replayFrom))
        from = date
      } else {
        from = replayFrom ? new Date(replayFrom.toString()) : new Date(3000, 1, 1)
      }
      const sort: Record<string, SortDirection> = { 'metadata.root': 1 }
      const projection = clean ? { _id: 0 } : { _id: 0, _index: 0, replayID: 0, [timeField]: 0, _metadata: 0 }
      if (deltaKey) {
        sort[deltaKey] = 1
        sort[timeField] = 1
      } else {
        sort[timeField] = 1
      }
      const filter = {
        'metadata.selectionSetHash': objectHash(fields, { algorithm: 'sha256', encoding: 'base64' }),
        $and: [{ [timeField]: { $gte: from } },
          { [timeField]: { $lte: to } }]
      }
      const pipeline = [
        { $match: filter },
        { $project: projection },
        { $sort: sort }
      ]
      const cursor = db.collection(collection)
        .aggregate(pipeline, { allowDiskUse: true, readConcern: 'local' })
      results = await cursor.toArray() as Array<WithId<HistoricalRecord>>
      if (deltaKey) {
        let prevItem: Record<string, unknown>
        results = results.reduce<Array<Record<string, unknown>>>((acc, item) => {
          if (_.get(prevItem || {}, deltaKey) === _.get(item, deltaKey)) {
            const deltas = diff(prevItem, item, (path, key: string) => !!(path.length === 0 && ~['replayID', '_index', 'metadata', '_id', '_timestamp', timeField].indexOf(key)))
            if (deltas) {
              const e: Record<string, unknown> = {
                metadata: item.metadata,
                [timeField]: item[timeField],
                deltas
              } satisfies Record<string, unknown>
              _.set(e, deltaKey, _.get(item, deltaKey))
              acc.push(e)
            }
          } else {
            prevItem = item
            acc.push(item)
          }
          return acc
        }, [])
      }
    } else {
      results = await db.collection(collection).find({ replayID }, {
        projection: {
          _timestamp: 0,
          replayID: 0,
          _id: 0
        }
      }).toArray() as Array<WithId<HistoricalRecord>>
    }
    return results.reduce<Record<string, Array<Record<string, unknown>>>>((acc, record: HistoricalRecord) =>
      ({ ...acc, [record.metadata.root]: [...(acc[record.metadata.root] || []), _.omit(record, ['metadata'])] })
    , {})
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
    replayID
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
      root,
      selectionSetHash: objectHash(fields, { algorithm: 'sha256', encoding: 'base64' })
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
    const timeseriesDataset = dataset.map((i, _index) => ({
      ...i,
      replayID,
      _timestamp,
      _index,
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
