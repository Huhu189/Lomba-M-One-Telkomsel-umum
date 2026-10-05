/**
 * Klien HTTP terpusat (chunk structure: src/shared/api).
 * Sesi cookie SPA (withCredentials) — tanpa token di localStorage.
 */
import axios from 'axios'

export const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

/** Penanda agar 401/419 tidak memicu loop event berulang. */
let sedangKeluar = false

/**
 * Reset penanda keluar (dipanggil saat kembali ke halaman login).
 */
export function resetStatusKeluar() {
  sedangKeluar = false
}

client.interceptors.response.use(
  (respons) => respons,
  (galat) => {
    const status = /** @type {number|undefined} */ (galat?.response?.status)

    // 401/419: sesi habis — kirim satu event, tanpa redirect paksa berulang.
    if ((status === 401 || status === 419) && !sedangKeluar) {
      sedangKeluar = true
      window.dispatchEvent(new CustomEvent('auth:sesi-habis'))
    }

    // 429: throttle — siarkan hitung mundur dari header Retry-After.
    if (status === 429) {
      const header = /** @type {string|undefined} */ (
        galat?.response?.headers?.['retry-after']
      )
      const detik = Number(header) > 0 ? Number(header) : 0
      window.dispatchEvent(new CustomEvent('auth:throttle', { detail: { detik } }))
    }

    return Promise.reject(galat)
  },
)

/**
 * Ambil cookie CSRF dari backend Sanctum (dipanggil sebelum login/submit).
 * @returns {Promise<void>}
 */
export async function ambilCsrfCookie() {
  await client.get('/sanctum/csrf-cookie')
}
