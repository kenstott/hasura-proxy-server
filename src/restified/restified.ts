import express, { type Express } from 'express'
import fs from 'fs'
import path from 'path'
import gql from 'graphql-tag'
import assert from 'assert'
import { Kind } from 'graphql'
import { executeGraphQLQuery } from '../grpc/execute-graph-ql-query'

export const restified = async (app: Express): Promise<void> => {
  assert(process.env.RESTIFIED_OPS, 'env var RESTIFIED_OPS must be defined.')
  assert(fs.statSync(process.env.RESTIFIED_OPS).isDirectory(), 'env var RESTIFIED_OPS must point to a directory.')
  let folders = fs.readdirSync(path.resolve(process.env.RESTIFIED_OPS, 'get'))
  for (const filename of folders) {
    const opName = path.parse(filename).name
    const gqlOp = fs.readFileSync(path.resolve(process.env.RESTIFIED_OPS, 'get', filename)).toString('utf-8')
    const parsed = gql(gqlOp)
    app.get(`/v1/${opName}`, (req, res, next) => {
      const variables = {}
      for (const ops of parsed.definitions) {
        if (ops.kind === Kind.OPERATION_DEFINITION && ops.variableDefinitions) {
          for (const variable of ops.variableDefinitions) {
            if (req.query[variable.variable.name.value]) {
              if (variable.type.kind === Kind.NAMED_TYPE) {
                switch (variable.type.name.value) {
                  case 'Int':
                    variables[variable.variable.name.value] = parseInt(req.query[variable.variable.name.value]?.toString() || '')
                    break
                  default:
                    variables[variable.variable.name.value] = req.query[variable.variable.name.value]
                }
              }
            }
          }
        }
      }
      executeGraphQLQuery(app)({
        operationName: opName,
        query: gqlOp,
        variables,
        headers: req.headers,
        callback: (_, result) => {
          res.json(result)
        }
      })
    })
  }
  folders = fs.readdirSync(path.resolve(process.env.RESTIFIED_OPS, 'post'))
  for (const filename of folders) {
    const opName = path.parse(filename).name
    const gqlOp = fs.readFileSync(path.resolve(process.env.RESTIFIED_OPS, 'post', filename)).toString('utf-8')
    const parsed = gql(gqlOp)
    app.post(`/v1/${opName}`, express.json(), (req, res, next) => {
      const variables = req.body
      executeGraphQLQuery(app)({
        operationName: opName,
        query: gqlOp,
        variables,
        headers: req.headers,
        callback: (_, result) => {
          res.json(result)
        }
      })
    })
  }
}
