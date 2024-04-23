export interface HasuraContext {
  isSchemaQuery?: boolean
  userID?: string | string[]
  cwd: string
  stopProcessing: boolean
  queryID?: string
  queryCollection?: string
  revisedOperation?: any
}
