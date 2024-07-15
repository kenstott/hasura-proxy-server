import { startServer } from './start-server.js'
import { startServer as startGRPCServer } from '../grpc/start-grpc-server'
import { startServer as startJSONRPCServer } from '../json-rpc/start-json-rpc-server'
import { PLUGINS } from './config.js'
import { altPath, altProcess, type HasuraPlugin } from '../common/index.js'
import { createRequire } from 'module'
import { restified } from '../openapi/restified'
// @ts-expect-error Deno is only available when running under the Deno engine
if (typeof Deno !== 'undefined') {
  // do nothing
} else {
  // add require feature back to NodeJS globals - for ESM modules
  global.require = createRequire(import.meta.url)
}

const plugins = [] as HasuraPlugin[]
for (const modulePath of (PLUGINS ?? '').split(',').filter(Boolean)) {
  const p = await import(altPath.resolve(altProcess.cwd(), modulePath))
  plugins.push(p.default as HasuraPlugin)
}
const app = await startServer(plugins)
if (process.env.GRPC_PORT) {
  await startGRPCServer(app)
}
if (process.env.JSON_RPC_HTTP_PORT || process.env.JSON_RPC_SOCKETS_PORT) {
  await startJSONRPCServer(app)
}
if (process.env.RESTIFIED_OPS) {
  await restified(app)
}
