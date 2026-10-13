/**
 * API panel admin sekolah (14 Okt 2026).
 *
 * Dua kebutuhan admin sekolah: dasbor skala sekolah (berapa murid/guru aktif,
 * berapa ulangan berjalan) dan memperbaiki akun guru/murid — email salah ketik
 * atau sandi lupa — yang di server mewajibkan dua langkah: minta token
 * konfirmasi berisi alasan, lalu pakai token itu sekali untuk menyimpan
 * perubahan.
 *
 * Semua data dari luar divalidasi Zod (pagar mutu), termasuk kolom yang boleh
 * tidak ada (`whenLoaded` di server), supaya tabel tidak pernah membaca
 * `undefined`.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'

/** Satu kartu angka di kepala dasbor. */
export const skemaKartuAngka = z.object({
  kunci: z.string(),
  label: z.string(),
  nilai: z.number(),
  ket: z.string(),
})

/** Satu ulangan yang sedang berjalan di sekolah. */
export const skemaKuisBerjalan = z.object({
  id: z.number(),
  slug: z.string(),
  judul: z.string(),
  kelas_nama: z.string().nullable(),
  peserta: z.number(),
  mengerjakan: z.number(),
  selesai: z.number(),
  persen_selesai: z.number(),
  mulai_at: z.string().nullable(),
})

/** Satu kelas pada ringkasan sekolah. */
export const skemaKelasSekolah = z.object({
  id: z.number(),
  nama: z.string(),
  tingkat: z.number(),
  jumlah_murid: z.number(),
  jumlah_kuis_terbit: z.number(),
})

/** Satu baris jejak audit terbaru (append-only). */
export const skemaAktivitas = z.object({
  id: z.number(),
  jenis: z.string(),
  judul: z.string(),
  peristiwa: z.string().nullable(),
  pelaku: z.string().nullable(),
  alasan: z.string().nullable(),
  waktu: z.string(),
})

/** Snapshot skala sekolah — sumber seluruh angka di dasbor admin. */
export const skemaMonitorSekolah = z.object({
  sekolah: z.object({
    nama: z.string(),
    npsn: z.string().nullable(),
    tahun_ajaran: z.string().nullable(),
  }),
  server_now: z.string(),
  menit_online: z.number(),
  murid: z.object({
    total: z.number(),
    akun: z.number(),
    aktif: z.number(),
    online: z.number(),
    mengerjakan: z.number(),
    belum_verifikasi: z.number(),
    ditangguhkan: z.number(),
  }),
  guru: z.object({
    total: z.number(),
    aktif: z.number(),
    online: z.number(),
    ditangguhkan: z.number(),
    admin: z.number(),
  }),
  kelas: z.object({
    total: z.number(),
    daftar: z.array(skemaKelasSekolah),
  }),
  kuis: z.object({
    total: z.number(),
    terbit: z.number(),
    draf: z.number(),
    arsip: z.number(),
    aktif: z.number(),
    attempt_hari_ini: z.number(),
    dikumpulkan_hari_ini: z.number(),
    koreksi_menunggu: z.number(),
    kejadian_hari_ini: z.number(),
  }),
  angka: z.array(skemaKartuAngka),
  kuis_berjalan: z.array(skemaKuisBerjalan),
  aktivitas: z.array(skemaAktivitas),
})

/** Satu akun guru/murid di daftar kelola akun. */
export const skemaAkunSekolah = z.object({
  id: z.number(),
  nama: z.string(),
  email: z.string(),
  peran: z.string(),
  peran_label: z.string(),
  status: z.string(),
  status_label: z.string(),
  terverifikasi: z.boolean(),
  is_tamu: z.boolean(),
  kelas_nama: z.string().nullable().optional(),
  nis: z.string().nullable().optional(),
  terakhir_aktif: z.string().nullable().optional(),
})

/** Halaman daftar akun (server membatasi per halaman). */
export const skemaHalamanAkun = z.object({
  data: z.array(skemaAkunSekolah),
  meta: z.object({
    total: z.number(),
    current_page: z.number(),
    last_page: z.number(),
    per_page: z.number(),
  }),
})

/** Token konfirmasi sekali pakai (dikirim balik hanya saat diminta). */
export const skemaTokenAkun = z.object({
  token: z.string(),
  expires_at: z.string(),
  ttl_detik: z.number(),
})

/** Hasil satu mutasi akun (pesan + akun yang sudah diperbarui). */
export const skemaResponsAkun = z.object({
  message: z.string(),
  akun: skemaAkunSekolah,
})

/**
 * @typedef {z.infer<typeof skemaMonitorSekolah>} MonitorSekolah
 * @typedef {z.infer<typeof skemaAkunSekolah>} AkunSekolah
 * @typedef {z.infer<typeof skemaKuisBerjalan>} KuisBerjalan
 * @typedef {z.infer<typeof skemaKelasSekolah>} KelasSekolah
 * @typedef {z.infer<typeof skemaAktivitas>} AktivitasSekolah
 * @typedef {{ halaman?: number, peran?: string, status?: string, cari?: string }} OpsiAkun
 */

/**
 * Parameter daftar akun: halaman, peran, status, dan kotak pencarian.
 *
 * Dipisah dari `ambilAkunAdmin` supaya aturannya bisa diuji tanpa jaringan:
 * saringan kosong TIDAK dikirim (server akan menganggapnya penyaring kosong) dan
 * spasi di ujung kata kunci dipotong lebih dulu — supaya " rina " dan "rina"
 * memakai kueri yang sama, bukan dua alamat berbeda yang membuat cache tiap
 * ketikan baru.
 *
 * @param {OpsiAkun} [opsi]
 * @returns {Record<string, string|number>}
 */
export function paramAkun({ halaman = 1, peran = '', status = '', cari = '' } = {}) {
  /** @type {Record<string, string|number>} */
  const params = { page: halaman }
  if (peran !== '') params['filter[role]'] = peran
  if (status !== '') params['filter[status]'] = status

  const kata = cari.trim()
  if (kata !== '') params['filter[cari]'] = kata

  return params
}

/**
 * Snapshot dasbor skala sekolah.
 * @returns {Promise<MonitorSekolah>}
 */
export async function ambilMonitorSekolah() {
  const respons = await client.get('/v1/admin/monitor')
  return skemaMonitorSekolah.parse(respons.data)
}

/**
 * Daftar akun guru/murid (satu halaman per panggilan).
 * @param {OpsiAkun} [opsi]
 * @returns {Promise<z.infer<typeof skemaHalamanAkun>>}
 */
export async function ambilAkunSekolah(opsi = {}) {
  const respons = await client.get('/v1/admin/akun', { params: paramAkun(opsi) })
  return skemaHalamanAkun.parse(respons.data)
}

/**
 * Minta token konfirmasi sekali pakai untuk satu akun.
 * @param {number} id
 * @param {string} alasan
 * @returns {Promise<z.infer<typeof skemaTokenAkun>>}
 */
export async function mintaTokenAkun(id, alasan) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/admin/akun/${id}/token`, { alasan })
  return skemaTokenAkun.parse(respons.data)
}

/**
 * Ubah email akun (butuh token konfirmasi).
 * @param {number} id
 * @param {{ email: string, alasan: string, token: string }} data
 * @returns {Promise<z.infer<typeof skemaResponsAkun>>}
 */
export async function ubahEmailAkun(id, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/admin/akun/${id}/email`, data)
  return skemaResponsAkun.parse(respons.data)
}

/**
 * Setel ulang kata sandi akun (butuh token konfirmasi).
 *
 * `konfirmasi` dikirim sebagai `password_confirmation` supaya server memeriksa
 * ulang kecocokannya — admin yang salah ketik tidak boleh sampai mengunci murid
 * dari akunnya sendiri.
 *
 * @param {number} id
 * @param {{ password: string, konfirmasi: string, alasan: string, token: string }} data
 * @returns {Promise<z.infer<typeof skemaResponsAkun>>}
 */
export async function setelSandiAkun(id, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/admin/akun/${id}/sandi`, {
    password: data.password,
    password_confirmation: data.konfirmasi,
    alasan: data.alasan,
    token: data.token,
  })
  return skemaResponsAkun.parse(respons.data)
}

/**
 * Aktifkan / tangguhkan akun (butuh token konfirmasi).
 * @param {number} id
 * @param {{ status: string, alasan: string, token: string }} data
 * @returns {Promise<z.infer<typeof skemaResponsAkun>>}
 */
export async function ubahStatusAkun(id, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/admin/akun/${id}/status`, data)
  return skemaResponsAkun.parse(respons.data)
}
