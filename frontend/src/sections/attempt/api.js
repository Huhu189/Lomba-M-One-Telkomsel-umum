/**
 * API pengerjaan kuis (slice 04). Semua respons divalidasi Zod.
 * Sesi murni cookie; mutasi memanggil /sanctum/csrf-cookie lebih dulu.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'
import { skemaKonten } from '../question/api.js'

/** Soal seperti diterima layar pengerjaan (urutan sudah diacak server, tanpa kunci). */
export const skemaSoalKerjakan = z.object({
  id: z.number(),
  nomor: z.number(),
  tipe: z.string(),
  tipe_label: z.string(),
  konten: skemaKonten,
  skor: z.number(),
})

/** Jawaban yang sudah tersimpan di server (dikirim sebagai daftar, bukan peta). */
export const skemaJawabanTersimpan = z.object({
  question_id: z.number(),
  jawaban: z.unknown(),
})

/** Attempt berjalan beserta soal yang harus dikerjakan. */
export const skemaAttempt = z.object({
  id: z.number(),
  quiz_id: z.number(),
  jenis: z.string(),
  jenis_label: z.string(),
  status: z.string(),
  status_label: z.string(),
  judul_kuis: z.string().optional(),
  mapel_nama: z.string().nullable().optional(),
  kelas_nama: z.string().nullable().optional(),
  durasi_menit: z.number().optional(),
  mulai_at: z.string(),
  deadline_at: z.string(),
  server_now: z.string(),
  sisa_detik: z.number(),
  terlambat: z.boolean(),
  jumlah_soal: z.number(),
  skor: z.number().nullable(),
  skor_maksimal: z.number().nullable(),
  jumlah_benar: z.number(),
  dikumpulkan_at: z.string().nullable(),
  soal: z.array(skemaSoalKerjakan),
  jawaban: z.array(skemaJawabanTersimpan),
})

/** Hasil penilaian satu soal (tanpa kunci jawaban). */
export const skemaPerSoal = z.object({
  question_id: z.number(),
  nomor: z.number(),
  tipe: z.string(),
  tipe_label: z.string(),
  status: z.string(),
  status_label: z.string(),
  benar: z.boolean().nullable(),
  skor: z.number(),
  skor_maksimal: z.number(),
  terjawab: z.boolean(),
})

/** Hasil ulangan murid. */
export const skemaHasil = z.object({
  id: z.number(),
  quiz_id: z.number(),
  jenis: z.string(),
  jenis_label: z.string(),
  status: z.string(),
  status_label: z.string(),
  judul_kuis: z.string().optional(),
  mapel_nama: z.string().nullable().optional(),
  kelas_nama: z.string().nullable().optional(),
  mulai_at: z.string(),
  deadline_at: z.string(),
  dikumpulkan_at: z.string().nullable(),
  terlambat: z.boolean(),
  skor: z.number().nullable(),
  skor_maksimal: z.number().nullable(),
  jumlah_benar: z.number(),
  jumlah_soal: z.number(),
  per_soal: z.array(skemaPerSoal),
  ringkasan_penilaian: z.object({
    dinilai: z.number(),
    perlu_tinjau: z.number(),
    gagal: z.number(),
    belum_dijawab: z.number(),
  }),
})

/** Respons simpan jawaban (autosave). */
export const skemaResponsJawab = z.object({
  message: z.string(),
  question_id: z.number(),
  status: z.string(),
})

/**
 * @typedef {z.infer<typeof skemaAttempt>} DataAttempt
 * @typedef {z.infer<typeof skemaSoalKerjakan>} DataSoalKerjakan
 * @typedef {z.infer<typeof skemaHasil>} DataHasil
 * @typedef {z.infer<typeof skemaPerSoal>} DataPerSoal
 */

/**
 * Mulai (atau lanjutkan) attempt murid untuk sebuah kuis.
 * @param {number} kuisId
 * @returns {Promise<DataAttempt>}
 */
export async function mulaiKuis(kuisId) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/kuis/${kuisId}/mulai`)
  return skemaAttempt.parse(respons.data)
}

/**
 * @param {number} attemptId
 * @returns {Promise<DataAttempt>}
 */
export async function ambilAttempt(attemptId) {
  const respons = await client.get(`/v1/attempt/${attemptId}`)
  return skemaAttempt.parse(respons.data)
}

/**
 * @param {number} attemptId
 * @param {number} questionId
 * @param {unknown} jawaban
 * @returns {Promise<z.infer<typeof skemaResponsJawab>>}
 */
export async function kirimJawaban(attemptId, questionId, jawaban) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/attempt/${attemptId}/jawab`, {
    question_id: questionId,
    jawaban,
  })
  return skemaResponsJawab.parse(respons.data)
}

/**
 * Kumpulkan + nilai. Kunci idempotensi membuat dobel klik aman.
 * @param {number} attemptId
 * @param {string} idempotencyKey
 * @returns {Promise<DataHasil>}
 */
export async function kumpulkanAttempt(attemptId, idempotencyKey) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/attempt/${attemptId}/kumpulkan`, {
    idempotency_key: idempotencyKey,
  })
  return skemaHasil.parse(respons.data)
}

/**
 * @param {number} attemptId
 * @returns {Promise<DataHasil>}
 */
export async function ambilHasil(attemptId) {
  const respons = await client.get(`/v1/attempt/${attemptId}/hasil`)
  return skemaHasil.parse(respons.data)
}

/**
 * Kunci idempotensi baru (aman diulang dari mana pun).
 * @returns {string}
 */
export function kunciIdempotensiBaru() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `ulangan-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}
