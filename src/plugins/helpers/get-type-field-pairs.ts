import {
    type FragmentDefinitionNode,
    type GraphQLObjectType,
    type GraphQLSchema,
    isObjectType
} from '../../common/index.js'
import {concreteType} from './concrete-type.js'

import {Maybe} from "./maybe.js";

export type TypeFieldPair = Array<{
    type?: string
    field: string
}>
export const getTypeFieldPairs = (selections: any, objectType: Maybe<GraphQLObjectType>, fragments: Record<string, FragmentDefinitionNode>, schema: GraphQLSchema, result: TypeFieldPair = []): TypeFieldPair => {
    const fields = objectType?.getFields() ?? {}
    for (const field of selections) {
        if (field.kind === 'FragmentSpread' || field.kind === 'InlineFragment') {
            const fragment = fragments[field.name.value]
            if (fragment) {
                const realType = schema.getType(fragment?.typeCondition?.name.value)
                if (realType) {
                    const finalType = concreteType(realType)
                    if (isObjectType(finalType) && fragment.selectionSet) {
                        getTypeFieldPairs(fragment.selectionSet.selections, finalType, fragments, schema, result)
                    }
                }
            }
        } else {
            const finalType = concreteType(fields[field.name.value].type)
            if (isObjectType(finalType) && field.selectionSet) {
                getTypeFieldPairs(field.selectionSet.selections, finalType, fragments, schema, result)
            } else {
                result.push({
                    type: objectType?.name,
                    field: field.name.value
                })
            }
        }
    }
    return result
}
