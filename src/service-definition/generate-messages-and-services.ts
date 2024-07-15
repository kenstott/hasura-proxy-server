import { type GraphQLSchema } from 'graphql'
import {
  type Enum,
  generateMessageFromObjectType,
  generateSelectionSetMessages,
  type Message, type RemoteProcedureCall
} from '../service-definition/index.js'
import { generateServices } from '../service-definition/services'

/**
 * Generates the messages and services based on the given GraphQL schema.
 *
 * @param {GraphQLSchema} schema - The GraphQL schema object.
 * @return {Object} - An object containing the generated messages and services.
 *   - queryRoot: The message representing the root query.
 *   - messages: An object containing all the generated messages and enums.
 *   - services: An object containing all the generated services and their RPCs.
 */
export const generateMessagesAndServices = (schema: GraphQLSchema): {
  queryRoot: Message
  messages: Record<string, Message | Enum>
  services: Record<string, Record<string, RemoteProcedureCall>>
} => {
  const { message: queryRoot, supportingMessages } = generateMessageFromObjectType(schema.getQueryType(), {})
  const selectionSetMessages = generateSelectionSetMessages(schema)
  const { services, supportingMessages: serviceMessages } = generateServices()
  const messages = { ...supportingMessages, ...serviceMessages, [queryRoot?.name || '']: queryRoot, ...selectionSetMessages }
  return { queryRoot: queryRoot as Message, messages: messages as Record<string, Message | Enum>, services }
}
