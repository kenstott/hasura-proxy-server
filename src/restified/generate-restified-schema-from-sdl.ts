import { type GraphQLSchema, Kind, type TypeNode } from 'graphql'
import { generateMessageFromObjectType } from '../grpc/generate-message-from-object-type'
import { type IMessage, Message } from '../grpc/message'
import _ from 'lodash'
import fs from 'fs'
import { staticTypes } from '../json-rpc/static-types'
import { PORT } from '../proxy-server/config'
import path from 'path'
import gql from 'graphql-tag'
import assert from 'assert'

const ScalarTypeToJsonSchemaType = {
  String: 'string',
  bigint: 'string',
  Int: 'integer',
  Float: 'number',
  float8: 'number',
  Boolean: 'boolean',
  ID: 'string',
  timestamp: 'string',
  timestampz: 'string'
}

const convertType = (typeNode: TypeNode): any => {
  if (typeNode.kind === Kind.NAMED_TYPE) {
    return ScalarTypeToJsonSchemaType[typeNode.name.value] || 'object'
  } else if (typeNode.kind === Kind.LIST_TYPE) {
    return {
      type: 'array',
      items: {
        type: convertType(typeNode.type)
      }
    }
  } else if (typeNode.kind === Kind.NON_NULL_TYPE) {
    return convertType(typeNode.type)
  }
}

export const generateRestifiedSchemaFromSdl = (schema: GraphQLSchema): string => {
  assert(process.env.RESTIFIED_OPS)
  const { definitions } = JSON.parse(fs.readFileSync('./restified-openapi-spec/graphql-schema.json').toString('utf-8'))
  const { message, supportingMessages } =
      generateMessageFromObjectType(schema.getQueryType(), {})
  const messages = { ...supportingMessages, [message?.name || '']: message }
  const components = Object.entries(messages)
    .reduce((acc, [name, message]) => {
      return { ...acc, [name]: new Message(message as IMessage).jsonschema() }
    }, { ...staticTypes, ...definitions })
  const restifiedCompiledTemplate = _.template(fs.readFileSync('./restified-openapi-spec/restified.json.template').toString('utf-8'))
  let requests = {}
  let folders = fs.readdirSync(path.resolve(process.env.RESTIFIED_OPS, 'get'))
  for (const filename of folders) {
    const opName = path.parse(filename).name
    const gqlOp = fs.readFileSync(path.resolve(process.env.RESTIFIED_OPS, 'get', filename)).toString('utf-8')
    const parsed = gql(gqlOp)
    const request = {
      [`/v1/${opName}`]: {
        get: {
          summary: gqlOp,
          parameters: parsed.definitions.reduce<Array<Record<string, any>>>((acc, i) => {
            if (i.kind === 'OperationDefinition' && i.variableDefinitions !== undefined) {
              for (const variable of i.variableDefinitions) {
                acc.push({
                  in: 'query',
                  name: variable.variable.name.value,
                  required: variable.defaultValue === undefined,
                  schema: {
                    type: convertType(variable.type)
                  }
                })
              }
            }
            return acc
          }, [{
            in: 'header',
            name: 'X-Hasura-Admin-Secret',
            schema: {
              type: 'string'
            }
          }]),
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        $ref: '#/components/schemas/query_root'
                      },
                      errors: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/GraphQLError'
                        }
                      },
                      extensions: {
                        type: 'object'
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
    requests = { ...requests, ...request }
  }
  folders = fs.readdirSync(path.resolve(process.env.RESTIFIED_OPS, 'post'))
  for (const filename of folders) {
    const opName = path.parse(filename).name
    const gqlOp = fs.readFileSync(path.resolve(process.env.RESTIFIED_OPS, 'post', filename)).toString('utf-8')
    const parsed = gql(gqlOp)
    const request = requests[`/v1/${opName}`] || { [`/v1/${opName}`]: {} }
    request.post = {
      summary: gqlOp,
      parameters: [{
        in: 'header',
        name: 'X-Hasura-Admin-Secret',
        schema: {
          type: 'string'
        }
      }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: parsed.definitions.reduce<Record<string, any>>((acc, i) => {
                if (i.kind === 'OperationDefinition' && i.variableDefinitions !== undefined) {
                  for (const variable of i.variableDefinitions) {
                    acc = { ...acc, [variable.variable.name.value]: { type: 'integer' } }
                  }
                }
                return acc
              }, {})
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    $ref: '#/components/schemas/query_root'
                  },
                  errors: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/GraphQLError'
                    }
                  },
                  extensions: {
                    type: 'object'
                  }
                }
              }
            }
          }
        }
      }
    }
    requests = { ...requests, ...request }
  }
  const requestsString = JSON.stringify(requests).slice(1, -1)

  const restifiedSpecString = restifiedCompiledTemplate({
    components: JSON.stringify(components, null, 2),
    server: process.env.OPENAPI_SERVER ?? 'http://localhost',
    port: PORT,
    paths: requestsString
  })
  const parsed = JSON.parse(restifiedSpecString)
  return JSON.stringify(parsed, null, 2)
}
