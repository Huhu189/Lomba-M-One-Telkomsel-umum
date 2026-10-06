/**
 * Skema form + validasi kelengkapan soal di sisi klien.
 *
 * Aturan di bawah mencerminkan registry backend (PenanganPilihanGanda,
 * PenanganBenarSalah, PenanganMenjodohkan, PenanganMengurutkan) supaya guru
 * melihat pesan jelas sebelum menabrak 422 dari server.
 */
import { z } from 'zod'
import {
  TIPE,
  TIPE_OBJEKTIF,
  MIN_OPSI,
  MAKS_OPSI,
  MIN_ITEM,
  MAKS_MATEMATIKA,
  urutanDariItem,
} from './tipeSoal.js'

/** Tag: nama 2–80 (unik per sekolah di server), deskripsi opsional. */
export const skemaTagForm = z.object({
  nama: z.string().trim().min(2, 'Nama tag minimal 2 karakter.').max(80, 'Nama tag maksimal 80 karakter.'),
  deskripsi: z.string().trim().max(255, 'Deskripsi maksimal 255 karakter.').optional(),
})

/** Kuis: judul, mapel, kelas, durasi, dan jadwal opsional. */
export const skemaKuisForm = z
  .object({
    judul: z.string().trim().min(3, 'Judul minimal 3 karakter.').max(150, 'Judul maksimal 150 karakter.'),
    deskripsi: z.string().trim().max(1000, 'Deskripsi maksimal 1000 karakter.').optional(),
    subject_id: z.string().trim().min(1, 'Pilih mapel.'),
    class_id: z.string().trim().min(1, 'Pilih kelas.'),
    durasi_menit: z
      .string()
      .trim()
      .regex(/^\d+$/, 'Durasi harus berupa angka menit.')
      .refine((nilai) => Number(nilai) >= 1 && Number(nilai) <= 300, 'Durasi 1 sampai 300 menit.'),
    mulai_at: z.string().trim(),
    selesai_at: z.string().trim(),
    acak_soal: z.boolean(),
    acak_opsi: z.boolean(),
  })
  .refine(
    (data) =>
      data.mulai_at === '' ||
      data.selesai_at === '' ||
      new Date(data.selesai_at).getTime() > new Date(data.mulai_at).getTime(),
    { message: 'Jadwal selesai wajib setelah jadwal mulai.', path: ['selesai_at'] },
  )

/**
 * @typedef {z.infer<typeof skemaTagForm>} DataTagForm
 * @typedef {z.infer<typeof skemaKuisForm>} DataKuisForm
 */

/**
 * Cek kelengkapan soal objektif sebelum dikirim ke server.
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]} daftar pesan galat (kosong berarti siap kirim)
 */
export function validasiSoal(state) {
  const galat = []

  if (state.subject_id === '') galat.push('Pilih mapel dulu.')

  if (!TIPE_OBJEKTIF.includes(state.tipe)) {
    galat.push('Tahap ini baru mendukung soal objektif (pilihan ganda, benar/salah, menjodohkan, mengurutkan).')
    return galat
  }

  if (state.teks.trim() === '') galat.push('Isi soal wajib diisi.')
  if (state.matematika.trim().length > MAKS_MATEMATIKA) {
    galat.push(`Template MathML maksimal ${MAKS_MATEMATIKA} karakter.`)
  }

  const skor = Number(state.skor)
  if (!Number.isInteger(skor) || skor < 1 || skor > 100) galat.push('Skor harus angka 1 sampai 100.')

  if (state.tipe === TIPE.pilihanGanda) galat.push(...validasiPilihanGanda(state))
  if (state.tipe === TIPE.menjodohkan) galat.push(...validasiMenjodohkan(state))
  if (state.tipe === TIPE.mengurutkan) galat.push(...validasiMengurutkan(state))

  return galat
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiPilihanGanda(state) {
  const galat = []

  if (state.opsi.length < MIN_OPSI) galat.push(`Pilihan ganda wajib punya minimal ${MIN_OPSI} opsi.`)
  if (state.opsi.length > MAKS_OPSI) galat.push(`Pilihan ganda maksimal ${MAKS_OPSI} opsi.`)
  if (state.opsi.some((satu) => satu.teks.trim() === '')) galat.push('Setiap opsi wajib punya teks.')

  const id = state.opsi.map((satu) => satu.id)
  if (new Set(id).size !== id.length) galat.push('Id opsi tidak boleh duplikat.')
  if (!id.includes(state.jawaban)) galat.push('Tandai satu opsi sebagai kunci jawaban.')

  return galat
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiMenjodohkan(state) {
  const galat = []

  if (state.kiri.length < MIN_ITEM || state.kanan.length < MIN_ITEM) {
    galat.push(`Menjodohkan wajib punya minimal ${MIN_ITEM} pasangan kiri dan kanan.`)
  }

  if (state.kiri.some((satu) => satu.teks.trim() === '')) galat.push('Setiap item kiri wajib punya teks.')
  if (state.kanan.some((satu) => satu.teks.trim() === '')) galat.push('Setiap item kanan wajib punya teks.')

  const idKanan = state.kanan.map((satu) => satu.id)

  for (const satu of state.kiri) {
    const pasangan = state.pasangan[satu.id] ?? ''
    if (pasangan === '') galat.push('Setiap item kiri wajib punya pasangan di kunci.')
    else if (!idKanan.includes(pasangan)) galat.push('Ada pasangan yang menunjuk item kanan tak dikenal.')
  }

  return [...new Set(galat)]
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiMengurutkan(state) {
  const galat = []

  if (state.item.length < MIN_ITEM) galat.push(`Mengurutkan wajib punya minimal ${MIN_ITEM} item.`)
  if (state.item.some((satu) => satu.teks.trim() === '')) galat.push('Setiap item wajib punya teks.')

  const posisi = state.item.map((satu) => Number(satu.posisi))
  const wajar = posisi.every((satu) => Number.isInteger(satu) && satu >= 1 && satu <= state.item.length)
  const unik = new Set(posisi).size === posisi.length

  if (!wajar || !unik) galat.push('Isi nomor urut benar untuk setiap item (1 sampai jumlah item, tanpa angka kembar).')

  return galat
}

/**
 * Susunan akhir mengurutkan untuk ditampilkan pada pratinjau.
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
export function pratinjauUrutan(state) {
  return urutanDariItem(state.item)
}
