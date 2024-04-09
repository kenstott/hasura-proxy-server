import {plugin} from '../../plugin-builder'
import * as aq from 'arquero'
import {flatten} from 'flat'
import {FileFormat, FileOutput, outputFile} from './output-file'
import {Kind} from "../../common";

/**
 * @description Adds @sample operation directive to queries, which will
 * reduce the output to the number of sampled items. This useful when combined
 * with validate or profile plugins. It will validate and profile the entire dataset
 * but only return the # sampled items.Ï
 *
 * @returns {HasuraPlugin} The plugin that is passed to our Hasura proxy server. The plugin is passed
 * dynamically by supplying a local or remote path to the module.
 */

export const filePlugin = plugin({
    // Define you operation directive here....in SDL
    operationDirective: '@file("""File format can be CSV, TSV, JSON, ARRAY, HTML or MARKDOWN.""" format: FileFormat!, """Output can be STREAM, BASE64, STRING, DATAURI or NATIVE.""" output: FileOutput = BASE64 )',
    operationDirectiveHelp: 'Generates files, from query results in file formats and output formats',

    additionalSDL: `
  """ File Output Format """
  enum FileOutput {
  """ Output to a file stream """
  STREAM
  """ Output as a base64 string """
  BASE64
  """ Output as an escaped string """
  STRING
  """ Output as a Data URI """
  DATAURI
  """ Output with no changes """
  NATIVE
}
  """ File format for each array at the root of the query results """
  enum FileFormat {
  """ Comma separated value file """
  CSV
  """ Tab separated value file """
  TSV
  """ JSON file """
  JSON
  """ Apache Array zero-copy format """
  ARROW
  """ HTML format """
  HTML
  """ Markdown format """
  MARKDOWN
}
  `,

    // Define your arg defaults in TypeScript - to match the arg defaults in your SDL
    argDefaults: {output: 'BASE64'},

    // Define how to process your operation directive here...
    willSendResponsePluginResolver: async ({
                                               operation,
                                               context,
                                               singleResult,
                                               args,
                                               span
                                           }) => {
        if (operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !singleResult.data) {
            return
        }

        // Destructure your operation args...like this
        const {
            format,
            output
        } = args as FilePluginArgs
        const {
            args: ctxArgs,
            addToErrors,
            addToExtensions
        } = context

        span?.setAttributes(ctxArgs)
        try {
            const files = {}
            for (const entry of Object.entries(singleResult.data)) {
                const [key, dataset] = entry
                if (Array.isArray(dataset)) {
                    switch (format) {
                        case FileFormat.html:
                            files[key] = {csv: outputFile[output](aq.from(dataset.map(i => flatten(i))).toHTML(), format)}
                            break
                        case FileFormat.markdown:
                            files[key] = {csv: outputFile[output](aq.from(dataset.map(i => flatten(i))).toMarkdown(), format)}
                            break
                        case FileFormat.csv:
                            files[key] = {csv: outputFile[output](aq.from(dataset.map(i => flatten(i))).toCSV(), format)}
                            break
                        case FileFormat.tsv:
                            files[key] = {tsv: outputFile[output](aq.from(dataset.map(i => flatten(i))).toCSV({delimiter: '\t'}), format)}
                            break
                        case FileFormat.json:
                            files[key] = {json: outputFile[output](JSON.stringify(dataset, null, 2), format)}
                            break
                        case FileFormat.arrow:
                            switch (output) {
                                case FileOutput.dataUri:
                                    files[key] = {arrow: outputFile[output](aq.from(dataset.map(i => flatten(i))).toArrowBuffer(), format)}
                                    break
                                default:
                                    files[key] = {arrow: outputFile[FileOutput.base64](aq.from(dataset.map(i => flatten(i))).toArrowBuffer(), format)}
                            }
                    }
                }
            }
            addToExtensions(singleResult, {files})
        } catch (error) {
            // Trap processing errors like this...
            addToErrors(singleResult, error as Error, {code: 'PROBLEM_WITH_SAMPLING'})
        }
    }
})

/**
 * @description Create an interface describing your directive arguments
 */
interface FilePluginArgs {
    format: string
    output: string
}

// Always export it as the default
export default filePlugin
export {filePlugin as plugin}
