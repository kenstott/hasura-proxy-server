import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import gql from 'graphql-tag'
import assert from 'assert'
import { Kind } from 'graphql'
import { internalProxyGraphQLQuery, traverseDirectories } from '../common/index.js'
import swaggerUi from 'swagger-ui-express'

const _restified = async (app: Express): Promise<void> => {
  assert(process.env.RESTIFIED_OPS, 'env var RESTIFIED_OPS must be defined.')
  const basePath = path.resolve(process.env.RESTIFIED_OPS)
  traverseDirectories(basePath, (filePath: string, _stat: fs.Stats) => {
    const restOp = path.basename(filePath)
    if (['get', 'post'].includes(restOp)) {
      const servicePath = path.parse(filePath).dir.replace(basePath, '').split(/[/\\]/).slice(1).join('/')
      const files = fs.readdirSync(filePath).filter((i) => i.toLowerCase().endsWith('.gql'))
      for (const filename of files) {
        const opName = path.parse(filename).name
        const gqlOp = fs.readFileSync(path.resolve(filePath, filename)).toString('utf-8')
        const parsed = gql(gqlOp)
        const opPath = `/v1/${servicePath ? servicePath + '/' : ''}${opName}`
        app[restOp](opPath, express.json(), (req: Request, res: Response, _next: NextFunction) => {
          const variables = req.body ?? {}
          if (restOp === 'get') {
            for (const ops of parsed.definitions) {
              if (ops.kind === Kind.OPERATION_DEFINITION && ops.variableDefinitions) {
                for (const variable of ops.variableDefinitions) {
                  if (req.query[variable.variable.name.value]) {
                    if (variable.type.kind === Kind.NAMED_TYPE) {
                      switch (variable.type.name.value) {
                        case 'Int':
                          variables[variable.variable.name.value] = parseInt(req.query[variable.variable.name.value]?.toString() || '')
                          break
                        case 'float8':
                        case 'Float':
                          variables[variable.variable.name.value] = parseFloat(req.query[variable.variable.name.value]?.toString() || '')
                          break
                        case 'Boolean':
                          variables[variable.variable.name.value] = (req.query[variable.variable.name.value]?.toString() || '') === 'true'
                          break
                        case 'bigint':
                        case 'String':
                        case 'ID':
                        case 'timestamp':
                        case 'timestampz':
                          variables[variable.variable.name.value] = req.query[variable.variable.name.value]
                          break
                        default:
                          variables[variable.variable.name.value] = JSON.parse(req.query[variable.variable.name.value]?.toString() || '')
                          break
                      }
                    }
                  }
                }
              }
            }
          }
          const headers = { ...req.headers, 'json-rpc': true }
          internalProxyGraphQLQuery(app)({
            operationName: opName,
            query: gqlOp,
            variables,
            headers,
            callback: (_, result) => {
              res.json(result)
            }
          })
        })
      }
    }
  })
}
export const restified = async (app: Express): Promise<void> => {
  assert(process.env.RESTIFIED_OPS, 'env var RESTIFIED_OPS must be defined.')
  assert(fs.statSync(process.env.RESTIFIED_OPS).isDirectory(), 'env var RESTIFIED_OPS must point to a directory.')
  const swaggerDoc = JSON.parse(fs.readFileSync('./restified-openapi-spec/openapi.spec').toString('utf-8'))
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc as swaggerUi.JsonObject))
  await _restified(app)
}
