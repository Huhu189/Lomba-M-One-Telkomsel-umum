/**
 * Keadaan jaringan layar pengerjaan (sistem luring).
 *
 * Kenapa bukan `navigator.onLine` saja: wifi sekolah bisa mati di tengah
 * permintaan tanpa `navigator.onLine` ikut berubah (perangkat masih tersambung
 * ke titik akses, gerbang internetnya yang putus). Karena itu kegagalan kirim
 * terakhir ikut dihitung: selama masih di dalam jendela kegagalan, layar
 * diperlakukan LURING sehingga jawaban ditulis ke cadangan lokal dulu dan
 * pengiriman ditahan — bukan menembakkan permintaan yang pasti gagal tiap
 * 800 ms lalu menumpuk galat.
 *
 * Modul ini murni (tanpa DOM) supaya bisa diuji tanpa jaringan: pemanggil
 * menyuntikkan `navigator.onLine` dan jam.
 */

/** Selama ini setelah kegagalan terakhir pengiriman ditahan (ms). */
export const JENDELA_GAGAL_MS = 10_000

/** Ada koneksi ke server. */
export const DARING = 'daring'

/** Tidak ada koneksi (atau koneksi sedang tidak bisa diandalkan). */
export const LURING = 'luring'

/**
 * @typedef {{ online: boolean, gagalAt: number }} KeadaanJaringan
 *   `online` = kata `navigator.onLine`; `gagalAt` = jam klien saat kegagalan
 *   kirim terakhir (0 = belum pernah gagal).
 */

/**
 * Keadaan awal dari `navigator.onLine`.
 * @param {boolean} online
 * @returns {KeadaanJaringan}
 */
export function keadaanJaringan(online) {
  return { online: online === true, gagalAt: 0 }
}

/**
 * Perbarui kabar `navigator.onLine` (event online/offline).
 * @param {KeadaanJaringan} keadaan
 * @param {boolean} online
 * @returns {KeadaanJaringan}
 */
export function sadarDaring(keadaan, online) {
  return { ...keadaan, online: online === true }
}

/**
 * Satu permintaan gagal karena masalah jaringan (tanpa respons / 5xx / 408 / 429).
 * @param {KeadaanJaringan} keadaan
 * @param {number} sekarangMs
 * @returns {KeadaanJaringan}
 */
export function sadarGagal(keadaan, sekarangMs) {
  return { ...keadaan, gagalAt: sekarangMs }
}

/**
 * Satu permintaan berhasil — koneksi jelas hidup, jendela kegagalan ditutup.
 * @param {KeadaanJaringan} keadaan
 * @returns {KeadaanJaringan}
 */
export function sadarPulih(keadaan) {
  return { ...keadaan, gagalAt: 0 }
}

/**
 * Status jaringan saat ini.
 *
 * LURING bila `navigator.onLine` bilang putus ATAU kegagalan kirim terakhir
 * masih di dalam jendela kegagalan. Dua sumber itu sengaja dipakai bersama:
 * `navigator.onLine` cepat tahu kabel/wifi dicabut, sedangkan jendela kegagalan
 * menangkap koneksi yang "ada" tetapi tidak sampai ke server.
 *
 * @param {KeadaanJaringan} keadaan
 * @param {number} sekarangMs
 * @param {number} [jendelaMs]
 * @returns {typeof DARING | typeof LURING}
 */
export function statusJaringan(keadaan, sekarangMs, jendelaMs = JENDELA_GAGAL_MS) {
  if (!keadaan.online) return LURING
  if (keadaan.gagalAt > 0 && sekarangMs - keadaan.gagalAt <= jendelaMs) return LURING

  return DARING
}

/**
 * Boleh mencoba kirim ke server sekarang?
 * @param {KeadaanJaringan} keadaan
 * @param {number} sekarangMs
 * @param {number} [jendelaMs]
 * @returns {boolean}
 */
export function layakKirim(keadaan, sekarangMs, jendelaMs = JENDELA_GAGAL_MS) {
  return statusJaringan(keadaan, sekarangMs, jendelaMs) === DARING
}

/**
 * Lama menunggu sebelum mencoba lagi setelah jaringan dinyatakan tidak siap (ms).
 *
 * Saat `navigator.onLine` bilang putus, pengiriman tidak dijadwalkan ulang sama
 * sekali — event `online` yang akan membangunkannya. Saat online tetapi kirim
 * gagal, tunggu sisa jendela kegagalan supaya percobaan berikutnya tidak
 * menembak server yang sedang bermasalah.
 *
 * @param {KeadaanJaringan} keadaan
 * @param {number} sekarangMs
 * @param {number} [jendelaMs]
 * @returns {number} 0 berarti layak kirim sekarang
 */
export function tundaKirimMs(keadaan, sekarangMs, jendelaMs = JENDELA_GAGAL_MS) {
  if (layakKirim(keadaan, sekarangMs, jendelaMs)) return 0

  if (!keadaan.online) return Number.POSITIVE_INFINITY

  return Math.max(0, keadaan.gagalAt + jendelaMs - sekarangMs)
}
