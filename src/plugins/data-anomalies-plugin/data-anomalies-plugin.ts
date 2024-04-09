import {plugin} from '../../plugin-builder/index.js'
import {GetAnomalousRecords} from "./get-anomalous-records.js";
import {Kind} from "../../common";

/**
 * @description Adds @validate operation directive to queries, which will
 * execute json schema validations against the returned data set, and return
 * the results in the extensions
 *
 * @returns {HasuraPlugin} The plugin that is passed to our Hasura proxy server. The plugin is passed
 * dynamically by supplying a local or remote path to the module.
 */

export const dataAnomaliesPlugin = plugin({
    // Define you operation directive here....in SDL
    operationDirective: '@anomalies("""A value in the range of -.5 to .5, being most anomalous to least anomalous.""" threshold: Float!)',
    operationDirectiveHelp: 'Vectorizes all text attributes as enumerables. Trains against same dataset. And returns anomalous records in the extensions',

    // Define your arg defaults in TypeScript - to match the arg defaults in your SDL
    argDefaults: {},

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
        const {threshold} = args as DataAnomaliesPluginArgs
        span?.setAttributes(ctxArgs)
        try {
            let anomalies = {}
            const getAnomalousRecords = new GetAnomalousRecords('./.venv/bin/python3')
            for (const entry of Object.entries(singleResult.data ?? {})) {
                const [key, dataset] = entry as [string, Record<string, unknown>[]]
                anomalies[key] = await getAnomalousRecords.getScores(dataset, threshold)
            }
            getAnomalousRecords.destroy()
            // Add your new data into the extensions - OR - augment the original data
            addToExtensions(singleResult, {anomalies})
        } catch (error) {
            // Trap processing errors like this...
            addToErrors(singleResult, error as Error, {
                code: 'ANOMALIES_ERROR'
            })
        }
    }
})

/**
 * @description Create an interface describing your directive arguments
 */
interface DataAnomaliesPluginArgs {
    threshold: number
}

// Always export it as the default
export default dataAnomaliesPlugin
export {dataAnomaliesPlugin as plugin}
