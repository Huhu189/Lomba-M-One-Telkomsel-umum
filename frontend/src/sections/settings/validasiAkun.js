/**
 * Skema form setelan akun (halaman /pengaturan) — logika murni, diuji Vitest.
 *
 * Aturannya sengaja **cermin** aturan server (`PerbaruiAkunRequest` dan
 * `GantiSandiRequest`): nama 2–60 huruf, kata sandi baru minimal 10 karakter.
 * Tanpa cermin ini, klien bisa mengirim isian yang pasti ditolak 422 dan murid
 * hanya melihat pesan "gagal menyimpan" tanpa tahu apa yang salah.
 */
import { z } from 'zod'
import { skemaNama, skemaSandi } from '../auth/validasi.js'

/** Form ubah nama. */
export const skemaAkunNama = z.object({
  name: skemaNama,
})

/**
 * Form ganti kata sandi: sandi sekarang + sandi baru dua kali.
 *
 * Sandi lama tidak diperiksa bentuknya (hanya wajib diisi): yang menilai benar
 * atau salah hanya server, dan menambah aturan panjang di sini bisa menolak
 * sandi lama yang sah sebelum sempat dicocokkan.
 */
export const skemaAkunSandi = z
  .object({
    sandi_sekarang: z.string().trim().min(1, 'Isi kata sandi yang sekarang.'),
    password: skemaSandi,
    konfirmasi: z.string().min(1, 'Ulangi kata sandi baru yang sama.'),
  })
  .refine((data) => data.password === data.konfirmasi, {
    message: 'Kata sandi baru belum sama.',
    path: ['konfirmasi'],
  })
