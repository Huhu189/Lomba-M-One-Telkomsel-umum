/**
 * @vitest-environment jsdom
 *
 * Vitest alur sesi: event auth:sesi-habis (401/419) & auth:throttle (429)
 * dari interceptor client.js harus mengubah state store.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { pasangListenerSesi, useAuthStore } from '../../../sections/auth/authStore.js'
import { useRiwayatJawaban } from '../../../sections/attempt/riwayatJawaban.js'

/** Kunci penyimpanan milik mode luring — semuanya wajib kosong saat sesi berakhir. */
const KUNCI_LURING = ['ulangan-cadangan-jawaban-v1', 'ulangan-riwayat-jawaban-v1']

/**
 * Stub jsdom CustomEvent.detail agar terbaca store (jsdom turunkan ke Event).
 * @param {string} nama
 * @param {{detik?: number}=} detail
 */
function siarkan(nama, detail) {
  const acara = /** @type {any} */ (new CustomEvent(nama))
  if (detail !== undefined) {
    Object.defineProperty(acara, 'detail', { value: detail })
  }
  window.dispatchEvent(acara)
}

describe('alur sesi (401/419 & 429)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, detikTunggu: 0 })
  })

  it('auth:sesi-habis mengosongkan user dan tidak menyimpan data sesi di localStorage', () => {
    pasangListenerSesi()
    useAuthStore.setState({
      user: {
        id: 1,
        name: 'Rina',
        email: 'rina@sekolah.test',
        role: 'murid',
        status: 'aktif',
        statusLabel: 'Aktif',
        emailTerverifikasi: true,
      },
    })

    // Jejak kerja luring yang bisa ditinggalkan murid di komputer bersama.
    useRiwayatJawaban.getState().catat(7, {
      soal_id: 21,
      nomor: 1,
      tipe: 'pilihan_ganda',
      jawaban: 'B',
      server_at: new Date().toISOString(),
    })

    expect(useRiwayatJawaban.getState().perAttempt['7']).toBeDefined()

    siarkan('auth:sesi-habis')

    expect(useAuthStore.getState().user).toBeNull()

    // Sesi tetap hidup di cookie httpOnly, bukan di localStorage. Kunci yang
    // boleh tersisa hanya milik mode luring — cadangan jawaban, riwayat jawaban,
    // salinan soal — dan ketiganya WAJIB kosong saat sesi berakhir (S-14).
    const kunciTersisa = [...Array(window.localStorage.length)].map(
      (_, i) => window.localStorage.key(i) ?? '',
    )

    expect(kunciTersisa.filter((satu) => !KUNCI_LURING.includes(satu))).toEqual([])
    expect(useRiwayatJawaban.getState().perAttempt).toEqual({})
    expect(window.localStorage.getItem('ulangan-snapshot-attempt-v1')).toBeNull()

    let semua = ''

    for (let i = 0; i < window.localStorage.length; i++) {
      semua += window.localStorage.getItem(window.localStorage.key(i) ?? '') ?? ''
    }

    expect(semua).not.toContain('Rina')
    expect(semua).not.toContain('token')
  })

  it('auth:throttle memulai hitung mundur dari detail.detik', () => {
    pasangListenerSesi()

    siarkan('auth:throttle', { detik: 30 })

    expect(useAuthStore.getState().detikTunggu).toBe(30)
  })

  it('auth:throttle tanpa detail tetap aman (0 detik)', () => {
    pasangListenerSesi()

    siarkan('auth:throttle', undefined)

    expect(useAuthStore.getState().detikTunggu).toBe(0)
  })

  it('mulaiTungguThrottle berkurang tiap detik lalu berhenti di 0', () => {
    vi.useFakeTimers()
    const store = useAuthStore.getState()
    store.mulaiTungguThrottle(2)

    vi.advanceTimersByTime(1000)
    expect(useAuthStore.getState().detikTunggu).toBe(1)

    vi.advanceTimersByTime(1000)
    expect(useAuthStore.getState().detikTunggu).toBe(0)

    // Detik berikutnya tidak jadi negatif.
    vi.advanceTimersByTime(1000)
    expect(useAuthStore.getState().detikTunggu).toBe(0)

    vi.useRealTimers()
  })
})
