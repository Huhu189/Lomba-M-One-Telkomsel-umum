/**
 * Store sesi global (zustand) — sumber kebenaran user yang sedang masuk.
 * Mendengarkan event klien HTTP: auth:sesi-habis (401/419) & auth:throttle (429).
 * Tanpa token di localStorage: user hilang saat sesi server berakhir.
 */
import { create } from 'zustand'
import { resetStatusSiaran } from '../../shared/api/client.js'
import { ambilSaya, keluar, masuk as apiMasuk } from './api.js'

/**
 * @typedef {{
 *   id: number,
 *   name: string,
 *   email: string,
 *   role: string,
 *   status: string,
 *   statusLabel: string,
 *   emailTerverifikasi: boolean,
 * }} DataUser
 */

/**
 * @typedef {{
 *   user: DataUser | null,
 *   detikTunggu: number,
 *   aturUser: (user: DataUser | null) => void,
 *   masuk: (data: { email: string, password: string }) => Promise<DataUser>,
 *   keluar: () => Promise<void>,
 *   mulaiTungguThrottle: (detik: number) => void,
 *   muatUser: () => Promise<void>,
 * }} AuthState
 */

/** Timer hitung mundur throttle (satu global agar tidak bertumpuk). */
let timerThrottle = /** @type {ReturnType<typeof setInterval>|null} */ (null)

/**
 * Creator store auth dengan tipe eksplisit untuk checkJs.
 * @param {{
 *   (updater: (state: AuthState) => Partial<AuthState>): void,
 *   (partial: Partial<AuthState>): void,
 * }} set
 * @returns {AuthState}
 */
function buatStoreAuth(set) {
  return {
    user: null,
    detikTunggu: 0,

    aturUser: (user) => set({ user }),

    masuk: async (data) => {
      const user = await apiMasuk(data)
      set({ user })
      return user
    },

    keluar: async () => {
      try {
        await keluar()
      } finally {
        set({ user: null })
      }
    },

    mulaiTungguThrottle: (detik) => {
      if (timerThrottle !== null) {
        clearInterval(timerThrottle)
      }
      set({ detikTunggu: Math.max(0, detik) })
      if (detik <= 0) return

      timerThrottle = setInterval(() => {
        set((state) => {
          const sisa = state.detikTunggu - 1
          if (sisa <= 0) {
            if (timerThrottle !== null) {
              clearInterval(timerThrottle)
              timerThrottle = null
            }
            return { detikTunggu: 0 }
          }
          return { detikTunggu: sisa }
        })
      }, 1000)
    },

    muatUser: async () => {
      set({ user: await ambilSaya() })
    },
  }
}

export const useAuthStore = create()(
  /** @type {import('zustand').StateCreator<AuthState, [], []>} */ (buatStoreAuth),
)

/** Pasang listener event global sekali saat aplikasi dimuat (dipanggil dari App). */
export function pasangListenerSesi() {
  window.addEventListener('auth:sesi-habis', () => {
    resetStatusSiaran()
    useAuthStore.getState().aturUser(null)
  })

  window.addEventListener('auth:throttle', (acara) => {
    const detail = /** @type {{detik?: number}|null} */ (
      /** @type {CustomEvent} */ (acara).detail
    )
    useAuthStore.getState().mulaiTungguThrottle(Number(detail?.detik ?? 0))
  })
}
