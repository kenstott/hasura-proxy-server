import { FileFormat, FileOutput, outputFile } from './output-file.js'
import * as aq from 'arquero'
import { flatten } from 'flat'
import { type ObjMap } from '../helpers/index.js'

export const generateResponse = (data: ObjMap<unknown>, output: FileOutput, format: FileFormat): ObjMap<unknown> => {
  const files = {}
  for (const entry of Object.entries(data)) {
    const [key, dataset] = entry
    if (Array.isArray(dataset)) {
      switch (format) {
        case FileFormat.html:
          files[key] = { html: outputFile[output](aq.from(dataset.map(i => flatten(i))).toHTML(), format) }
          break
        case FileFormat.markdown:
          files[key] = { md: outputFile[output](aq.from(dataset.map(i => flatten(i))).toMarkdown(), format) }
          break
        case FileFormat.csv:
          files[key] = { csv: outputFile[output](aq.from(dataset.map(i => flatten(i))).toCSV(), format) }
          break
        case FileFormat.tsv:
          files[key] = { tsv: outputFile[output](aq.from(dataset.map(i => flatten(i))).toCSV({ delimiter: '\t' }), format) }
          break
        case FileFormat.json:
          files[key] = { json: outputFile[output](JSON.stringify(dataset, null, 2), format) }
          break
        case FileFormat.arrow:
          switch (output) {
            case FileOutput.dataUri:
              files[key] = { arrow: outputFile[output](aq.from(dataset.map(i => flatten(i))).toArrowBuffer(), format) }
              break
            default:
              files[key] = { arrow: outputFile[FileOutput.base64](aq.from(dataset.map(i => flatten(i))).toArrowBuffer(), format) }
          }
      }
    }
  }
  return files
}
