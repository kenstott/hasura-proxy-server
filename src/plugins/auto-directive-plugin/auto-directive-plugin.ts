// Extract the logic into a separate function
import { plugin } from '../../plugin-builder/index.js'
import { Kind, parse, visit } from '../../common/index.js'
import { AUTO_DIRECTIVES } from '../../proxy-server/config.js'

export const autoDirectivePlugin = plugin({
  // operationDirective: '@sample(count: Int!, random: Boolean = false, fromEnd: Boolean = false)',
  argDefaults: {},
  willSendResponsePluginResolver: async (requestContext) => {
    const { contextValue, operation, request } = requestContext
    const { query } = request || {}
    if (!operation?.selectionSet.loc?.start || !AUTO_DIRECTIVES || contextValue.isSchemaQuery || operation?.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !query) {
      return
    }
    try {
      const directivesToBeAdded = AUTO_DIRECTIVES.split(',').map((i: string) => i.trim()).filter(Boolean)
      const directiveNamesToBeAdded = directivesToBeAdded.map((i: string) => i.match(/^@([^(]*)/)?.[1]).filter(Boolean)
      visit(operation, {
        Directive: {
          leave: (node) => {
            const toBeAddedIndex = directiveNamesToBeAdded.findIndex(i => i === node.name.value)
            if (toBeAddedIndex !== -1) {
              directivesToBeAdded.splice(toBeAddedIndex, 1)
              directiveNamesToBeAdded.splice(toBeAddedIndex, 1)
            }
            return node
          }
        }
      })
      let revisedQuery = ''
      for (const i of directivesToBeAdded) {
        revisedQuery = query.slice(0, operation.selectionSet.loc.start) + i + ' ' + query.slice(operation.selectionSet.loc.start)
      }
      requestContext.contextValue.revisedOperation = parse(revisedQuery).definitions[0]
    } catch {
      // ignore
    }
  }
})

export interface AutoDirectivePluginArgs {}

export default autoDirectivePlugin
export { autoDirectivePlugin as plugin }
