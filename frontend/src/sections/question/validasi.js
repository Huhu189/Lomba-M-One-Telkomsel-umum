/**
 * Skema form + validasi kelengkapan soal di sisi klien.
 *
 * Aturan di bawah mencerminkan registry backend (PenanganPilihanGanda,
 * PenanganBenarSalah, PenanganMenjodohkan, PenanganMengurutkan, PenanganLetakKata,
 * PenanganHubungKata, PenanganIsianSingkat, PenanganUraian) supaya guru melihat
 * pesan jelas sebelum menabrak 422 dari server.
 */
import { z } from 'zod'
import {
  TIPE,
  AMBANG_BAWAAN_ISIAN,
  AMBANG_BAWAAN_URAIAN,
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

  if (state.teks.trim() === '') galat.push('Isi soal wajib diisi.')
  if (state.matematika.trim().length > MAKS_MATEMATIKA) {
    galat.push(`Template MathML maksimal ${MAKS_MATEMATIKA} karakter.`)
  }

  const skor = Number(state.skor)
  if (!Number.isInteger(skor) || skor < 1 || skor > 100) galat.push('Skor harus angka 1 sampai 100.')

  if (state.tipe === TIPE.pilihanGanda) galat.push(...validasiPilihanGanda(state))
  if (state.tipe === TIPE.menjodohkan) galat.push(...validasiMenjodohkan(state))
  if (state.tipe === TIPE.mengurutkan) galat.push(...validasiMengurutkan(state))
  if (state.tipe === TIPE.hubungKata) galat.push(...validasiHubungKata(state))
  if (state.tipe === TIPE.letakKata) galat.push(...validasiLetakKata(state))
  if (state.tipe === TIPE.isianSingkat) galat.push(...validasiIsianSingkat(state))
  if (state.tipe === TIPE.uraian) galat.push(...validasiUraian(state))

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
  return validasiPasangan(state, 'Menjodohkan', state.pasangan)
}

/**
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiHubungKata(state) {
  return validasiPasangan(state, 'Hubung kata', state.sambungan)
}

/**
 * Aturan bersama menjodohkan & hubung kata (beda hanya nama kunci pemetaan).
 * @param {import('./tipeSoal.js').StateSoal} state
 * @param {string} jenis
 * @param {Record<string, string>} peta
 * @returns {string[]}
 */
function validasiPasangan(state, jenis, peta) {
  const galat = []

  if (state.kiri.length < MIN_ITEM || state.kanan.length < MIN_ITEM) {
    galat.push(`${jenis} wajib punya minimal ${MIN_ITEM} pasangan kiri dan kanan.`)
  }

  if (state.kiri.some((satu) => satu.teks.trim() === '')) galat.push('Setiap item kiri wajib punya teks.')
  if (state.kanan.some((satu) => satu.teks.trim() === '')) galat.push('Setiap item kanan wajib punya teks.')

  const idKanan = state.kanan.map((satu) => satu.id)

  for (const satu of state.kiri) {
    const pasangan = peta[satu.id] ?? ''
    if (pasangan === '') galat.push('Setiap item kiri wajib punya pasangan di kunci.')
    else if (!idKanan.includes(pasangan)) galat.push('Ada pasangan yang menunjuk item kanan tak dikenal.')
  }

  return [...new Set(galat)]
}

/**
 * Letak kata: minimal dua kata & dua posisi, id unik, dan setiap kata punya
 * posisi di kunci.
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiLetakKata(state) {
  const galat = []

  if (state.kata.length < MIN_ITEM || state.posisi.length < MIN_ITEM) {
    galat.push(`Letak kata wajib punya minimal ${MIN_ITEM} kata dan ${MIN_ITEM} posisi.`)
  }

  if (state.kata.some((satu) => satu.teks.trim() === '')) galat.push('Setiap kata wajib punya teks.')
  if (state.posisi.some((satu) => satu.teks.trim() === '')) galat.push('Setiap posisi wajib punya teks.')

  const idKata = state.kata.map((satu) => satu.id)
  const idPosisi = state.posisi.map((satu) => satu.id)

  if (new Set(idKata).size !== idKata.length) galat.push('Id kata tidak boleh duplikat.')
  if (new Set(idPosisi).size !== idPosisi.length) galat.push('Id posisi tidak boleh duplikat.')

  for (const satu of state.kata) {
    const posisi = state.penempatan[satu.id] ?? ''
    if (posisi === '') galat.push('Setiap kata wajib punya posisi di kunci.')
    else if (!idPosisi.includes(posisi)) galat.push('Ada penempatan yang menunjuk posisi tak dikenal.')
  }

  return [...new Set(galat)]
}

/**
 * Isian singkat: wajib punya jawaban baku; ambang (bila diisi) 0–1.
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiIsianSingkat(state) {
  const galat = []

  if (state.jawabanBaku.length === 0) galat.push('Isian singkat wajib punya minimal satu jawaban baku.')
  if (state.jawabanBaku.some((satu) => satu.teks.trim() === '')) {
    galat.push('Setiap jawaban baku wajib berupa teks.')
  }

  if (!ambangWajar(state.ambang)) {
    galat.push(`Ambang kemiripan isian harus angka lebih dari 0 sampai 1 (bawaan ${AMBANG_BAWAAN_ISIAN}).`)
  }

  return galat
}

/**
 * Uraian: wajib punya kata kunci; bobot opsional tetapi harus > 0 bila diisi.
 * @param {import('./tipeSoal.js').StateSoal} state
 * @returns {string[]}
 */
function validasiUraian(state) {
  const galat = []

  if (state.kataKunci.length === 0) galat.push('Uraian wajib punya minimal satu kata kunci.')
  if (state.kataKunci.some((satu) => satu.teks.trim() === '')) {
    galat.push('Setiap kata kunci wajib punya teks.')
  }

  for (const satu of state.kataKunci) {
    if (satu.bobot.trim() === '') continue
    const bobot = Number(satu.bobot)
    if (!Number.isFinite(bobot) || bobot <= 0) {
      galat.push('Bobot kata kunci wajib bilangan lebih dari 0.')
      break
    }
  }

  if (!ambangWajar(state.ambangLulus)) {
    galat.push(`Ambang lulus uraian harus angka lebih dari 0 sampai 1 (bawaan ${AMBANG_BAWAAN_URAIAN}).`)
  }

  return galat
}

/**
 * Ambang kosong dianggap memakai bawaan; selain itu wajib angka (0, 1].
 * @param {string} nilai
 * @returns {boolean}
 */
function ambangWajar(nilai) {
  if (nilai.trim() === '') return true
  const angka = Number(nilai)
  return Number.isFinite(angka) && angka > 0 && angka <= 1
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
