import { FileFormat, FileOutput, outputFile } from './output-file.js'
import * as aq from 'arquero'
import * as arrow from 'apache-arrow'
import { flatten } from 'flat'
import { type ObjMap } from '../helpers/index.js'
import _ from 'lodash'
import type ColumnTable from 'arquero/dist/types/table/column-table'

export const flattenToTable = (dataset: Array<Record<string, unknown>>): ColumnTable => {
  dataset = dataset.map(i => flatten(i))
  const names = [...new Set(_.flatten(dataset.map(i => Object.keys(i))))]
  return aq.from(dataset, names)
}
export const generateResponse = (data: ObjMap<Record<string, unknown[]>>, output: FileOutput, format: FileFormat): ObjMap<unknown> => {
  const files = {}
  for (const entry of Object.entries(data)) {
    const [key, dataset] = entry
    if (Array.isArray(dataset)) {
      switch (format) {
        case FileFormat.html:
          files[key] = { html: outputFile[output](flattenToTable(dataset).toHTML(), format) }
          break
        case FileFormat.markdown:
          files[key] = { md: outputFile[output](flattenToTable(dataset).toMarkdown(), format) }
          break
        case FileFormat.csv:
          files[key] = { csv: outputFile[output](flattenToTable(dataset).toCSV(), format) }
          break
        case FileFormat.tsv:
          files[key] = { tsv: outputFile[output](flattenToTable(dataset).toCSV({ delimiter: '\t' }), format) }
          break
        case FileFormat.json:
          files[key] = { json: outputFile[output](JSON.stringify(dataset, null, 2), format) }
          break
        case FileFormat.arrow:
          switch (output) {
            case FileOutput.dataUri: {
              const table = arrow.tableFromIPC(flattenToTable(dataset).toArrowBuffer())
              const serialized = arrow.tableToIPC(table)
              files[key] = { arrow: outputFile[output](serialized, format) }
            }
              break
            default: {
              const table = arrow.tableFromIPC(flattenToTable(dataset).toArrowBuffer())
              const serialized = arrow.tableToIPC(table)
              files[key] = { arrow: outputFile[FileOutput.base64](serialized, format) }
            }
              break
          }
      }
    }
  }
  return files
}
