import { describe, expect, it } from 'vitest'
import { skemaHealth } from '../../../shared/api/health.js'

describe('skemaHealth (data dari luar selalu lewat Zod)', () => {
  it('menerima respons health yang valid', () => {
    const hasil = skemaHealth.safeParse({
      ok: true,
      service: 'backend',
      database: true,
      time: '2026-10-05T09:00:00+00:00',
    })
    expect(hasil.success).toBe(true)
  })

  it('menolak respons dengan ok bukan true', () => {
    const hasil = skemaHealth.safeParse({
      ok: false,
      service: 'backend',
      database: true,
      time: 'x',
    })
    expect(hasil.success).toBe(false)
  })

  it('menolak respons yang kehilangan kolom', () => {
    const hasil = skemaHealth.safeParse({ ok: true, service: 'backend' })
    expect(hasil.success).toBe(false)
  })
})
