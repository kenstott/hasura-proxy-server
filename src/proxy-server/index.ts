import { startServer } from './start-server.js'
import { PLUGINS } from './config.js'
import { altPath, altProcess, type HasuraPlugin } from '../common/index.js'
import { createRequire } from 'module'
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
await startServer(plugins)
