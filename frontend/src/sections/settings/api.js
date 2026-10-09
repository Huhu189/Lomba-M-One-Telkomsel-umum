/**
 * API pengaturan tiga lapis (slice 02) — data eksternal divalidasi Zod.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'

/** Nilai pengaturan dapat berupa boolean atau bilangan bulat. */
export const skemaNilaiPengaturan = z.object({
  nilai: z.union([z.boolean(), z.number()]),
  tipe: z.enum(['boolean', 'integer']),
  label: z.string(),
  kelompok: z.string(),
  bawaan: z.union([z.boolean(), z.number()]),
  sumber: z.enum(['bawaan', 'sekolah', 'kelas', 'kuis']),
  terkunci: z.boolean(),
})

/** Resolusi pengaturan lengkap untuk satu konteks. */
export const skemaResolusiPengaturan = z.object({
  sekolah_id: z.number(),
  kelas_id: z.number().nullable(),
  kuis_id: z.number().nullable(),
  pengaturan: z.record(z.string(), skemaNilaiPengaturan),
})

/**
 * @typedef {z.infer<typeof skemaResolusiPengaturan>} ResolusiPengaturan
 * @typedef {z.infer<typeof skemaNilaiPengaturan>} NilaiPengaturan
 * @typedef {'sekolah' | 'kelas' | 'kuis'} LingkupPengaturan
 */

/**
 * Ambil pengaturan yang berlaku (opsional untuk kelas dan/atau kuis tertentu).
 * Hanya guru/admin — murid menerima saklar proteksinya lewat payload attempt
 * (K-05), jadi halaman ini tidak pernah dipanggil dari sisi murid.
 *
 * @param {number|null} [kelasId]
 * @param {number|null} [kuisId]
 * @returns {Promise<ResolusiPengaturan>}
 */
export async function ambilPengaturan(kelasId, kuisId) {
  /** @type {Record<string, number>} */
  const params = {}
  if (kelasId) params.kelas_id = kelasId
  if (kuisId) params.kuis_id = kuisId

  const respons = await client.get('/v1/pengaturan', { params })
  return skemaResolusiPengaturan.parse(respons.data)
}

/**
 * Simpan satu pengaturan.
 * @param {{
 *   lingkup: LingkupPengaturan,
 *   lingkup_id?: number,
 *   kunci: string,
 *   nilai: boolean | number,
 *   terkunci?: boolean,
 *   kelas_id?: number,
 *   kuis_id?: number,
 * }} muatan
 * @returns {Promise<ResolusiPengaturan>}
 */
export async function simpanPengaturan(muatan) {
  await ambilCsrfCookie()
  const respons = await client.put('/v1/pengaturan', muatan)
  return skemaResolusiPengaturan.parse(respons.data)
}
