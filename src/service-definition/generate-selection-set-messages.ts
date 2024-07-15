import {
  type GraphQLOutputType,
  type GraphQLSchema,
  isListType, isNonNullType,
  isObjectType,
  Kind,
  type SelectionSetNode, type StringValueNode
} from 'graphql'
import { Message } from './message'
import type { Enum } from './enum'
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import gql from 'graphql-tag'
import type { Maybe } from 'graphql/jsutils/Maybe'
import type { GraphQLObjectType } from 'graphql/type/definition'
import { Field } from './field'
import { generateFieldFromType } from './generate-field-from-type'
import { traverseDirectories } from '../common/traverse-directories'

function generateSelectionSetObject (parentObject: Maybe<GraphQLObjectType | GraphQLOutputType>, opName: string, selectionSet: SelectionSetNode, message?: Partial<Message>, supportingMessages?: Record<string, Message>): { message: Message, supportingMessages: Record<string, Message> } {
  supportingMessages = supportingMessages ?? {}
  message = message ?? new Message({ fields: [], name: opName })
  for (const field of selectionSet.selections) {
    if (field.kind === Kind.FIELD) {
      if (field.selectionSet && parentObject) {
        const selectionSetField = new Field({ name: field.name.value, type: `${message.name}_${field.name.value}` })
        while (!isObjectType(parentObject)) {
          if (isListType(parentObject)) {
            parentObject = parentObject.ofType
          }
          if (isNonNullType(parentObject)) {
            parentObject = parentObject.ofType
          }
        }
        let selectionType = parentObject?.getFields()[field.name.value].type
        if (isNonNullType(selectionType)) {
          selectionType = selectionType.ofType
          selectionSetField.required = true
        }
        if (isListType(selectionType)) {
          selectionType = selectionType.ofType
          selectionSetField.repeated = true
        }
        const response = generateSelectionSetObject(
          parentObject?.getFields()[field.name.value].type,
                    `${message.name}_${field.name.value}`,
                    field.selectionSet,
                    undefined
        )
        supportingMessages = { ...(supportingMessages || {}), [response.message.name]: response.message, ...response.supportingMessages }
        selectionSetField.description = (field.directives?.find((i) => i.name.value === 'comment')?.arguments?.find((i) => i.name.value === 'text')?.value as StringValueNode)?.value
        message.addField?.(selectionSetField)
      } else {
        const selectionSetField = new Field({ name: field.name.value })
        while (!isObjectType(parentObject)) {
          if (isListType(parentObject)) {
            parentObject = parentObject.ofType
          }
          if (isNonNullType(parentObject)) {
            parentObject = parentObject.ofType
          }
        }
        const { field: revisedSelectionField } = generateFieldFromType({ name: field.name.value, type: parentObject?.getFields()[field.name.value].type, field: selectionSetField })
        revisedSelectionField.description = (field.directives?.find((i) => i.name.value === 'comment')?.arguments?.find((i) => i.name.value === 'text')?.value as StringValueNode)?.value
        message.addField?.(new Field(revisedSelectionField))
      }
    }
  }
  return { message: message as Message, supportingMessages }
}

/**
 * Generates messages representing a SelectionSet for a given GraphQL query.
 * @param {GraphQLSchema} schema - The GraphQL schema.
 * @returns {Record<string, Message | Enum>} - The generated SelectionSet messages.
 */
export const generateSelectionSetMessages = (schema: GraphQLSchema): Record<string, Message | Enum> => {
  assert(process.env.RESTIFIED_OPS)
  let messages = {}
  const basePath = path.resolve(process.env.RESTIFIED_OPS)
  traverseDirectories(basePath, (filePath: string, _stat: fs.Stats) => {
    const restOp = path.basename(filePath)
    if (['get', 'post'].includes(restOp)) {
      const files = fs.readdirSync(filePath).filter((i) => i.toLowerCase().endsWith('.gql'))
      for (const filename of files) {
        const opName = path.parse(filename).name
        const gqlOp = fs.readFileSync(path.resolve(filePath, filename)).toString('utf-8')
        const opParsed = gql(gqlOp)
        for (const op of opParsed.definitions) {
          if (op.kind === Kind.OPERATION_DEFINITION) {
            const {
              message: selectionSetMessage,
              supportingMessages: newMessages
            } = generateSelectionSetObject(schema.getQueryType(), opName + 'SelectionSet', op.selectionSet)
            const queryReturnMessage = new Message({ name: opName + 'Result', fields: [] })
            queryReturnMessage.addField(new Field({ name: 'data', type: opName + 'SelectionSet' }))
            queryReturnMessage.addField(new Field({ name: 'errors', repeated: true, type: 'GraphQLError' }))
            queryReturnMessage.addField(new Field({ name: 'extensions', type: 'object' }))
            selectionSetMessage.description = (op.directives?.find((i) => i.name.value === 'comment')?.arguments?.find((i) => i.name.value === 'text')?.value as StringValueNode)?.value
            messages = {
              ...messages,
              ...newMessages,
              [selectionSetMessage?.name || '']: selectionSetMessage,
              [queryReturnMessage?.name || '']: queryReturnMessage
            }
          }
        }
      }
    }
  })
  return messages
}
