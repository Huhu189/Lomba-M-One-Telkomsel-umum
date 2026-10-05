/**
 * Skema validasi form data induk (slice 02) + bantuan menampilkan
 * laporan impor CSV per baris (data eksternal selalu lewat Zod).
 *
 * Field angka memakai string tervalidasi (mis. "6") agar selaras dengan
 * nilai input HTML dan ramah checkJs strict; konversi ke number di API.
 */
import { z } from 'zod'

/** Kelas: nama 1–60, tingkat "1"–"6". */
export const skemaKelasForm = z.object({
  nama: z.string().trim().min(1, 'Nama kelas wajib diisi.').max(60, 'Nama kelas maksimal 60 karakter.'),
  tingkat: z.string().trim().regex(/^[1-6]$/, 'Tingkat harus 1 sampai 6.'),
  tahun_ajaran: z.string().trim().max(20, 'Tahun ajaran maksimal 20 karakter.').optional(),
})

/** Mapel: nama 2–80, kode opsional huruf/angka. */
export const skemaMapelForm = z.object({
  nama: z.string().trim().min(2, 'Nama mapel minimal 2 karakter.').max(80, 'Nama mapel maksimal 80 karakter.'),
  kode: z
    .string()
    .trim()
    .max(20, 'Kode maksimal 20 karakter.')
    .regex(/^[A-Za-z0-9-]*$/, 'Kode hanya huruf, angka, dan tanda hubung.')
    .optional(),
})

/** Email murid: format valid, disimpan huruf kecil. */
export const skemaEmailMurid = z
  .string()
  .trim()
  .min(1, 'Email wajib diisi.')
  .max(120, 'Email maksimal 120 karakter.')
  .pipe(z.email('Format email tidak valid.'))

/** Murid: nama, email, kelas wajib; NIS/NISN opsional. */
export const skemaMuridForm = z.object({
  nama: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(120, 'Nama maksimal 120 karakter.'),
  email: skemaEmailMurid,
  class_id: z.string().trim().min(1, 'Pilih kelas.'),
  nis: z.string().trim().max(30, 'NIS maksimal 30 karakter.').optional(),
  nisn: z.string().trim().max(20, 'NISN maksimal 20 karakter.').optional(),
})

/**
 * @typedef {z.infer<typeof skemaKelasForm>} DataKelasForm
 * @typedef {z.infer<typeof skemaMapelForm>} DataMapelForm
 * @typedef {z.infer<typeof skemaMuridForm>} DataMuridForm
 */

/**
 * Ringkas laporan impor menjadi pesan siap tampil (per baris).
 * @param {import('./api.js').LaporanImpor} laporan laporan hasil parse Zod
 * @returns {{ ringkasan: string, galat: { baris: number, pesan: string }[] }}
 */
export function ringkasLaporanImpor(laporan) {
  const bagian = [`${laporan.sukses} baris berhasil diimpor`, `${laporan.gagal} baris gagal`]

  if (laporan.dihentikan) {
    bagian.push(`dihentikan setelah ${laporan.batas_galat} galat`)
  }

  return {
    ringkasan: bagian.join(' · ') + '.',
    galat: laporan.galat.map(({ baris, pesan }) => ({ baris, pesan })),
  }
}
