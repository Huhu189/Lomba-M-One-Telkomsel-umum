/**
 * Skema validasi form auth (chunk structure: skema Zod per fitur).
 * Dipakai bersama react-hook-form + @hookform/resolvers.
 */
import { z } from 'zod'

/** Nama: 2–60 huruf. */
export const skemaNama = z
  .string()
  .trim()
  .min(2, 'Nama minimal 2 karakter.')
  .max(60, 'Nama maksimal 60 karakter.')

/** Email: format valid, disimpan huruf kecil. */
export const skemaEmail = z
  .string()
  .trim()
  .min(1, 'Email wajib diisi.')
  .max(120, 'Email maksimal 120 karakter.')
  .pipe(z.email('Format email tidak valid.'))

/**
 * Kata sandi: minimal 10 karakter (chunk security butir 10).
 * Pesan dibuat ramah anak.
 */
export const skemaSandi = z.string().min(10, 'Kata sandi minimal 10 karakter.')

/** Form daftar murid. */
export const skemaDaftar = z
  .object({
    name: skemaNama,
    email: skemaEmail,
    password: skemaSandi,
    konfirmasi: z.string().min(1, 'Ulangi kata sandi yang sama.'),
  })
  .refine((data) => data.password === data.konfirmasi, {
    message: 'Kata sandi belum sama.',
    path: ['konfirmasi'],
  })

/** Form masuk. */
export const skemaMasuk = z.object({
  email: skemaEmail,
  password: skemaSandi,
})

/** Form lupa sandi. */
export const skemaLupaSandi = z.object({
  email: skemaEmail,
})

/** Form atur ulang sandi. */
export const skemaAturUlang = z
  .object({
    token: z.string().min(1, 'Tautan tidak lengkap — buka tautan dari email.'),
    email: skemaEmail,
    password: skemaSandi,
    konfirmasi: z.string().min(1, 'Ulangi kata sandi yang sama.'),
  })
  .refine((data) => data.password === data.konfirmasi, {
    message: 'Kata sandi belum sama.',
    path: ['konfirmasi'],
  })

/** Form kirim ulang verifikasi (hanya email). */
export const skemaKirimUlang = z.object({
  email: skemaEmail,
})
