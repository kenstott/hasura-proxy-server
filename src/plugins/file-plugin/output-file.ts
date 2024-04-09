import intoStream from 'into-stream'

export enum FileFormat {
  csv = 'CSV',
  tsv = 'TSV',
  json = 'JSON',
  arrow = 'ARROW',
  html = 'HTML',
  markdown = 'MARKDOWN'
}

export enum FileOutput {
  base64 = 'BASE64',
  stream = 'STREAM',
  link = 'LINK',
  string = 'STRING',
  dataUri = 'DATAURI',
  native = 'NATIVE'
}

const mimeTypes = {
  [FileFormat.markdown]: 'text/markdown',
  [FileFormat.html]: 'text/html',
  [FileFormat.csv]: 'text/csv',
  [FileFormat.tsv]: 'text/tab-separated-values',
  [FileFormat.arrow]: 'application/vnd.apache.arrow.file',
  [FileFormat.json]: 'application/json'
}
export const outputFile = {
  [FileOutput.stream]: (file: string, format: FileFormat) => intoStream(file),
  [FileOutput.base64]: (file: string | Uint8Array, format: FileFormat) => Buffer.from(file).toString('base64'),
  [FileOutput.string]: (file: string, format: FileFormat) => file,
  [FileOutput.native]: (file: any, format: FileFormat) => file,
  [FileOutput.dataUri]: (file: string | Uint8Array, format: FileFormat) => `data:${mimeTypes[format]};base64,${Buffer.from(file).toString('base64')}`
}
