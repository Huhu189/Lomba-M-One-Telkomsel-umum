/**
 * API laporan (slice 05): peringkat, laporan per tema (guru), badge per mapel,
 * dan progres tema murid. Semua respons divalidasi Zod; sesi murni cookie.
 */
import { z } from 'zod'
import { client } from '../../shared/api/client.js'

/**
 * URL unduh nilai kuis sebagai CSV (slice 10). Sesi cookie, jadi cukup dipakai
 * sebagai tautan biasa — tidak ada token di URL.
 *
 * @param {number} kuisId
 * @returns {string}
 */
export function urlEksporNilai(kuisId) {
  return `/api/v1/kuis/${kuisId}/ekspor-nilai`
}

/**
 * Satu baris peringkat (hanya dari skor asli).
 *
 * Pada mode tim (slice 09-C) yang diurutkan adalah tim: `murid_id` null dan
 * `tim_nama` + `anggota` terisi. Pada mode individu kebalikannya.
 */
export const skemaPeringkat = z.object({
  peringkat: z.number(),
  attempt_id: z.number(),
  murid_id: z.number().nullable(),
  tim_id: z.number().nullable(),
  tim_nama: z.string().nullable(),
  anggota: z.array(z.string()),
  nama: z.string(),
  skor: z.number(),
  skor_maksimal: z.number(),
  persen: z.number(),
  jumlah_benar: z.number(),
  jumlah_soal: z.number(),
  dikumpulkan_at: z.string().nullable(),
})

/** Peringkat satu kuis + keterlihatan saklar `ranking`. */
export const skemaResponPeringkat = z.object({
  kuis_id: z.number(),
  judul_kuis: z.string(),
  mode_tim: z.boolean(),
  tampil: z.boolean(),
  total: z.number(),
  top: z.number(),
  peringkat: z.array(skemaPeringkat),
  peringkat_saya: skemaPeringkat.nullable(),
})

/** Pemahaman satu tema (tag). */
export const skemaTema = z.object({
  tag_id: z.number(),
  tag_nama: z.string(),
  jumlah_soal: z.number(),
  jumlah_benar: z.number(),
  persen: z.number(),
  tingkat: z.string(),
  tingkat_label: z.string(),
})

/** Lencana badge per mapel. */
export const skemaLencana = z.object({
  kode: z.string(),
  label: z.string(),
  level: z.number(),
})

/** Badge satu mapel. */
export const skemaBadgeMapel = z.object({
  mapel_id: z.number().nullable(),
  mapel_nama: z.string(),
  jumlah_ulangan: z.number(),
  rata_rata: z.number(),
  lencana: skemaLencana,
})

/** Kumpulan badge murid. */
export const skemaBadge = z.object({
  murid_id: z.number(),
  nama: z.string(),
  jumlah_lencana: z.number(),
  badge: z.array(skemaBadgeMapel),
})

/** Satu murid pada laporan guru. */
export const skemaBarisLaporan = z.object({
  murid_id: z.number(),
  nama: z.string(),
  jumlah_tema: z.number(),
  tema: z.array(skemaTema),
  ringkasan: z.record(z.string(), z.number()),
})

/** Laporan pemahaman per tema untuk satu kuis (guru). */
export const skemaLaporan = z.object({
  kuis_id: z.number(),
  judul_kuis: z.string(),
  mapel_nama: z.string().nullable(),
  kelas_nama: z.string().nullable(),
  ambang: z.object({
    ambang_paham: z.number(),
    ambang_mulai_paham: z.number(),
    data_minimum: z.number(),
  }),
  murid: z.array(skemaBarisLaporan),
})

/** Soal rekomendasi remedial (tanpa kunci). */
export const skemaSoalRemedial = z.object({
  id: z.number(),
  tipe: z.string(),
  tipe_label: z.string(),
  skor: z.number(),
  tag_id: z.number(),
  tag_nama: z.string().nullable(),
  teks: z.string(),
})

/** Progres tema + badge + remedial murid. */
export const skemaProgres = z.object({
  murid_id: z.number(),
  nama: z.string(),
  ambang: z.object({
    ambang_paham: z.number(),
    ambang_mulai_paham: z.number(),
    data_minimum: z.number(),
  }),
  tema: z.array(skemaTema),
  badge: skemaBadge,
  remedial: z.object({
    diaktifkan: z.boolean(),
    tema_lemah: z.array(skemaTema),
    soal: z.array(skemaSoalRemedial),
  }),
})

/**
 * @typedef {z.infer<typeof skemaResponPeringkat>} DataPeringkat
 * @typedef {z.infer<typeof skemaPeringkat>} DataBarisPeringkat
 * @typedef {z.infer<typeof skemaLaporan>} DataLaporan
 * @typedef {z.infer<typeof skemaBarisLaporan>} DataBarisLaporan
 * @typedef {z.infer<typeof skemaTema>} DataTema
 * @typedef {z.infer<typeof skemaBadge>} DataBadge
 * @typedef {z.infer<typeof skemaBadgeMapel>} DataBadgeMapel
 * @typedef {z.infer<typeof skemaProgres>} DataProgres
 */

/**
 * @param {number} kuisId
 * @param {number} [top]
 * @returns {Promise<DataPeringkat>}
 */
export async function ambilPeringkat(kuisId, top) {
  const respons = await client.get(`/v1/kuis/${kuisId}/ranking`, {
    params: top ? { top } : {},
  })
  return skemaResponPeringkat.parse(respons.data)
}

/**
 * @param {number} kuisId
 * @returns {Promise<DataLaporan>}
 */
export async function ambilLaporanKuis(kuisId) {
  const respons = await client.get(`/v1/kuis/${kuisId}/laporan`)
  return skemaLaporan.parse(respons.data)
}

/**
 * @returns {Promise<DataBadge>}
 */
export async function ambilBadgeSaya() {
  const respons = await client.get('/v1/badge/saya')
  return skemaBadge.parse(respons.data)
}

/**
 * @returns {Promise<DataProgres>}
 */
export async function ambilProgresSaya() {
  const respons = await client.get('/v1/progres/saya')
  return skemaProgres.parse(respons.data)
}
