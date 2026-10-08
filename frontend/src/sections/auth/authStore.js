/**
 * Store sesi global (zustand) — sumber kebenaran user yang sedang masuk.
 * Mendengarkan event klien HTTP: auth:sesi-habis (401/419) & auth:throttle (429).
 * Tanpa token di localStorage: user hilang saat sesi server berakhir.
 */
import { create } from 'zustand'
import { resetStatusSiaran } from '../../shared/api/client.js'
import { klienQuery } from '../../shared/store/klienQuery.js'
import { useSimpananJawaban } from '../attempt/simpananJawaban.js'
import { ambilSaya, cekTerautentikasi, keluar, masuk as apiMasuk } from './api.js'

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
 *   sesiSiap: boolean,
 *   detikTunggu: number,
 *   aturUser: (user: DataUser | null) => void,
 *   masuk: (data: { email: string, password: string }) => Promise<DataUser>,
 *   keluar: () => Promise<void>,
 *   mulaiTungguThrottle: (detik: number) => void,
 *   muatUser: () => Promise<void>,
 *   pulihkanSesi: () => Promise<void>,
 * }} AuthState
 */

/** Timer hitung mundur throttle (satu global agar tidak bertumpuk). */
let timerThrottle = /** @type {ReturnType<typeof setInterval>|null} */ (null)

/**
 * Bersihkan jejak sesi dari perangkat ini — dipakai keluar sengaja maupun sesi
 * habis sendiri (401/419).
 *
 * Tiga tempat menyimpan data murid, dan ketiganya harus kosong sebelum murid
 * berikutnya memakai komputer lab yang sama:
 *
 * 1. `klienQuery` — cache TanStack Query (daftar ulangan, jawaban, hasil).
 *    Kuncinya tidak memuat identitas pengguna, jadi tanpa dibuang murid
 *    berikutnya melihat data murid sebelumnya.
 * 2. `useSimpananJawaban` — cadangan jawaban di localStorage (tanpa akun).
 * 3. `resetStatusSiaran` — penanda "sudah pernah diberi tahu" di klien HTTP,
 *    supaya toast sesi berakhir/429 muncul lagi untuk sesi berikutnya.
 */
export function bersihkanJejakSesi() {
  resetStatusSiaran()
  klienQuery.clear()
  useSimpananJawaban.getState().bersihkanSemua()
}

/**
 * Creator store auth dengan tipe eksplisit untuk checkJs.
 * @param {{
 *   (updater: (state: AuthState) => Partial<AuthState>): void,
 *   (partial: Partial<AuthState>): void,
 * }} set
 * @param {() => AuthState} get
 * @returns {AuthState}
 */
function buatStoreAuth(set, get) {
  return {
    user: null,
    sesiSiap: false,
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
        // Dibersihkan walau server menolak: murid yang menekan "Keluar" di
        // komputer lab bersama harus meninggalkan perangkat tanpa data apa pun.
        bersihkanJejakSesi()
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

    /**
     * Pulihkan sesi saat halaman dimuat/di-refresh. Cookie sesi ada di
     * browser, tetapi state React hilang — tanpa ini murid tampak "keluar"
     * setiap reload. Memakai /v1/sesi (tanpa 401) agar tamu tidak memicu
     * event auth:sesi-habis dan toast "Sesi berakhir" yang menyesatkan.
     */
    pulihkanSesi: async () => {
      try {
        if (await cekTerautentikasi()) {
          await get().muatUser()
        }
      } catch {
        // Backend tidak terjangkau / sesi tidak sah: perlakukan sebagai tamu.
      } finally {
        set({ sesiSiap: true })
      }
    },
  }
}

export const useAuthStore = create()(
  /** @type {import('zustand').StateCreator<AuthState, [], []>} */ (buatStoreAuth),
)

/** Penanda agar listener tidak terpasang ganda (StrictMode memanggil efek dua kali). */
let listenerTerpasang = false

/** Pasang listener event global sekali saat aplikasi dimuat (dipanggil dari App). */
export function pasangListenerSesi() {
  if (listenerTerpasang) return
  listenerTerpasang = true

  window.addEventListener('auth:sesi-habis', () => {
    // Sesi kedaluwarsa di komputer bersama sama bocornya dengan keluar sengaja,
    // jadi jalur ini dibersihkan dengan cara yang sama (S-14).
    bersihkanJejakSesi()
    useAuthStore.getState().aturUser(null)
  })

  window.addEventListener('auth:throttle', (acara) => {
    const detail = /** @type {{detik?: number}|null} */ (
      /** @type {CustomEvent} */ (acara).detail
    )
    useAuthStore.getState().mulaiTungguThrottle(Number(detail?.detik ?? 0))
  })
}

/**
 * Apakah galat ini sudah ditampilkan sebagai hitung mundur throttle (HTTP 429
 * dengan Retry-After)? Dipakai form agar pesan tidak muncul dobel.
 * @param {unknown} galat
 * @returns {boolean}
 */
export function sudahDitampilkanSebagaiTunggu(galat) {
  const status = /** @type {any} */ (galat)?.response?.status
  return status === 429 && useAuthStore.getState().detikTunggu > 0
}
