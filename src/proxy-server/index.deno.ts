import {startServer} from './start-server.ts'
import {fieldTrackingPlugin, filePlugin, profilePlugin, samplePlugin} from '../plugins/index.ts'

await startServer([ /* dataAnomaliesPlugin, */ profilePlugin, filePlugin, fieldTrackingPlugin, samplePlugin])

/**
 * Note: python-shell is not compatible with Deno. Need to either fork python-shell or go with a plain spawn to resolve.
 */