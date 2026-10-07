/**
 * API auth (slice 01) — semua data dari luar selalu divalidasi Zod (pagar mutu).
 * Tanpa token di localStorage: sesi murni cookie HttpOnly.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'

/** Skema user dari /auth/saya & respons login (UserResource). */
export const skemaUser = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  status: z.string(),
  statusLabel: z.string(),
  emailTerverifikasi: z.boolean(),
})

/** Skema pesan generik backend. */
export const skemaPesan = z.object({ message: z.string() })

/**
* Respon atur-ulang sandi: ditandai pula bila tautan yang dikirim sudah pernah
* dipakai (token sekali pakai), supaya UI bisa menampilkan halaman khusus
* "tautan sudah dipakai" alih-alih formulir yang pasti gagal lagi.
*/
export const skemaResponAturUlang = z.object({
  message: z.string(),
  tautan_dipakai: z.boolean().optional().default(false),
})

/** Skema diagnostik /v1/sesi. */
export const skemaSesi = z.object({ terautentikasi: z.boolean() })

/**
 * Skema respons pendaftaran: murid LANGSUNG masuk, tinggal verifikasi email.
 * `email_terkirim` = false berarti layanan email sedang bermasalah (server tetap
 * membuat akun), jadi antarmuka menyarankan tombol kirim ulang.
 */
export const skemaResponsDaftar = z.object({
  message: z.string(),
  user: skemaUser,
  perlu_verifikasi: z.boolean(),
  email_terkirim: z.boolean(),
})

/** Skema respons kirim ulang verifikasi untuk akun yang sudah masuk. */
export const skemaResponsKirimUlang = z.object({
  message: z.string(),
  email_terkirim: z.boolean(),
})

/**
 * Ambil pesan galat yang aman ditampilkan dari respons API.
 * @param {unknown} galat
 * @returns {string}
 */
export function pesanGalatApi(galat) {
  const data = /** @type {{message?: unknown, errors?: Record<string, unknown[]>|undefined}} */ (
    /** @type {any} */ (galat)?.response?.data
  )

  if (data && typeof data.message === 'string' && data.message !== '') {
    return data.message
  }

  return 'Terjadi kesalahan. Coba lagi sebentar.'
}

/**
 * Ubah objek galat react-hook-form menjadi teks aman untuk dirender.
 * @param {{ message?: import('react').ReactNode } | undefined} galat
 * @returns {string}
 */
export function teksGalat(galat) {
  if (!galat) return ''
  const pesan = galat.message
  return typeof pesan === 'string' ? pesan : 'Isian belum valid.'
}

/**
 * Normalisasi email sekali di satu tempat (trim + huruf kecil) supaya tidak ada
 * pemanggil yang lupa. Server tetap menormalkan sendiri sebagai pengaman.
 * @param {string} email
 * @returns {string}
 */
function emailBersih(email) {
  return email.trim().toLowerCase()
}

/**
 * Daftar murid (role selalu dari server = murid).
 * Backend langsung membuat sesi, jadi pemanggil bisa menyimpan `user` ke store.
 * @param {{ name: string, email: string, password: string }} data
 * @returns {Promise<z.infer<typeof skemaResponsDaftar>>}
 */
export async function daftar(data) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/auth/daftar', {
    name: data.name,
    email: emailBersih(data.email),
    password: data.password,
    password_confirmation: data.password,
  })
  return skemaResponsDaftar.parse(respons.data)
}

/**
 * Login sesi (cookie SPA).
 * @param {{ email: string, password: string }} data
 * @returns {Promise<z.infer<typeof skemaUser>>} user hasil parse Zod
 */
export async function masuk(data) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/auth/masuk', {
    email: emailBersih(data.email),
    password: data.password,
  })
  const badan = z.object({ message: z.string(), user: skemaUser }).parse(respons.data)
  return badan.user
}

/**
 * Logout: hancurkan sesi di server.
 * @returns {Promise<void>}
 */
export async function keluar() {
  await ambilCsrfCookie()
  await client.post('/v1/auth/keluar')
}

/**
 * Data user yang sedang masuk (untuk TanStack Query).
 * @returns {Promise<z.infer<typeof skemaUser>>}
 */
export async function ambilSaya() {
  const respons = await client.get('/v1/auth/saya')
  return skemaUser.parse(respons.data)
}

/**
 * Cek status sesi (diagnostik, tanpa autentikasi).
 * @returns {Promise<boolean>}
 */
export async function cekTerautentikasi() {
  const respons = await client.get('/v1/sesi')
  return skemaSesi.parse(respons.data).terautentikasi
}

/**
 * Kirim ulang tautan verifikasi TANPA sesi (halaman PerluVerifikasi).
 * @param {string} email
 * @returns {Promise<string>} pesan netral backend
 */
export async function kirimUlangVerifikasi(email) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/auth/kirim-ulang-verifikasi-publik', {
    email: emailBersih(email),
  })
  return skemaPesan.parse(respons.data).message
}

/**
 * Kirim ulang tautan verifikasi untuk akun yang SEDANG masuk (akun pending boleh
 * membuka jalur ini). Berbeda dengan versi publik, server melaporkan status kirim
 * email secara jujur karena penggunanya sudah diketahui.
 * @returns {Promise<z.infer<typeof skemaResponsKirimUlang>>}
 */
export async function kirimUlangVerifikasiSesi() {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/auth/kirim-ulang-verifikasi')
  return skemaResponsKirimUlang.parse(respons.data)
}

/**
 * Minta tautan lupa kata sandi (anti-enumerasi).
 * @param {string} email
 * @returns {Promise<string>} pesan netral backend
 */
export async function lupaSandi(email) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/auth/lupa-sandi', { email: emailBersih(email) })
  return skemaPesan.parse(respons.data).message
}

/**
 * Atur ulang kata sandi dengan token sekali pakai.
 * @param {{ token: string, email: string, password: string }} data
 * @returns {Promise<z.infer<typeof skemaResponAturUlang>>} pesan + penanda tautan mati
 */
export async function aturUlangSandi(data) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/auth/atur-ulang-sandi', {
    token: data.token,
    email: emailBersih(data.email),
    password: data.password,
    password_confirmation: data.password,
  })
  return skemaResponAturUlang.parse(respons.data)
}
