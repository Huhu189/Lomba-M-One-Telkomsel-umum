/**
 * Titik sambung ke service realtime (SSE) — satu tempat untuk alamat dasar dan
 * bentuk URL-nya.
 *
 * Sebelumnya tiap halaman menulis `VITE_REALTIME_URL ?? 'http://localhost:4000'`
 * sendiri; begitu ada dua pemakai (Live Monitor guru dan layar kelas), salinan
 * itu mulai bisa berbeda diam-diam — dan alamat dasar yang salah hanya terlihat
 * sebagai "SSE tidak pernah hidup" di layar pengguna.
 */

/** Alamat dasar service realtime; bisa ditimpa lewat env Vite. */
export const DASAR_REALTIME = import.meta.env.VITE_REALTIME_URL ?? 'http://localhost:4000'

/**
 * URL aliran SSE satu kanal. Tiket selalu di-encode: tiket adalah 64 karakter
 * acak yang boleh mengandung `+`/`/`, dan tanpa encode `+` berubah menjadi
 * spasi di sisi server sehingga tiket tidak pernah cocok.
 *
 * @param {'monitor'|'kuis'} kanal
 * @param {string} tiket
 * @returns {string}
 */
export function urlSse(kanal, tiket) {
  return `${DASAR_REALTIME}/sse/${kanal}?tiket=${encodeURIComponent(tiket)}`
}
