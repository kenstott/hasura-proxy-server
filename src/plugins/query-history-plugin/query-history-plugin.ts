import { plugin } from '../../plugin-builder/index.js'
import { Granularity, QueryHistoryStorage } from './query-history-storage.js'
import { MONGODB_CONNECTION_STRING } from '../../proxy-server/config.js'
import { getFieldList } from '../helpers/index.js'
import gql from 'graphql-tag'
import { Kind } from '../../common/index.js'
import { v4 as uuid } from 'uuid'
import { type GraphQLResponse, type HTTPGraphQLHead } from '@apollo/server'

/**
 * @description Adds @retain operation directive to queries, which will
 * retain the individual records of query in a time series database
 *
 * @returns {HasuraPlugin} The plugin that is passed to our Hasura proxy server. The plugin is passed
 * dynamically by supplying a local or remote path to the module.
 */

export const queryHistoryPlugin = plugin({
  // Define you operation directive here....in SDL
  operationDirective: `@retain( 
    """A MongoDB collection name to track this query. Defaults to 'QueryHistory'""" 
    collection: String = "QueryHistory", 
    """An optional ID to retrieve subsequently retrieve results, the original ID was returned in the extensions of the original query""" 
    replayID: timestamp,
    """An optional date time as an RFC string - to retrieve historical results based on the operation name. This defines the lower bound.""" 
    replayFrom: timestamp,
    """An optional date time as an RFC string - to retrieve historical results based on the operation name. This defines the upper bound.""" 
    replayTo: String,
    """An optional field name to be used to compute deltas.""" 
    deltaKey: String,
    """Expiration time in days for query results. Defaults to 120 days. This cannot be changed after the first creation of the collection."""
    ttlDays: Float = 120, 
    """Use a field name in your query for bucketing by time. Will default to the time of the query.""" 
    timeField: String = "_timestamp",
    """The operation name and fields referenced are part of the metadata fields for the time collection.
    You can optionally include additional fields to add to the metadata. The metadata is used to generate the deltas and impacts storage costs.
    """ 
    metaField: [String!],
    """Do not add extra information to output, like _index and _timestamp"""
    clean: Boolean = False,
    """Defines the size of time buckets in the time series collection. SECONDS can be efficient, but waste space if that time resolution is not realistic."""
    granularity: Granularity = SECONDS
    )`,
  operationDirectiveHelp: 'Retains query history results',
  additionalSDL: `
  scalar timestamp
  """ Time Series Granularity """
  enum Granularity {
  """ Bucket by hours """
  HOURS
  """ Bucket by minutes """
  MINUTES
  """ Bucket by seconds """
  SECONDS
}
  `,

  // Define your arg defaults in TypeScript - to match the arg defaults in your SDL
  argDefaults: {
    collection: 'QueryHistory',
    ttlDays: 120,
    timeField: '_timestamp',
    metaFields: [],
    granularity: Granularity.seconds
  },

  responseForOperationPluginResolver: async ({ request, schema, contextValue, response }) => {
    if (contextValue.history && MONGODB_CONNECTION_STRING && request.query) {
      const queryHistoryStorage = new QueryHistoryStorage(MONGODB_CONNECTION_STRING)
      const { list: fields } = getFieldList(gql(request.query), schema)
      const data = await queryHistoryStorage.retrieveQueryResults({ ...contextValue.history, fields })
      return {
        http: request.http as HTTPGraphQLHead,
        body: {
          kind: 'single',
          singleResult: { data }
        }
      } satisfies GraphQLResponse
    }
    contextValue.stopProcessing = true
    return response as GraphQLResponse
  },

  // Define how to process your operation directive here...
  willSendResponsePluginResolver: async ({
    operation,
    context,
    contextValue,
    singleResult,
    span,
    args,
    schema
  }) => {
    operation = contextValue.revisedOperation ?? operation
    if (contextValue.history || operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !MONGODB_CONNECTION_STRING) {
      return
    }
    const {
      args: ctxArgs,
      addToErrors,
      addToExtensions,
      variables
    } = context
    const {
      collection,
      ttlDays,
      timeField,
      metaFields,
      granularity
    } = args as QueryHistoryPluginArgs
    const {
      query,
      operationName
    } = ctxArgs
    span?.setAttributes(ctxArgs)
    try {
      const recordCounts = {}
      const queryHistoryStorage = new QueryHistoryStorage(MONGODB_CONNECTION_STRING)
      const { list: fields } = getFieldList(gql(query), schema)
      const replayID = uuid()
      for (const entry of Object.entries(singleResult.data ?? {})) {
        const [root, dataset] = entry as [string, Array<Record<string, unknown>>]
        if (dataset?.length) {
          await queryHistoryStorage.storeQueryResults({
            operationName,
            replayID,
            query,
            fields,
            collection,
            variables,
            ttlDays,
            timeField,
            metaFields,
            granularity,
            root,
            dataset
          })
        }
        recordCounts[root] = dataset.length
      }
      span?.setAttributes({
        recordCounts: JSON.stringify(recordCounts),
        collection,
        ttlDays,
        replayID
      })
      addToExtensions(singleResult, {
        resultsRetained: {
          recordCounts,
          collection,
          ttlDays,
          replayID
        }
      })
    } catch (error) {
      // Trap processing errors like this...
      addToErrors(singleResult, error as Error, {
        code: 'QUERY_HISTORY_ERROR'
      })
    }
  }
})

/**
 * @description Create an interface describing your directive arguments
 */
interface QueryHistoryPluginArgs {
  collection?: string
  ttlDays?: number
  timeField?: string
  metaFields?: string[]
  granularity?: Granularity
  clean?: boolean
}

// Always export it as the default
export default queryHistoryPlugin
export { queryHistoryPlugin as plugin }
