/**
 * API pengaturan (slice 02) dan setelan akun sendiri.
 *
 * Dua hal berbeda tinggal di berkas ini:
 * - `/v1/pengaturan` — pengaturan tiga lapis (sekolah → kelas → kuis) untuk
 *   proteksi/waktu/penilaian. Sejak 13 Oktober 2026 setelan itu disetel di
 *   tiap kuis (halaman detail kuis), bukan lagi di halaman /pengaturan.
 * - `/v1/akun` — setelan akun pengguna yang sedang masuk (nama, kata sandi),
 *   satu-satunya isi halaman /pengaturan sekarang.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'
import { skemaUser } from '../auth/api.js'

/** Nilai pengaturan dapat berupa boolean atau bilangan bulat. */
export const skemaNilaiPengaturan = z.object({
  nilai: z.union([z.boolean(), z.number()]),
  tipe: z.enum(['boolean', 'integer']),
  label: z.string(),
  kelompok: z.string(),
  tampil: z.boolean().optional().default(true),
  bawaan: z.union([z.boolean(), z.number()]),
  sumber: z.enum(['bawaan', 'sekolah', 'kelas', 'kuis']),
  terkunci: z.boolean(),
})

/**
 * Resolusi pengaturan lengkap untuk satu konteks.
 *
 * `boleh_ubah` datang dari server (policy yang sama dengan jalur tulisnya).
 * Bawaan `true` supaya respons lama/uji yang belum memuatnya tidak mengubah
 * panelnya jadi hanya-baca; server yang benar-benar menolak selalu mengirim
 * `false`.
 */
export const skemaResolusiPengaturan = z.object({
  sekolah_id: z.number(),
  kelas_id: z.number().nullable(),
  kuis_id: z.number().nullable(),
  pengaturan: z.record(z.string(), skemaNilaiPengaturan),
  boleh_ubah: z.boolean().optional().default(true),
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

/**
 * Ubah nama tampilan akun sendiri; server mengembalikan user yang sudah
 * diperbarui (nama di kepala aplikasi ikut berubah tanpa muat ulang).
 * @param {string} nama
 * @returns {Promise<z.infer<typeof skemaUser>>}
 */
export async function simpanNamaAkun(nama) {
  await ambilCsrfCookie()
  const respons = await client.put('/v1/akun', { name: nama })
  return skemaUser.parse(respons.data)
}

/** Respon ganti kata sandi sendiri (pesan + user yang sudah diperbarui). */
export const skemaResponSandi = z.object({
  message: z.string(),
  user: skemaUser,
})

/**
 * Ganti kata sandi sendiri. Sandi lama wajib dikirim: server menolak perubahan
 * tanpa bukti pemilik akun, jadi sesi yang tertinggal di komputer bersama tidak
 * bisa dipakai untuk mengunci pemiliknya keluar.
 *
 * @param {{ sandiSekarang: string, sandiBaru: string }} data
 * @returns {Promise<z.infer<typeof skemaResponSandi>>}
 */
export async function gantiSandiAkun({ sandiSekarang, sandiBaru }) {
  await ambilCsrfCookie()
  const respons = await client.put('/v1/akun/sandi', {
    sandi_sekarang: sandiSekarang,
    password: sandiBaru,
    password_confirmation: sandiBaru,
  })

  return skemaResponSandi.parse(respons.data)
}
