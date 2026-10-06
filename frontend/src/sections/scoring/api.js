/**
 * API koreksi manual guru (slice 06).
 *
 * Alurnya dua langkah dan memang begitu di server: minta token konfirmasi
 * (berisi alasan) lalu pakai token itu untuk menyimpan nilai baru. Token
 * berlaku sekali dan hanya sebentar, jadi nilai yang berubah selalu
 * bisa dipertanggungjawabkan. Semua respons divalidasi Zod.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'

/** Satu baris antrean koreksi (memuat kunci — khusus guru). */
export const skemaItemKoreksi = z.object({
  attempt_id: z.number(),
  question_id: z.number(),
  murid_id: z.number().nullable(),
  murid_nama: z.string().nullable(),
  no_attempt: z.number().nullable(),
  status: z.string(),
  status_label: z.string(),
  tipe: z.string(),
  tipe_label: z.string(),
  teks_soal: z.string(),
  jawaban: z.unknown(),
  kunci: z.record(z.string(), z.unknown()),
  skor_maksimal: z.number(),
  skor_sekarang: z.number(),
  dinilai_manual: z.boolean(),
})

/** Antrean koreksi satu kuis. */
export const skemaAntreanKoreksi = z.object({
  kuis_id: z.number(),
  judul_kuis: z.string(),
  mapel_nama: z.string().nullable(),
  kelas_nama: z.string().nullable(),
  alasan_min: z.number(),
  jumlah: z.number(),
  item: z.array(skemaItemKoreksi),
})

/** Token konfirmasi sekali pakai. */
export const skemaTokenKoreksi = z.object({
  token: z.string(),
  expires_at: z.string(),
  ttl_detik: z.number(),
})

/** Hasil penyimpanan koreksi + total attempt yang sudah dihitung ulang. */
export const skemaHasilKoreksi = z.object({
  message: z.string(),
  attempt_id: z.number(),
  question_id: z.number(),
  status: z.string(),
  skor_soal: z.number(),
  skor_maksimal_soal: z.number(),
  total_skor: z.number(),
  total_benar: z.number(),
  total_skor_maksimal: z.number(),
})

/**
 * @typedef {z.infer<typeof skemaAntreanKoreksi>} DataAntrean
 * @typedef {z.infer<typeof skemaItemKoreksi>} DataItemKoreksi
 * @typedef {z.infer<typeof skemaTokenKoreksi>} DataTokenKoreksi
 * @typedef {z.infer<typeof skemaHasilKoreksi>} DataHasilKoreksi
 */

/**
 * @param {number} kuisId
 * @returns {Promise<DataAntrean>}
 */
export async function ambilAntreanKoreksi(kuisId) {
  const respons = await client.get(`/v1/kuis/${kuisId}/koreksi`)
  return skemaAntreanKoreksi.parse(respons.data)
}

/**
 * @param {number} attemptId
 * @param {number} questionId
 * @param {string} alasan
 * @returns {Promise<DataTokenKoreksi>}
 */
export async function mintaTokenKoreksi(attemptId, questionId, alasan) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/attempt/${attemptId}/koreksi/token`, {
    question_id: questionId,
    alasan,
  })
  return skemaTokenKoreksi.parse(respons.data)
}

/**
 * @param {number} attemptId
 * @param {{ question_id: number, skor: number, alasan: string, token: string }} data
 * @returns {Promise<DataHasilKoreksi>}
 */
export async function simpanKoreksi(attemptId, data) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/attempt/${attemptId}/koreksi`, data)
  return skemaHasilKoreksi.parse(respons.data)
}
