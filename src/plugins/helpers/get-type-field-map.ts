import {
    type FragmentDefinitionNode,
    type GraphQLObjectType,
    type GraphQLSchema,
    isObjectType
} from '../../common/index.js'
import {concreteType} from './concrete-type.js'

import {Maybe} from "./maybe.js";

export type TypeFieldMap = Record<string, string>

export const getTypeFieldMap = (selections: any, objectType: Maybe<GraphQLObjectType>, fragments: Record<string, FragmentDefinitionNode>, schema: GraphQLSchema, parentName?: string): TypeFieldMap => {
    let result = {} satisfies TypeFieldMap
    const fields = objectType?.getFields() ?? {}
    for (const field of selections) {
        if (field.kind === 'FragmentSpread' || field.kind === 'InlineFragment') {
            const fragment = fragments[field.name.value]
            if (fragment) {
                const realType = schema.getType(fragment?.typeCondition?.name.value)
                if (realType) {
                    const finalType = concreteType(realType)
                    if (isObjectType(finalType) && fragment.selectionSet && parentName) {
                        result = {...result, ...getTypeFieldMap(fragment.selectionSet.selections, finalType, fragments, schema)}
                    }
                }
            }
        } else {
            const finalType = concreteType(fields[field.name.value].type)
            if (isObjectType(finalType) && field.selectionSet) {
                result[field.name.value] = getTypeFieldMap(field.selectionSet.selections, finalType, fragments, schema, field.name.value as string)
            } else {
                result[field.name.value] = finalType.name
            }
        }
    }
    return result
}
