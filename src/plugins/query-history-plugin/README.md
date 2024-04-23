# query-history-plugin

This plugin does require any parameters. You can invoke it with @retain

It would be interesting to add the result as a value for each query root object and make it a @defer field.
That would be the cleanest way to do it. But support for @defer with Apollo Server is not quite there
yet.

## Usage:

Consider this query:

```graphql
query findCarts {
  carts {
    user {
      name
    }
    is_complete
    cart_items {
      quantity
      product {
        name
        manufacturer {
          name
        }
      }
    }
  }
}
```

Just add the @retain directive to the query like this:

```graphql
query findCarts @retain  {
  carts {
    user {
      name
    }
    is_complete
    cart_items {
      quantity
      product {
        name
        manufacturer {
          name
        }
      }
    }
  }
}
```

When you run the query you will get this added to the extensions section of the payload.

```json
{
  "extensions": {
    "resultsRetained": {
      "recordCounts": {
        "carts": 5
      },
      "collection": "QueryHistory",
      "ttlDays": 120,
      "queryID": "36de1116-ab59-42d4-8d47-d73844d9e84a"
    }
  },}
```

## Options

The plugin can optionally write the anomaly trace to a mongodb collection, to simplify reporting. In order to write to MongoDB a valid
MongoDB connection string must be provided as an environment variable named: `MONGODB_CONNECTION_STRING`

## Parameters

```graphql
@retain(
"""A MongoDB collection name to track this query. Defaults to 'QueryHistory'"""
collection: String = "QueryHistory",
"""An optional ID to retrieve subsequently retrieve results, the original ID was returned in the extensions of the original query"""
queryID: String,
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
)
```

| Name        | Type        | Purpose                                                                                                                                                                                                                                                                                  |
|-------------|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| collection  | String      | A MongoDB collection name to track this query. Defaults to 'QueryHistory'                                                                                                                                                                                                                |
| ttlDays     | Float       | Expiration time in days for query results. Defaults to 120 days. This can only be changed after the first creation of the collection through MongoDB                                                                                                                                     |
| timeField   | String      | Use a field name in your query for bucketing by time. Will default to the time of the query.                                                                                                                                                                                             |
| metaField   | [String!]   | The operation name and field names are by default part of the metadata fields for the time collection. You can optionally include additional fields to add to the metadata. The metadata is used to generate the deltas and your choices could impact retrieval times and storage costs. |
| queryID     | String      | A UUID (aka queryID) is returned in the extensions when you use @retain. If you use this same value as the queryID it will replay the original query results, rather than querying the datastore                                                                                         |
| granularity | GRANULARITY | Defaults to "SECONDS", "MINUTES" or "HOURS" can also be used. Improves overall processing and storage if the frequency of data is similar to granularity                                                                                                                                 |

## Traces

Will create traces in this format:

```json
{
  "traceId": "613e0c408d95bbb3c7187c5738b796e4",
  "parentId": "74001af6355a3f1a",
  "name": "plugin.js",
  "id": "b5934e8e11081696",
  "kind": 0,
  "timestamp": 1713445848197000,
  "duration": 7419182.709,
  "attributes": {
    "query": "query findCarts @anomalies(threshold: 0)  {  carts {    user {      name    }    is_complete    cart_items {      quantity      product {        name        manufacturer {          name        }      }    }  }} ",
    "userID": "123",
    "directiveName": "anomalies",
    "threshold": 0,
    "operationName": "findCarts",
    "anomalies-carts": "[{\"user\":{\"name\":\"Sean\"},\"is_complete\":true,\"cart_items\":[{\"quantity\":1,\"product\":{\"name\":\"Sticker Sheet\",\"manufacturer\":{\"name\":\"Hasura Merch Co.\"}}},{\"quantity\":2,\"product\":{\"name\":\"Dark Furry Logo Tee\",\"manufacturer\":{\"name\":\"Hasura Tee Co.\"}}},{\"quantity\":-2,\"product\":{\"name\":\"Dark Furry Logo Tee\",\"manufacturer\":{\"name\":\"Hasura Tee Co.\"}}}],\"score\":-0.013129718600255913,\"index\":0}]"
  },
  "status": {
    "code": 1
  },
  "events": [],
  "links": []
}

```

Note the extensions attribute. There will be a single trace for each query. Each root query will have an attribute with suspicious records in a stringified JSON.

## MongoDB Trace Log

If you have setup the MongoDB trace exporter, anomalies will be recorded like this:

![Anomalies](../../../docs/images/anomalies.png)

## Related Plugins

[sample-plugin](../sample-plugin/README.md). When retaining a large dataset, and the sole interest is in retaining the data, you can sample the
original dataset to a smaller sample record set using this plugin, while still retaining the entire dataset.

[field-tracking-plugin](../field-tracking-plugin/README.md). This plugin is automatically invoked.

## Design Considerations

The data retention is performed asynchronously. While it will likely
be saved there is no guarantee.

This is to allow the original dataset to be returned without blocking on
the save to DB.
