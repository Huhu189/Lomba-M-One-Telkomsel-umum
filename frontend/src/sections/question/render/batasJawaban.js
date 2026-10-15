/**
 * Batas panjang jawaban teks di layar pengerjaan.
 *
 * BATAS_URAIAN HARUS sama dengan `config('jawaban.teks_maks')` di backend
 * (JawabRequest). Bila backend lebih kecil, autosave ditolak 422 dan teks murid
 * di atas batas tidak pernah sampai ke server.
 */

/** Uraian: kotak teks panjang. */
export const BATAS_URAIAN = 10_000

/** Isian singkat: satu kotak teks pendek. */
export const BATAS_ISIAN_SINGKAT = 200

/**
 * Sisa ruang tampil jelas begitu jawaban mendekati batas (10% terakhir).
 * @param {number} panjang
 * @param {number} batas
 * @returns {'aman'|'hampir'|'habis'}
 */
export function keadaanBatas(panjang, batas) {
  if (panjang >= batas) return 'habis'
  if (batas - panjang <= Math.ceil(batas * 0.1)) return 'hampir'
  return 'aman'
}
