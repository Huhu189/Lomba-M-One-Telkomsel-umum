/**
 * API bank soal & tag (slice 03). Semua data dari server divalidasi Zod.
 * Sesi murni cookie; mutasi memanggil /sanctum/csrf-cookie lebih dulu.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'

/** Konten soal bebas bentuk (teks + opsi/kiri/kanan/item + media/MathML). */
export const skemaKonten = z.record(z.string(), z.unknown())

/** Skema tag (= tema pemahaman). */
export const skemaTag = z.object({
  id: z.number(),
  nama: z.string(),
  deskripsi: z.string().nullable(),
  jumlah_soal: z.number().optional(),
})

/** Skema soal versi guru (memuat kunci jawaban). */
export const skemaSoal = z.object({
  id: z.number(),
  subject_id: z.number(),
  tag_id: z.number().nullable(),
  tipe: z.string(),
  tipe_label: z.string(),
  objektif: z.boolean(),
  konten: skemaKonten,
  kunci: skemaKonten,
  pembahasan: z.string().nullable(),
  skor: z.number(),
  aktif: z.boolean(),
  mapel_nama: z.string().optional(),
  tag_nama: z.string().nullable().optional(),
})

/** Skema soal versi murid — TANPA kunci/pembahasan (dipaksa server). */
export const skemaSoalMurid = z.object({
  id: z.number(),
  tipe: z.string(),
  tipe_label: z.string(),
  konten: skemaKonten,
  skor: z.number(),
})

/** Halaman bank soal (endpoint memakai paginasi). */
export const skemaHalamanSoal = z.object({
  data: z.array(skemaSoal),
  meta: z.object({
    total: z.number(),
    current_page: z.number(),
    last_page: z.number(),
  }),
})

/**
 * @typedef {z.infer<typeof skemaTag>} DataTag
 * @typedef {z.infer<typeof skemaSoal>} DataSoal
 * @typedef {z.infer<typeof skemaSoalMurid>} DataSoalMurid
 */

/** @returns {Promise<DataTag[]>} */
export async function ambilTag() {
  const respons = await client.get('/v1/tag')
  return z.array(skemaTag).parse(respons.data)
}

/**
 * @param {{ nama: string, deskripsi?: string }} data
 * @returns {Promise<DataTag>}
 */
export async function buatTag(data) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/tag', data)
  return skemaTag.parse(respons.data)
}

/**
 * @param {number} id
 * @param {{ nama: string, deskripsi?: string }} data
 * @returns {Promise<DataTag>}
 */
export async function ubahTag(id, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/tag/${id}`, data)
  return skemaTag.parse(respons.data)
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function hapusTag(id) {
  await ambilCsrfCookie()
  await client.delete(`/v1/tag/${id}`)
}

/**
 * Daftar soal bank soal dengan filter opsional (mapel/tag/tipe/halaman).
 * @param {{ subjectId?: number|null, tagId?: number|null, tipe?: string|null, halaman?: number }} [filter]
 * @returns {Promise<z.infer<typeof skemaHalamanSoal>>}
 */
export async function ambilSoal(filter = {}) {
  /** @type {Record<string, string|number>} */
  const params = { page: filter.halaman ?? 1 }

  if (filter.subjectId) params['filter[subject_id]'] = filter.subjectId
  if (filter.tagId) params['filter[tag_id]'] = filter.tagId
  if (filter.tipe) params['filter[tipe]'] = filter.tipe

  const respons = await client.get('/v1/soal', { params })
  return skemaHalamanSoal.parse(respons.data)
}

/**
 * @param {import('./tipeSoal.js').MuatanSoal} data
 * @returns {Promise<DataSoal>}
 */
export async function buatSoal(data) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/soal', data)
  return skemaSoal.parse(respons.data)
}

/**
 * @param {number} id
 * @param {import('./tipeSoal.js').MuatanSoal} data
 * @returns {Promise<DataSoal>}
 */
export async function ubahSoal(id, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/soal/${id}`, data)
  return skemaSoal.parse(respons.data)
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function hapusSoal(id) {
  await ambilCsrfCookie()
  await client.delete(`/v1/soal/${id}`)
}
