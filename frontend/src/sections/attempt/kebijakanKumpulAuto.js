/**
 * Kebijakan percobaan kumpul otomatis saat waktu habis (temuan Q-04).
 *
 * Dipisah dari komponen supaya bisa diuji tanpa DOM: tanpa batas percobaan dan
 * tanpa berhenti pada penolakan permanen (4xx), efek auto-submit di layar
 * pengerjaan memanggil ulang dirinya sendiri tanpa henti.
 */

/** Batas percobaan kumpul otomatis; setelah itu murid diminta menghubungi guru. */
export const BATAS_PERCOBAAN_AUTO = 4

/** Jeda awal sebelum percobaan pertama (ms). */
export const JEDA_AUTO_MIN = 2000

/** Jeda maksimum antar percobaan (ms). */
export const JEDA_AUTO_MAKS = 30_000

/**
 * Jeda sebelum percobaan ke-`percobaan` (0 = percobaan pertama), berlipat dua
 * tiap percobaan dan berhenti naik di `JEDA_AUTO_MAKS`.
 * @param {number} percobaan
 * @returns {number} milidetik
 */
export function jedaAutoMs(percobaan) {
  const aman = Math.max(0, Math.floor(percobaan))

  return Math.min(JEDA_AUTO_MAKS, JEDA_AUTO_MIN * 2 ** aman)
}

/**
 * Haruskah loop kumpul otomatis berhenti (dan layar meminta bantuan guru)?
 * @param {{ percobaan: number, permanen?: boolean, berhasil?: boolean }} arg
 * @returns {boolean}
 */
export function harusMandek({ percobaan, permanen = false, berhasil = false }) {
  if (berhasil) return false

  return permanen || percobaan >= BATAS_PERCOBAAN_AUTO
}
