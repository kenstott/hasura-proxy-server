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
import process from 'process'
import assert from 'assert'

export const postAnthropic = (async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  assert(process.env.ANTHROPIC_API_KEY)
  assert(process.env.ANTHROPIC_URI)
  assert(process.env.ANTHROPIC_VERSION)
  const apiKey = process.env.ANTHROPIC_API_KEY
  const url = process.env.ANTHROPIC_URI
  const headers = {
    'x-api-key': apiKey || '',
    'anthropic-version': process.env.ANTHROPIC_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
  const body = JSON.stringify(req.body)
  res.setTimeout(60000, () => {
    const err = new Error('Response timed out')
    res.status(504)
    next(err)
  })
  const response = await fetch(url, { method: 'POST', body, headers })
  res.json(await response.json())
}) as RequestHandler
