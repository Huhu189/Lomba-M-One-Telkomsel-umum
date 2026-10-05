/**
 * Service realtime (slice 00): kerangka Fastify + ioredis.
 * Tanpa akses database; Redis lazy (tidak crash bila Redis mati — fail-open).
 * SSE untuk Live Monitor diimplementasikan pada slice 07.
 */
import Fastify from 'fastify'
import Redis from 'ioredis'
import { pathToFileURL } from 'node:url'

/**
 * Bangun instance aplikasi Fastify (diekspor untuk test).
 * @param {{ logger?: boolean }} [options]
 */
export function buildApp(options = {}) {
  const app = Fastify({ logger: options.logger ?? true })

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy: () => null,
  })
  redis.on('error', (err) => {
    app.log.warn({ err: err.message }, 'redis tidak terjangkau (fail-open)')
  })

  app.addHook('onClose', async () => {
    redis.disconnect()
  })

  app.get('/health', async () => ({
    ok: true,
    service: 'realtime',
    time: new Date().toISOString(),
  }))

  app.get('/ready', async () => {
    let statusRedis = redis.status
    if (redis.status === 'waiting') {
      try {
        await redis.connect()
        await redis.ping()
        statusRedis = 'ready'
      } catch {
        statusRedis = 'down'
      }
    }
    return {
      ok: true,
      service: 'realtime',
      redis: statusRedis,
      time: new Date().toISOString(),
    }
  })

  return app
}

/**
 * Jalankan server (hanya saat file dieksekusi langsung).
 */
export async function start() {
  const app = buildApp()
  try {
    await app.listen({
      port: Number(process.env.PORT ?? 4000),
      host: process.env.HOST ?? '0.0.0.0',
    })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

const dieksekusiLangsung =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (dieksekusiLangsung) {
  start()
}
