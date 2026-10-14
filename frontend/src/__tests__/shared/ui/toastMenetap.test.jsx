// @vitest-environment jsdom
/**
 * Toast galat bertahan sampai ditutup (14 Oktober 2026, temuan M5).
 *
 * Dulu SEMUA jenis toast memakai satu `setTimeout(5000)`. Pesan seperti "gagal
 * mengumpulkan" atau "gagal menyimpan" bisa hilang sebelum anak/guru sempat
 * membacanya — padahal justru pesan itulah yang paling penting. Sekarang hanya
 * sukses/info yang menutup sendiri; salah/peringatan menetap sampai ditutup,
 * dan yang menutup sendiri berhenti menghitung saat disentuh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastHost, useToastStore } from '../../../shared/ui/toast.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toasts: [] })
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  vi.useRealTimers()
})

/** @param {'sukses'|'salah'|'peringatan'|'info'} jenis @param {string} pesan */
function tampilkan(jenis, pesan) {
  act(() => {
    root.render(<ToastHost />)
  })
  act(() => {
    useToastStore.getState().push({ jenis, pesan })
  })
}

describe('ToastHost — lama tampil per jenis', () => {
  it('toast galat TIDAK menutup sendiri walau menunggu lama', () => {
    tampilkan('salah', 'Gagal mengumpulkan jawaban.')

    act(() => {
      vi.advanceTimersByTime(60000)
    })

    expect(wadah.textContent).toContain('Gagal mengumpulkan jawaban.')
    expect(wadah.querySelector('[data-menetap="1"]')).not.toBeNull()
  })

  it('toast peringatan juga menetap sampai ditutup', () => {
    tampilkan('peringatan', 'Waktu hampir habis.')

    act(() => {
      vi.advanceTimersByTime(30000)
    })

    expect(wadah.textContent).toContain('Waktu hampir habis.')
  })

  it('toast sukses tetap menutup sendiri, dan bisa ditutup manual', () => {
    tampilkan('sukses', 'Jawaban tersimpan.')

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(wadah.textContent).not.toContain('Jawaban tersimpan.')

    tampilkan('salah', 'Gagal menyimpan.')

    const tombolTutup = /** @type {HTMLButtonElement} */ (wadah.querySelector('.toast-tutup'))

    act(() => tombolTutup.click())

    expect(wadah.textContent).not.toContain('Gagal menyimpan.')
  })

  it('toast sukses berhenti menghitung saat disorot tetikus', () => {
    tampilkan('sukses', 'Nilai tersimpan.')
    const kartu = /** @type {HTMLElement} */ (wadah.querySelector('.toast-item'))

    // React memetakan onMouseEnter dari `mouseover` (delegasi), jadi itu yang
    // dikirim di sini — bukan `mouseenter` yang tidak didengarkan React.
    act(() => {
      kartu.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }))
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(wadah.textContent).toContain('Nilai tersimpan.')
  })
})
