import {plugin} from '../../plugin-builder/index.js'
import {Granularity, QueryHistoryStorage} from "./query-history-storage.js";
import {MONGODB_CONNECTION_STRING} from "../../proxy-server/config.js";
import {getFieldList} from "../helpers";
import gql from "graphql-tag";
import {Kind} from "../../common/index.js";

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
    """Expiration time in days for query results. Defaults to 120 days. This cannot be changed after the first creation of the collection."""
    ttlDays: Float = 120, 
    """Use a field name in your query for bucketing by time. Will default to the time of the query.""" 
    timeField: String = "_timestamp",
    """The operation name and fields referenced are part of the metadata fields for the time collection.
    You can optionally include additional fields to add to the metadata. The metadata is used to generate the deltas and impacts storage costs.
    """ 
    metaField: [String!],
    """Defines the size of time buckets in the time series collection. SECONDS can be efficient, but waste space if that time resolution is not realistic."""
    granularity: Granularity = SECONDS
    )`,
    operationDirectiveHelp: 'Retains query history results',
    additionalSDL: `
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

    // Define how to process your operation directive here...
    willSendResponsePluginResolver: async ({
                                               operation,
                                               context,
                                               singleResult,
                                               span,
                                               args,
                                               schema
                                           }) => {
        if (operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !MONGODB_CONNECTION_STRING) {
            return
        }

        const {
            args: ctxArgs,
            addToErrors,
            addToExtensions
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
            operationName,
            variables
        } = ctxArgs
        span?.setAttributes(ctxArgs)
        try {
            const recordCounts = {}
            const queryHistoryStorage = new QueryHistoryStorage(MONGODB_CONNECTION_STRING)
            const {list: fields} = getFieldList(gql(query), schema)
            for (const entry of Object.entries(singleResult.data ?? {})) {
                const [key, dataset] = entry as [string, Array<Record<string, unknown>>]
                await queryHistoryStorage.storeQueryResults({
                    operationName,
                    query,
                    fields,
                    collection,
                    variables,
                    ttlDays,
                    timeField,
                    metaFields,
                    granularity,
                    dataset
                })
                recordCounts[key] = dataset.length
            }
            addToExtensions(singleResult, {
                resultsRetained: {
                    recordCounts,
                    collection,
                    ttlDays
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
    metaFields?: string[],
    granularity?: Granularity
}

// Always export it as the default
export default queryHistoryPlugin
export {queryHistoryPlugin as plugin}
