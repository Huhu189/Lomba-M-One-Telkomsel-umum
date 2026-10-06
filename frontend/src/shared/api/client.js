/**
 * Klien HTTP terpusat (chunk structure: src/shared/api).
 * Sesi cookie SPA (withCredentials) — tanpa token di localStorage.
 */
import axios from 'axios'

export const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  // Tanpa batas waktu, layar "Menyiapkan…" bisa menggantung selamanya bila backend macet.
  timeout: 15_000,
  headers: { Accept: 'application/json' },
})

/** Barel axios terpisah untuk URL relatif root (contoh: /sanctum/csrf-cookie). */
export const axiosRoot = axios.create({
  baseURL: '/',
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

/** Penanda agar 401/419 tidak memicu loop event berulang. */
let sesiHabisTersiar = false

/** Penanda agar 429 tidak memicu event berulang untuk kegagalan beruntun. */
let throttleTersiar = false

/**
 * Reset penanda siaran (dipanggil saat pindah ke halaman auth / sesi baru).
 */
export function resetStatusSiaran() {
  sesiHabisTersiar = false
  throttleTersiar = false
}

/**
 * Cookie CSRF cukup diambil sekali per pemuatan halaman: Laravel hanya merotasinya
 * saat sesi berganti (login/keluar) atau kedaluwarsa. Respons 419 di bawah akan
 * membuang cache ini supaya permintaan berikutnya mengambil token baru.
 * @type {Promise<unknown>|null}
 */
let janjiCsrf = null

/** Buang cookie CSRF yang di-cache (dipakai setelah 419 / sesi berganti). */
export function lupakanCsrfCookie() {
  janjiCsrf = null
}

client.interceptors.response.use(
  (respons) => respons,
  (galat) => {
    const status = /** @type {number|undefined} */ (galat?.response?.status)

    // 401/419: sesi habis — kirim satu event, tanpa redirect paksa berulang.
    if (status === 401 || status === 419) {
      // 419 = token CSRF tidak cocok/kedaluwarsa: buang cache token.
      if (status === 419) lupakanCsrfCookie()

      if (!sesiHabisTersiar) {
        sesiHabisTersiar = true
        window.dispatchEvent(new CustomEvent('auth:sesi-habis'))
      }
    }

    // 429: throttle — siarkan hitung mundur dari header Retry-After (sekali per gelombang).
    if (status === 429 && !throttleTersiar) {
      throttleTersiar = true
      const header = /** @type {string|undefined} */ (
        galat?.response?.headers?.['retry-after']
      )
      const detik = Number(header) > 0 ? Number(header) : 0
      window.dispatchEvent(new CustomEvent('auth:throttle', { detail: { detik } }))

      // Setelah jeda header, izinkan siaran gelombang berikutnya.
      window.setTimeout(() => {
        throttleTersiar = false
      }, Math.max(detik, 1) * 1000)
    }

    return Promise.reject(galat)
  },
)

/**
 * Ambil cookie CSRF dari backend Sanctum (dipanggil sebelum login/submit).
 * Memakai axiosRoot agar URL persis /sanctum/csrf-cookie (tanpa awalan /api).
 * @returns {Promise<unknown>}
 */
export async function ambilCsrfCookie() {
  janjiCsrf ??= axiosRoot.get('/sanctum/csrf-cookie').catch((galat) => {
    // Jangan simpan kegagalan: percobaan berikutnya harus mencoba lagi.
    janjiCsrf = null
    throw galat
  })

  return janjiCsrf
}
