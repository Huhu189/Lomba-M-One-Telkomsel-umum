import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/server.js'

test('/health merespons 200 dengan struktur yang diharapkan', async () => {
  const app = buildApp({ logger: false })
  const res = await app.inject({ method: 'GET', url: '/health' })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.equal(body.service, 'realtime')
  assert.ok(body.time)

  await app.close()
})

test('/ready tetap merespons (fail-open) meski Redis tidak tersedia', async () => {
  const app = buildApp({ logger: false })
  const res = await app.inject({ method: 'GET', url: '/ready' })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.ok, true)
  assert.ok(['down', 'ready', 'connecting', 'wait'].includes(body.redis))

  await app.close()
})
