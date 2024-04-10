import { plugin } from '../../plugin-builder/index.js'
import wordnet from 'wordnet'
import * as changeCase from 'change-case'
import { GraphQLError, Kind } from '../../common/index.js'

wordnet.init().then(() => {
  console.log('WordNet initialized')
})

/**
 * @description Verifies that the query operation name is in the format: <verb><object-type><optional adjective list>
 *
 * @returns {HasuraPlugin} The plugin that is passed to our Hasura proxy server. The plugin is passed
 * dynamically by supplying a local or remote path to the module.
 */

export const namingStandardsPlugin = plugin({
  argDefaults: {},
  async didResolveOperationPluginResolver (requestContext) {
    const {
      schema,
      contextValue,
      operation,
      request: { operationName }
    } = requestContext
    const { isSchemaQuery } = contextValue
    if (isSchemaQuery || operation?.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query') {
      return
    }
    if (operationName) {
      const words = changeCase.sentenceCase(operationName).split(' ').map(i => i.toLowerCase())
      const camelCaseOperationName = changeCase.camelCase(words.join(' '))
      if (words.length < 2) {
        contextValue.stopProcessing = true
        throw new GraphQLError('Query operation names are required. and must be in the form <verb><object-type><optional noun/adjective list>.', { extensions: { code: 'QUERY_NAME_ERROR' } })
      }

      let verb = false
      try {
        verb = (await wordnet.lookup(words[0], true)).find((i: any) => i.meta.synsetType === 'verb')
      } catch {
        // ignore
      }
      if (!verb) {
        contextValue.stopProcessing = true
        throw new GraphQLError(`Query operation names are required. and must be in the form <verb><object-type><optional noun/adjective list>. "${words[0]}" is not a verb`, {
          extensions: {
            stacktrace: null,
            code: 'QUERY_NAME_ERROR'
          }
        })
      }
      const operationNameTest = camelCaseOperationName.slice(words[0].length)
      const matchedObjectTypes = Object.keys(schema.getTypeMap()).filter(i => operationNameTest.toLowerCase().startsWith(i.toLowerCase()))
      if (matchedObjectTypes.length === 0) {
        contextValue.stopProcessing = true
        throw new GraphQLError(`Query operation names are required. and must be in the form <verb><object-type><optional noun/adjective list>. "${operationNameTest}" does not start with a known Object Type.`, {
          extensions: {
            stacktrace: null,
            code: 'QUERY_NAME_ERROR'
          }
        })
      }
      const matchedObjectType = matchedObjectTypes.sort((a, b) => b.length - a.length)[0]
      const adjectiveTest = operationNameTest.slice(matchedObjectType.length)
      if (adjectiveTest) {
        const adjectiveList = changeCase.sentenceCase(adjectiveTest).split(' ')
        for (const adjective of adjectiveList) {
          let test = false
          try {
            test = (await wordnet.lookup(adjective.toLowerCase(), true)).find(i =>
              i.meta.synsetType === 'adjective' || i.meta.synsetType === 'adverb' || i.meta.synsetType === 'noun'
            )
          } catch {
            // ignore
          }
          if (!test) {
            contextValue.stopProcessing = true
            throw new GraphQLError(`Query operation names are required. and must be in the form <verb><object-type><optional noun/adjective list>. "${adjective}" does not seem to be an adjective or noun.`, {
              extensions: {
                stacktrace: null,
                code: 'QUERY_NAME_ERROR'
              }
            })
          }
        }
      }
    } else {
      contextValue.stopProcessing = true
      throw new GraphQLError('Query operation names are required.', { extensions: { code: 'QUERY_NAME_ERROR' } })
    }
  }
})

export default namingStandardsPlugin
export { namingStandardsPlugin as plugin }
