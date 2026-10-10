/**
 * Perhitungan murni untuk navigator soal dan ringkasan sebelum mengumpulkan
 * (papan desain 4 "Layar ulangan murid").
 *
 * Dipisah dari komponen supaya bisa diuji tanpa DOM: status tiap nomor
 * (dijawab / ragu-ragu / belum dijawab) dan hitungan akhir untuk dialog
 * "Sudah selesai mengerjakan?".
 */

/**
 * Status satu soal. Ragu menang atas terjawab: murid menandai soal untuk
 * ditinjau lagi walau sudah diisi, dan penanda itu harus tetap terlihat.
 * @param {{ terjawab: boolean, ragu: boolean }} keadaan
 * @returns {'ragu'|'dijawab'|'kosong'}
 */
export function statusSoal({ terjawab, ragu }) {
  if (ragu) return 'ragu'
  return terjawab ? 'dijawab' : 'kosong'
}

/**
 * Label status untuk pembaca layar — status tidak boleh hanya warna/ikon.
 * @param {'ragu'|'dijawab'|'kosong'} status
 * @returns {string}
 */
export function labelStatus(status) {
  if (status === 'ragu') return 'ragu-ragu'
  if (status === 'dijawab') return 'sudah dijawab'
  return 'belum dijawab'
}

/**
 * Ringkasan seluruh soal untuk dialog sebelum mengumpulkan.
 * @param {Array<{ id: number }>} soal
 * @param {Record<string, unknown>} jawaban
 * @param {Record<string, boolean>} ragu
 * @returns {{ total: number, terjawab: number, ragu: number, kosong: number, semuaTerjawab: boolean }}
 */
export function ringkasProgres(soal, jawaban, ragu) {
  let terjawab = 0
  let jumlahRagu = 0

  for (const satu of soal) {
    const kunci = String(satu.id)
    const dijawab = jawaban[kunci] !== undefined && jawaban[kunci] !== null && jawaban[kunci] !== ''
    if (dijawab) terjawab += 1
    if (ragu[kunci]) jumlahRagu += 1
  }

  const total = soal.length
  return {
    total,
    terjawab,
    ragu: jumlahRagu,
    kosong: total - terjawab,
    semuaTerjawab: total > 0 && terjawab === total,
  }
}

/**
 * Pesan dialog saat mengumpulkan: menyebut yang masih kurang, bukan hanya
 * "kumpulkan?".
 * @param {{ ragu: number, kosong: number }} ringkas
 * @returns {string}
 */
export function pesanKumpul(ringkas) {
  if (ringkas.kosong > 0 || ringkas.ragu > 0) {
    return 'Masih ada soal yang belum selesai. Kalau sudah dikumpulkan, jawaban tidak bisa diubah lagi.'
  }
  return 'Semua soal sudah dijawab. Kalau sudah dikumpulkan, jawaban tidak bisa diubah lagi.'
}
