import { plugin } from '../../plugin-builder/index.js'
import { FileFormat, type FileOutput } from './output-file.js'
import { Kind } from '../../common/index.js'
import { generateResponse } from './generate-response.js'
import { type ObjMap } from 'graphql/jsutils/ObjMap'

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
  argDefaults: { output: 'BASE64' },

  // Define how to process your operation directive here...
  willSendResponsePluginResolver: async ({
    operation,
    context,
    contextValue,
    singleResult,
    args,
    span
  }) => {
    if (operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !singleResult.data || contextValue.passThrough) {
      return
    }

    const { originalUrl, response } = contextValue

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
      if (format === FileFormat.json) {
        response?.json(singleResult)
        return
      }
      const files = generateResponse((singleResult.data as ObjMap<Record<string, unknown[]>>), output as FileOutput, format as FileFormat)
      addToExtensions(singleResult, { files })
    } catch (error) {
      // Trap processing errors like this...
      addToErrors(singleResult, error as Error, { code: 'PROBLEM_WITH_SAMPLING' })
    }
    if (originalUrl?.startsWith('/gql')) {
      contextValue.stopProcessing = true
      const extension = {
        [FileFormat.csv]: 'csv',
        [FileFormat.tsv]: 'tsv',
        [FileFormat.html]: 'html',
        [FileFormat.arrow]: 'arrow',
        [FileFormat.json]: 'json',
        [FileFormat.markdown]: 'md'
      }
      const mimetype = {
        [FileFormat.csv]: 'text/csv',
        [FileFormat.tsv]: 'text/tsv',
        [FileFormat.html]: 'text/html',
        [FileFormat.arrow]: 'application/vnd.apache.arrow.file',
        [FileFormat.json]: 'application/json',
        [FileFormat.markdown]: 'text/markdown'
      }
      const [key, dataset] = Object.entries(singleResult?.extensions?.files || {})[0]
      if (format === FileFormat.arrow) {
        const binaryData = Buffer.from(dataset[extension[format]] as string, 'base64')
        response?.writeHead(200, {
          'Content-Type': mimetype[format], // Set the appropriate content type
          'Content-disposition': `attachment; filename="${key}.${extension[format]}"`, // Set the filename
          'Content-Length': binaryData.length // Set the content length
        })
        response?.end(binaryData)
      } else {
        const utf8 = Buffer.from(dataset[extension[format]] as string, 'base64').toString('utf-8')
        response?.setHeader('Content-Type', `${mimetype[format]}; charset=utf-8`)
        response?.attachment(`${key}.${extension[format]}`)
        response?.send(utf8)
      }
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
export { filePlugin as plugin }
