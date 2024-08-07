import {
  type DocumentNode,
  type FragmentDefinitionNode,
  type GraphQLSchema,
  type OperationDefinitionNode
} from '../../common/index.js'
import { getTypeFieldPairs, type TypeFieldPair } from './get-type-field-pairs.js'
import { getTypeFieldMap, type TypeFieldMap } from './get-type-field-map.js'
import objectHash from 'object-hash'
import gql from 'graphql-tag'

export const getFieldList = (query: DocumentNode, schema: GraphQLSchema): {
  list: TypeFieldPair
  map: TypeFieldMap
} => {
  const operation = query.definitions.find(({ kind }) => kind === 'OperationDefinition') as OperationDefinitionNode
  const fragments = query.definitions
    .filter(({ kind }) => kind === 'FragmentDefinition')
    .reduce((result, current: FragmentDefinitionNode) => ({
      ...result,
      [current.name.value]: current
    }), {})
  const map = getTypeFieldMap(operation?.selectionSet.selections, schema.getQueryType(), fragments, schema)
  const list = getTypeFieldPairs(operation?.selectionSet.selections, schema.getQueryType(), fragments, schema)
  return {
    list,
    map
  }
}

export const getSelectionSetHash = (query: string, schema: GraphQLSchema): string => objectHash(getFieldList(gql(query), schema).list, {
  algorithm: 'sha256',
  encoding: 'base64'
})
