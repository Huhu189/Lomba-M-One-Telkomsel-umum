/**
 * API data induk (slice 02) — semua data dari luar divalidasi Zod (pagar mutu).
 * Sesi murni cookie; mutasi memanggil /sanctum/csrf-cookie lebih dulu.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'

/** Skema sekolah (satu baris). */
export const skemaSekolah = z.object({
  id: z.number(),
  nama: z.string(),
  npsn: z.string().nullable(),
  alamat: z.string().nullable(),
  kepala_sekolah: z.string().nullable(),
  tahun_ajaran: z.string().nullable(),
})

/** Skema kelas. */
export const skemaKelas = z.object({
  id: z.number(),
  school_id: z.number(),
  nama: z.string(),
  tingkat: z.number(),
  tahun_ajaran: z.string().nullable(),
  jumlah_murid: z.number().optional(),
})

/** Skema mapel. */
export const skemaMapel = z.object({
  id: z.number(),
  school_id: z.number(),
  nama: z.string(),
  kode: z.string().nullable(),
})

/** Skema murid (nama/email berasal dari akun user). */
export const skemaMurid = z.object({
  id: z.number(),
  school_id: z.number(),
  class_id: z.number(),
  nis: z.string().nullable(),
  nisn: z.string().nullable(),
  nama: z.string(),
  email: z.string(),
  kelas_nama: z.string(),
})

/** Skema satu galat baris impor. */
export const skemaGalatBaris = z.object({
  baris: z.number(),
  pesan: z.string(),
})

/** Skema laporan impor CSV. */
export const skemaLaporanImpor = z.object({
  total: z.number(),
  sukses: z.number(),
  gagal: z.number(),
  dihentikan: z.boolean(),
  batas_galat: z.number(),
  galat: z.array(skemaGalatBaris),
})

/** Skema respons impor. */
export const skemaResponsImpor = z.object({
  message: z.string(),
  laporan: skemaLaporanImpor,
})

/** URL unduh CSV (sesi cookie, tanpa token di URL). */
export const URL_EKSPOR_MURID = '/api/v1/murid/ekspor'

/**
 * @typedef {z.infer<typeof skemaSekolah>} DataSekolah
 * @typedef {z.infer<typeof skemaKelas>} DataKelas
 * @typedef {z.infer<typeof skemaMapel>} DataMapel
 * @typedef {z.infer<typeof skemaMurid>} DataMurid
 * @typedef {z.infer<typeof skemaLaporanImpor>} LaporanImpor
 */

/** @returns {Promise<DataSekolah>} */
export async function ambilSekolah() {
  const respons = await client.get('/v1/sekolah')
  return skemaSekolah.parse(respons.data)
}

/**
 * @param {{ nama: string, npsn?: string, alamat?: string, kepala_sekolah?: string, tahun_ajaran?: string }} data
 * @returns {Promise<DataSekolah>}
 */
export async function simpanSekolah(data) {
  await ambilCsrfCookie()
  const respons = await client.put('/v1/sekolah', data)
  return skemaSekolah.parse(respons.data)
}

/** @returns {Promise<DataKelas[]>} */
export async function ambilKelas() {
  const respons = await client.get('/v1/kelas')
  return z.array(skemaKelas).parse(respons.data)
}

/**
 * @param {{ nama: string, tingkat: number, tahun_ajaran?: string }} data
 * @returns {Promise<DataKelas>}
 */
export async function buatKelas(data) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/kelas', data)
  return skemaKelas.parse(respons.data)
}

/**
 * @param {number} id
 * @param {{ nama: string, tingkat: number, tahun_ajaran?: string }} data
 * @returns {Promise<DataKelas>}
 */
export async function ubahKelas(id, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/kelas/${id}`, data)
  return skemaKelas.parse(respons.data)
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function hapusKelas(id) {
  await ambilCsrfCookie()
  await client.delete(`/v1/kelas/${id}`)
}

/** @returns {Promise<DataMapel[]>} */
export async function ambilMapel() {
  const respons = await client.get('/v1/mapel')
  return z.array(skemaMapel).parse(respons.data)
}

/**
 * @param {{ nama: string, kode?: string }} data
 * @returns {Promise<DataMapel>}
 */
export async function buatMapel(data) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/mapel', data)
  return skemaMapel.parse(respons.data)
}

/**
 * @param {number} id
 * @param {{ nama: string, kode?: string }} data
 * @returns {Promise<DataMapel>}
 */
export async function ubahMapel(id, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/mapel/${id}`, data)
  return skemaMapel.parse(respons.data)
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function hapusMapel(id) {
  await ambilCsrfCookie()
  await client.delete(`/v1/mapel/${id}`)
}

/**
 * Daftar murid (opsional filter per kelas).
 * @param {number|null} [classId]
 * @returns {Promise<DataMurid[]>}
 */
export async function ambilMurid(classId) {
  const respons = await client.get('/v1/murid', {
    params: classId ? { 'filter[class_id]': classId } : {},
  })
  return z.array(skemaMurid).parse(respons.data)
}

/**
 * @param {{ nama: string, email: string, class_id: number, nis?: string, nisn?: string }} data
 * @returns {Promise<DataMurid>}
 */
export async function buatMurid(data) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/murid', data)
  return skemaMurid.parse(respons.data)
}

/**
 * @param {number} id
 * @param {{ nama: string, email: string, class_id: number, nis?: string, nisn?: string }} data
 * @returns {Promise<DataMurid>}
 */
export async function ubahMurid(id, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/murid/${id}`, data)
  return skemaMurid.parse(respons.data)
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function hapusMurid(id) {
  await ambilCsrfCookie()
  await client.delete(`/v1/murid/${id}`)
}

/**
 * Impor murid dari berkas CSV.
 * @param {File} berkas
 * @returns {Promise<z.infer<typeof skemaResponsImpor>>}
 */
export async function imporMurid(berkas) {
  await ambilCsrfCookie()
  const form = new FormData()
  form.append('file', berkas)
  const respons = await client.post('/v1/murid/impor', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return skemaResponsImpor.parse(respons.data)
}
