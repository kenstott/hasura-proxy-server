export interface HasuraContext {
    isSchemaQuery?: boolean
    userID?: string | string[]
    cwd: string,
    stopProcessing: boolean
}
