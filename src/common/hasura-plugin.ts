import type { ApolloServerPlugin } from '@apollo/server'
import { type HasuraContext } from './hasura-context.js'
import { type MakeHasuraPluginOptions } from '../plugin-builder/index.js'

export type HasuraPlugin =
    ApolloServerPlugin<HasuraContext>
    & Omit<MakeHasuraPluginOptions, 'willSendResponsePluginResolver'>
