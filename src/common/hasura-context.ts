import { type Response } from 'express'

export interface HasuraContext {
  passThrough?: boolean
  isSchemaQuery?: boolean
  userID?: string | string[]
  cwd: string
  stopProcessing: boolean
  revisedOperation?: any
  originalUrl?: string
  response?: Response
  history?: {
    replayID?: string
    timeField?: string
    collection?: string
    replayFrom?: string
    replayTo?: string
    deltaKey?: string
    operationName?: string
  }
}
