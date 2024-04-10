import {
  type GraphQLEnumType,
  type GraphQLObjectType,
  type GraphQLScalarType,
  type GraphQLType,
  isListType,
  isNonNullType
} from '../../common/index.js'

export const concreteType = (fieldType: GraphQLType): GraphQLObjectType | GraphQLScalarType | GraphQLEnumType => {
  if (isListType(fieldType)) {
    return concreteType(fieldType.ofType)
  }
  if (isNonNullType(fieldType)) {
    return concreteType(fieldType.ofType)
  }
  return fieldType as GraphQLObjectType | GraphQLScalarType | GraphQLEnumType
}
