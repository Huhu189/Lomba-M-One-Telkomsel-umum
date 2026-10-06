/**
 * @vitest-environment jsdom
 *
 * Vitest interceptor client.js di lingkungan jsdom:
 * - 401/419 -> event auth:sesi-habis (sekali, tanpa loop)
 * - 429 -> event auth:throttle dengan detail.detik dari header Retry-After
 * - respons 200 -> tidak ada event
 *
 * Adapter stub melempar AxiosError asli sehingga interceptor respons berjalan
 * persis seperti di browser.
 */
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import axios from 'axios'
import { client, resetStatusSiaran } from '../../../shared/api/client.js'

/**
 * Pasang adapter yang selalu gagal dengan AxiosError status tertentu.
 * @param {number} status
 * @param {Record<string, string>} headers
 */
function pasangAdapterGagal(status, headers = {}) {
  client.defaults.adapter = async (konfig) => {
    throw new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', konfig, {}, {
      data: {},
      status,
      statusText: String(status),
      headers,
      config: konfig,
    })
  }
}

/**
 * Kumpulkan event ke vi.fn().
 * @param {string} nama
 */
function dengarkanEvent(nama) {
  const dengar = vi.fn()
  window.addEventListener(nama, dengar)
  return dengar
}

describe('interceptor sesi & throttle', () => {
  beforeEach(() => {
    resetStatusSiaran()
  })

  afterEach(() => {
    client.defaults.adapter = undefined
    vi.restoreAllMocks()
  })

  it('401 memicu satu event auth:sesi-habis (tanpa loop saat beruntun)', async () => {
    pasangAdapterGagal(401)
    const dengar = dengarkanEvent('auth:sesi-habis')

    await client.get('/v1/tes').catch(() => {})
    await client.get('/v1/tes').catch(() => {})
    await client.get('/v1/tes').catch(() => {})

    expect(dengar).toHaveBeenCalledTimes(1)
    window.removeEventListener('auth:sesi-habis', dengar)
  })

  it('419 juga dihitung sesi habis', async () => {
    pasangAdapterGagal(419)
    const dengar = dengarkanEvent('auth:sesi-habis')

    await client.get('/v1/tes').catch(() => {})
    expect(dengar).toHaveBeenCalledTimes(1)

    window.removeEventListener('auth:sesi-habis', dengar)
    resetStatusSiaran()
  })

  it('429 memicu auth:throttle dengan detik dari Retry-After', async () => {
    pasangAdapterGagal(429, { 'retry-after': '17' })
    const dengar = dengarkanEvent('auth:throttle')

    await client.get('/v1/tes').catch(() => {})
    expect(dengar).toHaveBeenCalledTimes(1)
    expect(dengar.mock.calls[0][0].detail).toEqual({ detik: 17 })

    window.removeEventListener('auth:throttle', dengar)
  })

  it('respons sukses tidak memicu event apa pun', async () => {
    client.defaults.adapter = async (konfig) => ({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: konfig,
    })
    const dengarSesi = dengarkanEvent('auth:sesi-habis')
    const dengarThrottle = dengarkanEvent('auth:throttle')

    await client.get('/v1/tes')

    expect(dengarSesi).not.toHaveBeenCalled()
    expect(dengarThrottle).not.toHaveBeenCalled()

    window.removeEventListener('auth:sesi-habis', dengarSesi)
    window.removeEventListener('auth:throttle', dengarThrottle)
  })
})
