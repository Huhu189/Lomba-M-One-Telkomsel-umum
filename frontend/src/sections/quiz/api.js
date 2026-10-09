/**
 * API kuis (slice 03). Satu skema toleran dipakai untuk guru dan murid:
 * server yang menentukan bentuknya (murid tidak pernah menerima kunci).
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'
import { skemaKonten } from '../question/api.js'

/** Soal seperti tampil di layar kuis (kunci hanya ada untuk guru). */
export const skemaSoalTampil = z.object({
  id: z.number(),
  tipe: z.string(),
  tipe_label: z.string(),
  konten: skemaKonten,
  skor: z.number(),
  kunci: skemaKonten.optional(),
  pembahasan: z.string().nullable().optional(),
  objektif: z.boolean().optional(),
  aktif: z.boolean().optional(),
  subject_id: z.number().optional(),
  tag_id: z.number().nullable().optional(),
  mapel_nama: z.string().optional(),
  tag_nama: z.string().nullable().optional(),
})

/** Skema kuis (guru/murid; murid tidak menerima kunci di dalam soal). */
export const skemaKuis = z.object({
  id: z.number(),
  judul: z.string(),
  deskripsi: z.string().nullable(),
  status: z.string(),
  status_label: z.string().optional(),
  subject_id: z.number().optional(),
  class_id: z.number().optional(),
  mapel_nama: z.string().optional(),
  kelas_nama: z.string().optional(),
  mulai_at: z.string().nullable(),
  selesai_at: z.string().nullable(),
  durasi_menit: z.number(),
  acak_soal: z.boolean().optional(),
  acak_opsi: z.boolean().optional(),
  jumlah_soal: z.number().optional(),
  sedang_berjalan: z.boolean(),
  soal: z.array(skemaSoalTampil).optional(),
})

/**
 * @typedef {z.infer<typeof skemaKuis>} DataKuis
 * @typedef {z.infer<typeof skemaSoalTampil>} DataSoalTampil
 * @typedef {{
 *   judul: string,
 *   deskripsi?: string,
 *   subject_id: number,
 *   class_id: number,
 *   durasi_menit: number,
 *   mulai_at?: string|null,
 *   selesai_at?: string|null,
 *   acak_soal?: boolean,
 *   acak_opsi?: boolean,
 * }} MuatanKuis
 */

/**
 * Daftar kuis — guru menerima kuis buatannya sendiri (admin seluruh sekolah,
 * K-04), murid hanya kuis terbit kelasnya. Semuanya ditentukan server.
 * @returns {Promise<DataKuis[]>}
 */
export async function ambilKuis() {
  const respons = await client.get('/v1/kuis')
  return z.array(skemaKuis).parse(respons.data)
}

/**
 * @param {number} id
 * @returns {Promise<DataKuis>}
 */
export async function ambilKuisDetail(id) {
  const respons = await client.get(`/v1/kuis/${id}`)
  return skemaKuis.parse(respons.data)
}

/**
 * @param {MuatanKuis} data
 * @returns {Promise<DataKuis>}
 */
export async function buatKuis(data) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/kuis', data)
  return skemaKuis.parse(respons.data)
}

/**
 * @param {number} id
 * @param {MuatanKuis} data
 * @returns {Promise<DataKuis>}
 */
export async function ubahKuis(id, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/kuis/${id}`, data)
  return skemaKuis.parse(respons.data)
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function hapusKuis(id) {
  await ambilCsrfCookie()
  await client.delete(`/v1/kuis/${id}`)
}

/**
 * Susun soal kuis (urutan mengikuti urutan id).
 * @param {number} id
 * @param {number[]} soalId
 * @returns {Promise<DataKuis>}
 */
export async function sinkronSoalKuis(id, soalId) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/kuis/${id}/soal`, { soal: soalId })
  return skemaKuis.parse(respons.data)
}

/**
 * Terbitkan kuis (server memeriksa kelengkapan soal + jadwal).
 * @param {number} id
 * @returns {Promise<DataKuis>}
 */
export async function publikasiKuis(id) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/kuis/${id}/publikasi`)
  return skemaKuis.parse(respons.data)
}

/**
 * @param {number} id
 * @returns {Promise<DataKuis>}
 */
export async function arsipkanKuis(id) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/kuis/${id}/arsip`)
  return skemaKuis.parse(respons.data)
}
