import { plugin } from '../../plugin-builder/index.js'
import { GetClusters } from './get-clusters'
import { Kind } from '../../common'

/**
 * @description Adds @validate operation directive to queries, which will
 * execute json schema validations against the returned data set, and return
 * the results in the extensions
 *
 * @returns {HasuraPlugin} The plugin that is passed to our Hasura proxy server. The plugin is passed
 * dynamically by supplying a local or remote path to the module.
 */

export const clusterPlugin = plugin({
  // Define you operation directive here....in SDL
  operationDirective: `@cluster(
  """Number of clusters. Overrides optimum number of clusters calculation""" 
  clusters: Int
  )`,
  operationDirectiveHelp: 'Vectorizes all text attributes as enumerables. Trains against same dataset. And returns records with a cluster number',

  // Define your arg defaults in TypeScript - to match the arg defaults in your SDL
  argDefaults: {},
  useWithReplays: true,

  // Define how to process your operation directive here...
  willSendResponsePluginResolver: async ({
    operation,
    context,
    singleResult,
    span,
    args
  }) => {
    if (operation.kind !== Kind.OPERATION_DEFINITION || operation.operation !== 'query' || !singleResult.data) {
      return
    }
    const {
      args: ctxArgs,
      addToErrors,
      addToExtensions
    } = context
    const { clusters } = args as ClusterPluginArgs
    span?.setAttributes(ctxArgs)
    try {
      const getClusters = new GetClusters('./.venv/bin/python3')
      const clusterMap = await getClusters.getClusters(singleResult.data, clusters)
      getClusters.destroy()
      // Add your new data into the extensions - OR - augment the original data
      span?.setAttributes({ extensionJson: JSON.stringify(clusters) })
      addToExtensions(singleResult, { clusters: clusterMap })
    } catch (error) {
      // Trap processing errors like this...
      addToErrors(singleResult, error as Error, {
        code: 'CLUSTER_ERROR'
      })
    }
  }
})

/**
 * @description Create an interface describing your directive arguments
 */
interface ClusterPluginArgs {
  clusters: number
}

// Always export it as the default
export default clusterPlugin
export { clusterPlugin as plugin }
