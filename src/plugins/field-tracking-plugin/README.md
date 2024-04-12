# field-tracking-plugin

This plugin will provide span traces with attributes identifying the Object Types and
Fields referenced in a query. This is plugin is invoked automatically for all queries. The client does not have to use an operation directive.

Sample Trace:
```json
{
  "traceId": "6e689b16b49d61d86a366d612ec8bfe0",
  "spanId": "6216660ad537a066",
  "timestamp": "2024-04-12T16:52:02.529Z",
  "attributes": {
    "directiveName": "field-tracking",
    "query": "query findCarts @validate(jsonSchema: \"{ \\\"type\\\": \\\"object\\\", \\\"description\\\": \\\"Schema validation for Sales Analytics data set\\\", \\\"properties\\\": { \\\"carts\\\": { \\\"type\\\": \\\"array\\\", \\\"items\\\": { \\\"type\\\": \\\"object\\\", \\\"properties\\\": { \\\"user\\\": { \\\"type\\\": \\\"object\\\", \\\"properties\\\": { \\\"name\\\": { \\\"type\\\": \\\"string\\\" } } }, \\\"is_complete\\\": { \\\"description\\\": \\\"Purchase was completed\\\", \\\"type\\\": \\\"boolean\\\" }, \\\"cart_items\\\": { \\\"type\\\": \\\"array\\\", \\\"items\\\": { \\\"type\\\": \\\"object\\\", \\\"properties\\\": { \\\"quantity\\\": { \\\"type\\\": \\\"number\\\" }, \\\"product\\\": { \\\"type\\\": \\\"object\\\", \\\"properties\\\": { \\\"name\\\": { \\\"type\\\": \\\"string\\\" }, \\\"manufacturer\\\": { \\\"type\\\": \\\"object\\\", \\\"properties\\\": { \\\"name\\\": { \\\"type\\\": \\\"string\\\" } } } } } } } } }, \\\"if\\\": { \\\"properties\\\": { \\\"is_complete\\\":{ \\\"const\\\": true } } }, \\\"then\\\": { \\\"properties\\\": { \\\"is_complete\\\": { \\\"const\\\": true }, \\\"cart_items\\\": { \\\"type\\\": \\\"array\\\", \\\"items\\\": { \\\"type\\\": \\\"object\\\", \\\"properties\\\": { \\\"quantity\\\": { \\\"description\\\": \\\"Refunds must not be represented as negative quantities\\\", \\\"minimum\\\": 1 } } } } } } } } }}\")  {\n  carts {\n    user {\n      name\n    }\n    is_complete\n    cart_items {\n      quantity\n      product {\n        name\n        manufacturer {\n          name\n        }\n      }\n    }\n  }\n}",
    "field": "products.name"
  },
  "links": [],
  "events": [],
  "status": {
    "code": 1
  },
  "endTime": [
    1712940720,
    129456000
  ],
  "_ended": true,
  "_duration": [
    97,
    509456000
  ],
  "name": "field-tracking-plugin.js",
  "parentSpanId": "79d13d2ceb214a61",
  "kind": 0,
  "startTime": [
    1712940622,
    620000000
  ]
}
```

You may have good metadata, and good role based access control to make sure the right people get to the right
data. This plugin audits access, and provides a true history of access at the field level. This information
is invaluable to data governance teams who must attest to controls and is invaluable to data management
and technology teams to assess the impact of planned changes.

## Options

The plugin can optionally write the field access trace
to a mongodb collection, to simplify reporting. In order to write to MongoDB a valid
MongoDB connection string must be provided as an environment variable named: `MONGODB_CONNECTION_STRING`

