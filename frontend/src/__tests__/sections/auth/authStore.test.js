/**
 * @vitest-environment jsdom
 *
 * Vitest alur sesi: event auth:sesi-habis (401/419) & auth:throttle (429)
 * dari interceptor client.js harus mengubah state store.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { pasangListenerSesi, useAuthStore } from '../../../sections/auth/authStore.js'

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

  it('auth:sesi-habis mengosongkan user (tanpa localStorage)', () => {
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

    siarkan('auth:sesi-habis')

    expect(useAuthStore.getState().user).toBeNull()
    expect(window.localStorage.length).toBe(0)
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
