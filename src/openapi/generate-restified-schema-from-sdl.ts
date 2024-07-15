import { type GraphQLSchema, Kind, type OperationDefinitionNode, type StringValueNode, type TypeNode } from 'graphql'
import _ from 'lodash'
import fs from 'fs'
import { staticTypes } from '../json-rpc/static-types'
import { PORT } from '../proxy-server/config.js'
import path from 'path'
import gql from 'graphql-tag'
import assert from 'assert'
import { traverseDirectories } from '../common/index.js'
import { generateMessagesAndServices } from '../service-definition/index.js'

export const ScalarTypeToJsonSchemaType = {
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
    return ScalarTypeToJsonSchemaType[typeNode.name.value] || typeNode.name.value
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

/**
 * Generates a RESTified OpenAPI specification from a given GraphQL schema.
 *
 * @param {GraphQLSchema} schema - The GraphQL schema to generate the specification from.
 * @returns {string} - The generated RESTified OpenAPI specification as a string.
 */
export const generateRestifiedSchemaFromSdl = (schema: GraphQLSchema): string => {
  assert(process.env.RESTIFIED_OPS)
  const { definitions } = JSON.parse(fs.readFileSync('./restified-openapi-spec/graphql-schema.json').toString('utf-8'))
  const { messages } = generateMessagesAndServices(schema)
  let requests = {}
  const basePath = path.resolve(process.env.RESTIFIED_OPS)
  traverseDirectories(basePath, (filePath: string, _stat: fs.Stats) => {
    const restOp = path.basename(filePath)
    if (restOp === 'get') {
      const servicePath = path.parse(filePath).dir.replace(basePath, '').split(/[/\\]/).slice(1).join('/')
      const files = fs.readdirSync(filePath).filter((i) => i.toLowerCase().endsWith('.gql'))
      for (const filename of files) {
        const opName = path.parse(filename).name
        const gqlOp = fs.readFileSync(path.resolve(filePath, filename)).toString('utf-8')
        const query = gql(gqlOp)
        const queryOp = query.definitions.find((i) => i.kind === Kind.OPERATION_DEFINITION) as OperationDefinitionNode
        const summary = (queryOp?.directives?.find((i) => i.name.value === 'comment')?.arguments?.find((i) => i.name.value === 'text')?.value as StringValueNode)?.value
        const request = {
          [`/v1/${servicePath ? servicePath + '/' : ''}${opName}`]: {
            get: {
              summary,
              description: '<pre>' + gqlOp + '</pre>',
              tags: [servicePath.length ? servicePath : 'Root'],
              parameters: query.definitions.reduce<Array<Record<string, any>>>((acc, i) => {
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
              }, []),
              responses: {
                200: {
                  description: `Successful response of ${opName}Result`,
                  content: {
                    'application/json': {
                      schema: {
                        $ref: `#/components/schemas/${opName}Result`
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
    } else if (restOp === 'post') {
      const servicePath = path.parse(filePath).dir.replace(basePath, '').split(/[/\\]/).slice(1).join('/')
      const files = fs.readdirSync(filePath).filter((i) => i.toLowerCase().endsWith('.gql'))
      for (const filename of files) {
        const opName = path.parse(filename).name
        const gqlOp = fs.readFileSync(path.resolve(filePath, filename)).toString('utf-8')
        const query = gql(gqlOp)
        const queryOp = query.definitions.find((i) => i.kind === Kind.OPERATION_DEFINITION) as OperationDefinitionNode
        const summary = (queryOp?.directives?.find((i) => i.name.value === 'comment')?.arguments?.find((i) => i.name.value === 'text')?.value as StringValueNode)?.value
        const request = requests[`/v1/${servicePath ? servicePath + '/' : ''}${opName}`] || {}
        request.post = {
          summary,
          description: '<pre>' + gqlOp + '</pre>',
          tags: [servicePath.length ? servicePath : 'Root'],
          parameters: [],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: query.definitions.reduce<Record<string, any>>((acc, i) => {
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
              description: `Successful response of ${opName}Result`,
              content: {
                'application/json': {
                  schema: {
                    $ref: `#/components/schemas/${opName}Result`
                  }
                }
              }
            }
          }
        }
        requests = { ...requests, [`/v1/${servicePath ? servicePath + '/' : ''}${opName}`]: request }
      }
    }
  })
  const requestsString = JSON.stringify(requests).slice(1, -1)
  const components = Object.entries(messages)
    .reduce((acc, [name, message]) => {
      return { ...acc, [name]: message?.jsonSchema?.() }
    }, { ...staticTypes, ...definitions })
  const restifiedCompiledTemplate = _.template(fs.readFileSync('./restified-openapi-spec/restified.json.template').toString('utf-8'))

  const restifiedSpecString = restifiedCompiledTemplate({
    components: JSON.stringify(components, null, 2),
    server: process.env.OPENAPI_SERVER ?? 'http://localhost',
    port: PORT,
    paths: requestsString
  })
  const parsed = JSON.parse(restifiedSpecString)
  return JSON.stringify(parsed, null, 2)
}
