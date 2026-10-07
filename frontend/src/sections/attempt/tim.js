/**
 * Tim kuis mode kelompok (slice 09-C).
 *
 * Guru menyusun tim per kuis (satu-satu atau dibagi otomatis), lalu satu tim
 * memakai SATU lembar jawaban bersama yang bisa diubah anggotanya. Semua respons
 * divalidasi Zod supaya bentuk data server tidak diam-diam berubah.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'

/** Satu anggota tim. */
export const skemaAnggotaTim = z.object({
  murid_id: z.number(),
  nama: z.string(),
})

/** Satu tim beserta anggotanya. */
export const skemaTim = z.object({
  id: z.number(),
  nama: z.string(),
  jumlah_anggota: z.number(),
  anggota: z.array(skemaAnggotaTim),
  // Hanya ada pada ringkasan untuk murid.
  rekan: z.array(z.string()).optional(),
})

/** Murid kelas kuis ini beserta timnya (untuk pemilih anggota). */
export const skemaMuridKelas = z.object({
  murid_id: z.number(),
  nama: z.string(),
  tim_id: z.number().nullable(),
  tim_nama: z.string().nullable(),
})

/** Daftar tim satu kuis (layar guru). */
export const skemaDaftarTim = z.object({
  kuis_id: z.number(),
  judul_kuis: z.string(),
  kelas_nama: z.string().nullable(),
  mapel_nama: z.string().nullable(),
  mode_tim: z.boolean(),
  ada_attempt: z.boolean(),
  jumlah_tim: z.number(),
  tim: z.array(skemaTim),
  murid_kelas: z.array(skemaMuridKelas),
  message: z.string().optional(),
})

/** Respons simpan satu tim. */
export const skemaHasilSimpanTim = z.object({
  message: z.string(),
  tim: skemaTim,
})

/** Tim milik murid (layar murid). */
export const skemaTimSaya = z.object({
  kuis_id: z.number(),
  mode_tim: z.boolean(),
  tim: skemaTim.nullable(),
})

/**
 * @typedef {z.infer<typeof skemaTim>} DataTim
 * @typedef {z.infer<typeof skemaDaftarTim>} DataDaftarTim
 * @typedef {z.infer<typeof skemaMuridKelas>} DataMuridKelas
 */

/**
 * @param {number} kuisId
 * @returns {Promise<DataDaftarTim>}
 */
export async function ambilDaftarTim(kuisId) {
  const respons = await client.get(`/v1/kuis/${kuisId}/tim`)
  return skemaDaftarTim.parse(respons.data)
}

/**
 * @param {number} kuisId
 * @param {{ tim_id?: number, nama: string, murid: number[] }} data
 * @returns {Promise<z.infer<typeof skemaHasilSimpanTim>>}
 */
export async function simpanTim(kuisId, data) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/kuis/${kuisId}/tim`, data)
  return skemaHasilSimpanTim.parse(respons.data)
}

/**
 * @param {number} kuisId
 * @param {number} jumlahTim
 * @returns {Promise<DataDaftarTim>}
 */
export async function bagiTimOtomatis(kuisId, jumlahTim) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/kuis/${kuisId}/tim/bagi`, { jumlah_tim: jumlahTim })
  return skemaDaftarTim.parse(respons.data)
}

/**
 * @param {number} kuisId
 * @param {number} timId
 * @returns {Promise<{ message: string }>}
 */
export async function hapusTim(kuisId, timId) {
  await ambilCsrfCookie()
  const respons = await client.delete(`/v1/kuis/${kuisId}/tim/${timId}`)
  return z.object({ message: z.string() }).parse(respons.data)
}

/**
 * @param {number} kuisId
 * @returns {Promise<z.infer<typeof skemaTimSaya>>}
 */
export async function ambilTimSaya(kuisId) {
  const respons = await client.get(`/v1/kuis/${kuisId}/tim-saya`)
  return skemaTimSaya.parse(respons.data)
}

/**
 * Jumlah tim yang masuk akal untuk sekian murid (dibulatkan ke bawah, minimal 2),
 * dipakai sebagai nilai awal kotak "bagi otomatis".
 *
 * @param {number} jumlahMurid
 * @param {number} ukuranIdeal  anggota per tim yang diinginkan
 * @returns {number}
 */
export function usulJumlahTim(jumlahMurid, ukuranIdeal = 3) {
  if (jumlahMurid < 4) return 0

  const ideal = Number.isFinite(ukuranIdeal) && ukuranIdeal > 0 ? Math.floor(ukuranIdeal) : 3

  return Math.max(2, Math.min(20, Math.floor(jumlahMurid / ideal)))
}

/**
 * Murid yang belum masuk tim mana pun pada kuis ini.
 * @param {DataMuridKelas[]} muridKelas
 * @returns {DataMuridKelas[]}
 */
export function muridTanpaTim(muridKelas) {
  return muridKelas.filter((murid) => murid.tim_id === null)
}

/**
 * Ringkasan satu tim untuk ditampilkan (nama + anggota, tanpa duplikat).
 * @param {DataTim} tim
 * @returns {string}
 */
export function ringkasAnggotaTim(tim) {
  if (tim.anggota.length === 0) return 'belum ada anggota'

  return tim.anggota.map((anggota) => anggota.nama).join(', ')
}
