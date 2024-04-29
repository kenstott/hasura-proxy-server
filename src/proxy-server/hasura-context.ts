import { type StandaloneServerContextFunctionArgument } from '@apollo/server/standalone'
import { type IncomingMessage } from 'http'
import { altProcess, type HasuraContext } from '../common/index.js'
import { type Response } from 'express'

/**
 * @description Identifies schema queries to help HasuraPlugins ignore them.
 */
export const hasuraContext = async (context: StandaloneServerContextFunctionArgument): Promise<HasuraContext> => {
  const req: IncomingMessage & { body?: Record<string, any>, originalUrl?: string, res?: Response } = context.req
  return {
    isSchemaQuery: req.body?.query?.indexOf('__schema') !== -1,
    userID: req.headers['x-hasura-user-id'] ?? 'anonymous',
    cwd: altProcess.cwd(),
    stopProcessing: false,
    originalUrl: req.originalUrl,
    response: req.res
  }
}
