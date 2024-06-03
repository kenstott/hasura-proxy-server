// Extract the logic into a separate function
import { plugin } from '../../plugin-builder/index.js'
import { Kind, parse, visit, print, type OperationDefinitionNode, type DirectiveNode, type ValueNode } from '../../common/index.js'
import { AUTO_DIRECTIVES } from '../../proxy-server/config.js'

const convertValue = (i: ValueNode): null | string => {
  if (i.kind === 'NullValue') {
    return null
  } else if (i.kind === 'Variable') {
    return '$' + i.name.value
  } else if (i.kind === 'ListValue') {
    return JSON.stringify([...new Set(i.values.map(convertValue))])
  } else if (i.kind === 'ObjectValue') {
    return JSON.stringify([...new Set(i.fields.map(i => ({ [i.name.value]: convertValue(i.value) })))])
  } else if (i.kind === 'StringValue') {
    return i.value.toString()
  } else if (i.kind === 'FloatValue') {
    return i.value.toString()
  } else if (i.kind === 'IntValue') {
    return i.value.toString()
  }
  return null
}
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
      const header = [AUTO_DIRECTIVES || '', process.env.TEMP_AUTO_DIRECTIVES || ''].filter(Boolean).join(',')
      const directivesToBeAdded = header.split(',').map((i: string) => i.trim()).filter(Boolean)
      const oldDirectives: DirectiveNode[] = []
      const noDirectivesOperation = visit(operation, {
        Directive: (node) => {
          oldDirectives.push(node)
          return null
        }
      })
      let revisedQuery = print(noDirectivesOperation)
      const z = parse(revisedQuery)
      const insertAt = (z.definitions[0] as OperationDefinitionNode).selectionSet?.loc?.start
      if (insertAt) {
        revisedQuery = revisedQuery.slice(0, insertAt) + directivesToBeAdded.join(' ') + ' ' + revisedQuery.slice(insertAt)
        const finalRevised = visit(parse(revisedQuery), {
          Directive: (node) => {
            for (const o of oldDirectives) {
              if (o.name.value === node.name.value) {
                return null
              }
            }
            return node
          }
        })
        requestContext.contextValue.revisedOperation = parse(print(finalRevised)).definitions[0]
        delete process.env.TEMP_AUTO_DIRECTIVES
      }
    } catch {
      // ignore
    }
  }
})

export interface AutoDirectivePluginArgs {}

export default autoDirectivePlugin
export { autoDirectivePlugin as plugin }
