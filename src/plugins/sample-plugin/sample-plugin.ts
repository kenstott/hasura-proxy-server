// Extract the logic into a separate function
import { type ExecutionResult } from '../helpers'
import { plugin } from '../../plugin-builder'
import { Kind } from '../../common'
import { processSamplePlugin } from './process-sample-plugin'

export const samplePlugin = plugin({
  operationDirective: '@sample(count: Int!, random: Boolean = false, fromEnd: Boolean = false)',
  argDefaults: {
    random: false,
    fromEnd: false
  },
  willSendResponsePluginResolver: async ({ operation, context, singleResult, args, span }) => {
    if (operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !singleResult.data) {
      return
    }
    const { args: ctxArgs, addToErrors } = context
    span?.setAttributes(ctxArgs)
    try {
      await processSamplePlugin((singleResult as ExecutionResult), args as SamplePluginArgs, context)
    } catch (error) {
      addToErrors(singleResult, error as Error, { code: 'PROBLEM_WITH_SAMPLING' })
    }
  }
})

export interface SamplePluginArgs {
  count: number
  random: boolean
  fromEnd: boolean
}

export default samplePlugin
export { samplePlugin as plugin }
