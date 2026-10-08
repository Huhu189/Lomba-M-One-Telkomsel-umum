/**
 * Ringkasan jawaban layar pengerjaan.
 *
 * Penghitung "Terjawab" di `HalamanKerjakan` dulu hanya memeriksa `!== undefined`.
 * Isian singkat yang diketik lalu DIHAPUS meninggalkan string kosong di state,
 * sehingga tetap terhitung terjawab walau murid tidak mengisinya — layar bilang
 * "Terjawab 5 / 10" padahal hanya 4 yang berisi (Q-19).
 */

/**
 * Apakah satu nilai jawaban benar-benar berisi?
 *
 * Bentuk nilai yang mungkin: string (isian singkat/uraian), angka/boolean
 * (pilihan ganda, benar-salah), daftar (mengurutkan), atau peta (menjodohkan).
 *
 * @param {unknown} nilai
 * @returns {boolean}
 */
export function adaJawaban(nilai) {
  if (nilai === undefined || nilai === null) return false

  if (typeof nilai === 'string') return nilai.trim() !== ''

  if (Array.isArray(nilai)) return nilai.length > 0

  if (typeof nilai === 'object') return Object.keys(nilai).length > 0

  // Angka dan boolean (mis. pilihan benar-salah `false`) adalah pilihan sah.
  return true
}

/**
 * Hitung berapa soal yang benar-benar terjawab.
 *
 * @param {{ id: number }[]} soal
 * @param {Record<string, unknown>} jawaban
 * @returns {number}
 */
export function hitungTerjawab(soal, jawaban) {
  return soal.filter((satu) => adaJawaban(jawaban[String(satu.id)])).length
}
