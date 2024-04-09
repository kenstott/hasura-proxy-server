import {startServer} from './start-server.js'
import {PLUGINS} from './config.js'
import {type HasuraPlugin} from '../common/index.js'
import path from 'node:path'
import {createRequire} from 'module'

const require = createRequire(import.meta.url)

global.require = require

const plugins = [] as HasuraPlugin[]
for (const modulePath of (PLUGINS ?? '').split(',').filter(Boolean)) {
    const p = await import(path.resolve(process.cwd(), modulePath))
    plugins.push(p.default as HasuraPlugin)
}
await startServer(plugins)
