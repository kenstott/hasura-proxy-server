import { type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { getHasuraSchema } from '../proxy-server/get-hasura-schema'
import {
  type GraphQLEnumType,
  type GraphQLInputObjectType,
  type GraphQLInterfaceType,
  type GraphQLObjectType,
  type GraphQLScalarType,
  type GraphQLType,
  type GraphQLUnionType,
  isLeafType,
  isObjectType,
  isWrappingType
} from 'graphql'
import fs from 'fs'

const getWrappedType = (t: GraphQLType): GraphQLInputObjectType | GraphQLInterfaceType | GraphQLEnumType | GraphQLObjectType | GraphQLScalarType | GraphQLUnionType => {
  if (isWrappingType(t)) {
    return getWrappedType(t.ofType)
  }
  return t
}
export const getPolicies = (async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const role = req.headers['x-hasura-role']?.toString() || 'default'
  try {
    if (fs.existsSync(`./policies/policies.${role}.json`)) {
      const policies = JSON.parse(fs.readFileSync(`./policies/policies.${role}.json`).toString('utf-8'))
      res.json(policies)
    } else {
      res.json([])
    }
  } catch {
    res.json([])
  }
}) as RequestHandler

export const postPolicies = (async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const role = req.headers['x-hasura-role']?.toString() || 'default'
  const policies = req.body
  fs.writeFileSync(`./policies/policies.${role}.json`, JSON.stringify(policies, null, 2))
  res.json({ result: 'OK' })
}) as RequestHandler
