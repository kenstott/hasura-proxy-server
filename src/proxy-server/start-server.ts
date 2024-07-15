import { ApolloServer } from '@apollo/server'
import express, { type ErrorRequestHandler, type Express, type Request, type RequestHandler } from 'express'
import { expressMiddleware } from '@apollo/server/express4'
import { hasuraWrapper, reloadSchema } from './hasura-wrapper.js'
import assert from 'assert'
import { hasuraContext } from './hasura-context.js'
import { HASURA_ADMIN_SECRET, HASURA_URI, PORT } from './config.js'
import { type HasuraContext, type HasuraPlugin } from '../common/index.js'
import { spanError, spanOK, startActiveTrace } from './telemetry.js'
import { FileFormat } from '../plugins/file-plugin/output-file.js'
import * as http from 'http'
import { type Span } from '@opentelemetry/api'
import cors from 'cors'
import { dataProducts } from '../routes/data-products.js'

/**
 * @description Abstracts away all details of instantiating the Apollo Server as a Hasura Proxy.
 * @param hasuraPlugins {HasuraPlugin[]} A collection of Hasura Plugins you want to apply to the results of data
 * retrieved from the call the HGE.
 */
export const startServer = async (hasuraPlugins: HasuraPlugin[]): Promise<Express> => {
  return await startActiveTrace(import.meta.url, async (span) => {
    assert(HASURA_URI, 'Valid Hasura URI graphql endpoint is required.')
    assert(HASURA_ADMIN_SECRET, 'Valid Hasura Admin Secret is required.')
    assert(PORT, 'Valid PORT # is required.')

    span?.setAttributes({
      HASURA_URI,
      PORT,
      pluginCount: hasuraPlugins.length
    })

    const uri = new URL(HASURA_URI)
    const adminSecret = HASURA_ADMIN_SECRET
    const port = parseInt(PORT ?? '4000')

    const app = express()
    const httpServer = http.createServer(app)
    app.use(cors())
    const server = new ApolloServer<HasuraContext>({
      ...await hasuraWrapper({ uri, adminSecret, hasuraPlugins, httpServer })
    })
    await server.start()

    app.get('/', (req, res, _next) => {
      if (req.url === '/') {
        res.redirect('/graphql')
      }
    })
    app.post('/gql/:file', express.json(), (req, res, next) => {
      const formatString = req.params.file.toLowerCase()
      const format: FileFormat = FileFormat[formatString as keyof typeof FileFormat]
      if (format) {
        process.env.TEMP_AUTO_DIRECTIVES = `@file(format: ${format}, output: BASE64)`
      }
      expressMiddleware(server, {
        context: hasuraContext
      })(req, res, next)
    })
    app.post('/graphql', (_req, _res, next) => {
      next()
    })
    app.get('/graphql/data-products', dataProducts)
    app.get('/reload-schema', (async (_req, res, _next) => {
      await reloadSchema({ uri, adminSecret, hasuraPlugins, server })
      res.json({ reloaded: true })
    }) as RequestHandler)
    app.use('/graphql', express.json(), expressMiddleware(server, {
      context: hasuraContext
    }))
    app.use('/graphql-internal', expressMiddleware(server, {
      context: hasuraContext
    }))
    app.post('/metadata', express.json(), (async (req: Request, res, _next) => {
      if (req.get('x-hasura-admin-secret') !== process.env.HASURA_ADMIN_SECRET) {
        throw new Error('Requires valid x-hasura-admin-secret header')
      }
      const response = await fetch(process.env.HASURA_URI?.replace(/graphql/, 'metadata') || '', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hasura-role': 'admin',
          'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET || ''
        },
        body: JSON.stringify(req.body?.type
          ? req.body
          : {
              type: 'export_metadata',
              args: {}
            })
      })
      const json = await response.json()
      res.json(json)
    }) as RequestHandler)

    const errorHandler: ErrorRequestHandler = (err: { code: string }, req, res, _next) => {
      // special case for file download requests - when apollo server is still trying
      // to send response
      if (req.url.includes('gql') && err.code === 'ERR_HTTP_HEADERS_SENT') {
        res.status(200)
      // otherwise ignore
      } else {
        res.status(500)
      }
    }
    app.use(errorHandler)
    httpServer.listen({ port }, () => {
      console.log(`🚀 Server listening on port ${port}`)
      const reloadInterval = parseInt(process.env.RELOAD_SCHEMA_INTERVAL_MS || '0')
      if (reloadInterval) {
        const reload = async (): Promise<void> => {
          await startActiveTrace('reload-hasura-schema', async (span: Span) => {
            try {
              await reloadSchema({ uri, adminSecret, hasuraPlugins, server })
            } catch (error) {
              spanError(span, (error as Error))
            } finally {
              spanOK(span)
            }
          })
        }
        setInterval(() => {
          void (async () => {
            await reload()
          })()
        }, reloadInterval)
      }
    })
    return app
  })
}
