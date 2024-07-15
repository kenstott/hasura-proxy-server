import { type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { getHasuraSchema } from '../proxy-server/get-hasura-schema'
import {
  type GraphQLEnumType,
  type GraphQLInputObjectType,
  type GraphQLInterfaceType,
  type GraphQLObjectType,
  type GraphQLScalarType,
  type GraphQLType,
  type GraphQLUnionType,
  isLeafType,
  isObjectType,
  isWrappingType
} from 'graphql'

const getWrappedType = (t: GraphQLType): GraphQLInputObjectType | GraphQLInterfaceType | GraphQLEnumType | GraphQLObjectType | GraphQLScalarType | GraphQLUnionType => {
  if (isWrappingType(t)) {
    return getWrappedType(t.ofType)
  }
  return t
}
export const dataProducts = (async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const hasuraSchema = await getHasuraSchema(
    process.env.HASURA_ADMIN_SECRET || '',
    process.env.HASURA_URI || ''
  )
  const queryRootFields = hasuraSchema.getQueryType()?.getFields()
  if (queryRootFields) {
    const products = Object.entries(queryRootFields)
      .filter(([name, _field]) => !name.endsWith('_aggregate') && !name.endsWith('_pk'))
      .reduce<Array<Record<string, any>>>((acc, [name, field]) => {
      const concreteType = getWrappedType(field.type)
      const { description } = concreteType
      if (isObjectType(concreteType)) {
        const fieldList =
                        Object.entries(concreteType.getFields())
                          .filter(([_name, field]) => isLeafType(getWrappedType(field.type)))
                          .map(([name, field]) => ({
                            name,
                            description: field.description,
                            fieldType: getWrappedType(field.type).name
                          }))
        const relationshipList =
                        Object.entries(concreteType.getFields())
                          .filter(([_name, field]) => isObjectType(getWrappedType(field.type)))
                          .map(([name, field]) => ({
                            name,
                            description: field.description,
                            fieldType: getWrappedType(field.type).name
                          }))
        acc = [...acc, { name, description, fieldList, relationshipList }]
      }
      return acc
    }, [])
    res.json(products)
  } else {
    res.json([])
  }
}) as RequestHandler
