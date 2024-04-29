# cluster-plugin

This plugin is simple to invoke. It only has one optional parameter, clusters, which can be
set to override automatic calculation of optimum # of clusters.

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

Just add the @cluster directive to the query like this:

```graphql
query findCarts @cluster  {
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
      "replayID": "9fe85077-6fc4-446b-b841-256b6f23e993"
    },
    "clusters": {
      "carts": [
        [
          {
            "user": {
              "name": "Sandeep"
            },
            "is_complete": true,
            "cart_items": [
              {
                "quantity": 1,
                "product": {
                  "name": "Hasuras in The Cloud Tee",
                  "manufacturer": {
                    "name": "Hasura Tee Co."
                  }
                }
              },
              {
                "quantity": 1,
                "product": {
                  "name": "Get Ship Done Mug",
                  "manufacturer": {
                    "name": "Hasura Merch Co."
                  }
                }
              }
            ]
          }
        ],
        [
          {
            "user": {
              "name": "Rob"
            },
            "is_complete": false,
            "cart_items": [
              {
                "quantity": 1,
                "product": {
                  "name": "Hasuras in The Cloud Tee",
                  "manufacturer": {
                    "name": "Hasura Tee Co."
                  }
                }
              },
              {
                "quantity": 1,
                "product": {
                  "name": "Get Ship Done Mug",
                  "manufacturer": {
                    "name": "Hasura Merch Co."
                  }
                }
              },
              {
                "quantity": 1,
                "product": {
                  "name": "Sticker Sheet",
                  "manufacturer": {
                    "name": "Hasura Merch Co."
                  }
                }
              }
            ]
          }
        ],
        [
          {
            "user": {
              "name": "Sean"
            },
            "is_complete": true,
            "cart_items": [
              {
                "quantity": 1,
                "product": {
                  "name": "Sticker Sheet",
                  "manufacturer": {
                    "name": "Hasura Merch Co."
                  }
                }
              },
              {
                "quantity": 2,
                "product": {
                  "name": "Dark Furry Logo Tee",
                  "manufacturer": {
                    "name": "Hasura Tee Co."
                  }
                }
              },
              {
                "quantity": -2,
                "product": {
                  "name": "Dark Furry Logo Tee",
                  "manufacturer": {
                    "name": "Hasura Tee Co."
                  }
                }
              }
            ]
          },
          {
            "user": {
              "name": "Abby"
            },
            "is_complete": false,
            "cart_items": [
              {
                "quantity": 2,
                "product": {
                  "name": "Monogram Baseball Cap",
                  "manufacturer": {
                    "name": "Hasura Hat Co."
                  }
                }
              },
              {
                "quantity": 2,
                "product": {
                  "name": "The Original Tee",
                  "manufacturer": {
                    "name": "Hasura Tee Co."
                  }
                }
              }
            ]
          },
          {
            "user": {
              "name": "Marion"
            },
            "is_complete": true,
            "cart_items": [
              {
                "quantity": 1,
                "product": {
                  "name": "Monogram Baseball Cap",
                  "manufacturer": {
                    "name": "Hasura Hat Co."
                  }
                }
              },
              {
                "quantity": 1,
                "product": {
                  "name": "The Original Tee",
                  "manufacturer": {
                    "name": "Hasura Tee Co."
                  }
                }
              },
              {
                "quantity": 2,
                "product": {
                  "name": "Sticker Sheet",
                  "manufacturer": {
                    "name": "Hasura Merch Co."
                  }
                }
              },
              {
                "quantity": -1,
                "product": {
                  "name": "The Original Tee",
                  "manufacturer": {
                    "name": "Hasura Tee Co."
                  }
                }
              }
            ]
          }
        ]
      ]
    }
  }
}
```

You'll notice the that extensions is now an array of array of results.

Each top-level array represents a cluster.

## Options

The plugin can optionally write the anomaly trace
to a mongodb collection, to simplify reporting. In order to write to MongoDB a valid
MongoDB connection string must be provided as an environment variable named: `MONGODB_CONNECTION_STRING`

## Parameters

```graphql
@anomalies(thresold: Int!)
```

| Name    | Type | Purpose                                                         |
|---------|-----|-----------------------------------------------------------------|
| cluster | Int | Optionally override the optimum number of clusters calculation. |

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

[sample-plugin](../sample-plugin/README.md). When evaluating a large dataset, and the sole interest is in understanding errors, you can sample the
original dataset to a smaller sample record set using this plugin, while still evaluating the entire dataset.

[field-tracking-plugin](../field-tracking-plugin/README.md). This plugin is automatically invoked.

## Design Considerations

This plugin leverages Python. ML libraries in Python are very mature. But to take advantage of Python you must be able move 
data from NodeJS/Deno to Python efficiently. They can't share the same memory space. To do this, we used Apache Arrow. 
On the Typescript side we used their Arquero library to flatten and serialize into Arrow File Format, and then pushed 
the Arrow File to Python. Python then used pyarrow to convert into a numpy array, compute the scores, 
generate results in an Arrow File, and then push them back to NodeJS/Deno. 

Arrow's zero-copy technology drastically reduces serialization/deserialization time.

