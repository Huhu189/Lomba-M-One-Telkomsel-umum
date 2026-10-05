/**
 * API kesehatan backend (slice 00).
 * Aturan pagar mutu: data dari luar (API/SSE/localStorage) selalu lewat Zod.
 */
import { z } from 'zod'
import { client } from './client.js'

/** Skema respons /api/v1/health. */
export const skemaHealth = z.object({
  ok: z.literal(true),
  service: z.string(),
  database: z.boolean(),
  time: z.string(),
})

/**
 * Ambil status kesehatan backend (sudah tervalidasi Zod).
 * @returns {Promise<z.infer<typeof skemaHealth>>}
 */
export async function ambilHealth() {
  const respons = await client.get('/v1/health')
  return skemaHealth.parse(respons.data)
}
