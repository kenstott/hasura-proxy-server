# validate-plugin

This plugin is really, really simple. It uses the AJV json validator and compares a JSON Schema definition
against the result. It adds a few microseconds per record to overall processing time. But, since its
invoked optionally through the @validate directive, its not too problematic.

If you wanted to improve performance. You would push the AJV validation onto a worker thread, immediately release
the query results, then publish the AJV validation through a queue, file or database push.

It would be really interesting add the result as a value for each query root object and make it an @defer.
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
Lets assume we want to identify all negative quantities when a is_complete === true. We could write
this JSON Schema definition.

```json
{
  "type": "object",
  "properties": {
    "carts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "user": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string"
              }
            }
          },
          "is_complete": {
            "description": "Purchase was completed",
            "type": "boolean"
          },
          "cart_items": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "quantity": {
                  "type": "number"
                },
                "product": {
                  "type": "object",
                  "properties": {
                    "name": {
                      "type": "string"
                    },
                    "manufacturer": {
                      "type": "object",
                      "properties": {
                        "name": {
                          "type": "string"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "if": {
          "properties": {
            "is_complete":{
              "const": true
            }
          }
        },
        "then": {
          "properties": {
            "is_complete": {
              "const": true
            },
            "cart_items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "quantity": {
                    "description": "Refunds must not be represented as negative quantities",
                    "minimum": 1
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

We could then add the @validate directive to the query like this:

```graphql
query findCarts @validate(jsonSchema: "{ \"type\": \"object\", \"properties\": { \"carts\": { \"type\": \"array\", \"items\": { \"type\": \"object\", \"properties\": { \"user\": { \"type\": \"object\", \"properties\": { \"name\": { \"type\": \"string\" } } }, \"is_complete\": { \"description\": \"Purchase was completed\", \"type\": \"boolean\" }, \"cart_items\": { \"type\": \"array\", \"items\": { \"type\": \"object\", \"properties\": { \"quantity\": { \"type\": \"number\" }, \"product\": { \"type\": \"object\", \"properties\": { \"name\": { \"type\": \"string\" }, \"manufacturer\": { \"type\": \"object\", \"properties\": { \"name\": { \"type\": \"string\" } } } } } } } } }, \"if\": { \"properties\": { \"is_complete\":{ \"const\": true } } }, \"then\": { \"properties\": { \"is_complete\": { \"const\": true }, \"cart_items\": { \"type\": \"array\", \"items\": { \"type\": \"object\", \"properties\": { \"quantity\": { \"description\": \"Refunds must not be represented as negative quantities\", \"minimum\": 1 } } } } } } } } }}")  {
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

Note: I formatted this query by escaping carriage returns and quotes so you could enter it interactively in graphiql.

If you are doing this programmatically that would happen automatically.

When you run the query you will get this added to the extensions section of the payload.

```json
"extensions": {
    "validation": {
      "errors": [
        {
          "instancePath": "/carts/0/cart_items/2/quantity",
          "schemaPath": "#/properties/carts/items/then/properties/cart_items/items/properties/quantity/minimum",
          "keyword": "minimum",
          "params": {
            "comparison": ">=",
            "limit": 1
          },
          "message": "must be >= 1",
          "schema": 1,
          "parentSchema": {
            "description": "Refunds must not be represented as negative quantities",
            "minimum": 1
          },
          "data": -2
        }
      ]
    }
  }
```

## Options

The plugin can optionally write the field access trace
to a mongodb collection, to simplify reporting. In order to write to MongoDB a valid
MongoDB connection string must be provided as an environment variable named: `MONGODB_CONNECTION_STRING`

## Parameters

|Name|Type|Purpose|
|----|----|-------|
 |jsonSchema|String!|This is the only required field. It must be a properly formatted JSON Schema describing the entire result set.|
|verbose|Boolean|Defaults to true. Adds the actual value of a field when a rule fails. You may need to make this false for non-public information|
|allErrors|Boolean|Defaults to true. When true, all records are evaluated. When false, the validation stops after the first error|
|strict|Boolean|Defaults to false. When true enforces all JSON Schema requirements.|

## Traces

Will create traces in this format