/**
 * API anti-cheat + Monitor Ulangan (slice 07). Semua respons divalidasi Zod.
 * Sesi murni cookie; mutasi memanggil /sanctum/csrf-cookie lebih dulu.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'

/** Satu catatan kecurangan seperti dibaca guru. */
export const skemaKejadian = z.object({
  id: z.number(),
  attempt_id: z.number(),
  student_id: z.number(),
  nama_murid: z.string().nullable().optional(),
  kategori: z.string(),
  kategori_label: z.string(),
  skor_risiko: z.number(),
  dari_klien: z.boolean(),
  client_at: z.string().nullable(),
  created_at: z.string().nullable(),
  rincian: z.record(z.string(), z.unknown()).nullable(),
  review_status: z.string(),
  review_status_label: z.string(),
  reviewed_by: z.number().nullable(),
  reviewed_at: z.string().nullable(),
})

/** Ringkasan kecurangan satu attempt di Monitor Ulangan. */
export const skemaRingkasKecurangan = z.object({
  jumlah: z.number(),
  skor_tertinggi: z.number(),
  belum_ditinjau: z.number(),
})

/** Satu baris murid di Monitor Ulangan. */
export const skemaBarisMonitor = z.object({
  attempt_id: z.number(),
  student_id: z.number(),
  nama: z.string().nullable(),
  attempt_no: z.number(),
  status: z.string(),
  status_label: z.string(),
  dijawab: z.number(),
  jumlah_soal: z.number(),
  persen: z.number(),
  online: z.boolean(),
  detik_terakhir: z.number().nullable(),
  skor: z.number().nullable(),
  kecurangan: skemaRingkasKecurangan,
})

/** Snapshot Monitor Ulangan. */
export const skemaMonitor = z.object({
  kuis: z.object({
    id: z.number(),
    judul: z.string(),
    status: z.string(),
    kelas_nama: z.string().nullable().optional(),
  }),
  murid: z.array(skemaBarisMonitor),
  jumlah_online: z.number(),
  server_now: z.string(),
  ambang_segar_detik: z.number(),
})

/** Respons penerbitan ticket SSE. */
export const skemaTiketSse = z.object({
  tiket: z.string(),
  expires_at: z.string(),
  ttl_detik: z.number(),
})

/**
 * @typedef {z.infer<typeof skemaKejadian>} DataKejadian
 * @typedef {z.infer<typeof skemaMonitor>} DataMonitor
 * @typedef {z.infer<typeof skemaBarisMonitor>} DataBarisMonitor
 */

/**
 * Snapshot Monitor Ulangan satu kuis.
 * @param {string|number} kuisId slug kuis (angka lama masih diterima server)
 * @returns {Promise<DataMonitor>}
 */
export async function ambilMonitor(kuisId) {
  const respons = await client.get(`/v1/kuis/${kuisId}/monitor`)
  return skemaMonitor.parse(respons.data)
}

/**
 * Catatan kecurangan satu kuis (opsional disaring status tinjauan).
 * @param {string|number} kuisId slug kuis (angka lama masih diterima server)
 * @param {string} [status]
 * @returns {Promise<DataKejadian[]>}
 */
export async function ambilKejadian(kuisId, status) {
  const respons = await client.get(`/v1/kuis/${kuisId}/kejadian`, {
    params: status ? { status } : undefined,
  })
  return z.array(skemaKejadian).parse(respons.data)
}

/**
 * Tinjau satu catatan (valid / tidak valid).
 * @param {number} kejadianId
 * @param {'valid'|'tidak_valid'} status
 * @param {string} [catatan]
 * @returns {Promise<DataKejadian>}
 */
export async function tinjauKejadian(kejadianId, status, catatan) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/kejadian/${kejadianId}`, { status, catatan })
  return skemaKejadian.parse(respons.data)
}

/**
 * Terbitkan ticket SSE sekali pakai untuk Monitor Ulangan.
 * @param {string|number} kuisId slug kuis (angka lama masih diterima server)
 * @returns {Promise<z.infer<typeof skemaTiketSse>>}
 */
export async function terbitkanTiketSse(kuisId) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/kuis/${kuisId}/sse-tiket`)
  return skemaTiketSse.parse(respons.data)
}
