// @vitest-environment jsdom
/**
 * Proteksi ulangan yang adil untuk perangkat sentuh (T5).
 *
 * Yang dijaga di sini adalah tiga kesalahan yang menghukum anak diam-diam:
 *
 * 1. resize karena keyboard ponsel / bar alamat tidak boleh mengaburkan layar;
 * 2. keluar jendela sebentar tidak boleh langsung mengunci layar 60 detik;
 * 3. membuka dialog pilih berkas (lampiran foto) bukan pelanggaran.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import useExamSecurity from '../../security/useExamSecurity.js'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** Proteksi yang menyala lengkap untuk deteksi yang sedang diuji. */
const PROTEKSI = {
  anti_cheat: true,
  exam_mode: false,
  block_tab_switch: true,
  focus_lock: true,
  detect_window_resize: true,
}

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/** Komponen pembungkus: menampilkan status yang diuji sebagai teks. */
function Percobaan() {
  const { kabur, kunciDetik } = useExamSecurity({
    attemptId: 1,
    proteksi: PROTEKSI,
    aktif: true,
    kirim: async () => true,
  })

  return (
    <p>
      {kabur ? 'kabur' : 'jelas'}|{kunciDetik}
    </p>
  )
}

/**
 * Lebar jendela jsdom bisa diubah lewat defineProperty (dipakai sebagai sinyal).
 *
 * @param {number} px
 */
function setLebar(px) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px })
}

/** Baca status yang dirender. */
function status() {
  return (wadah.textContent ?? '').split('|')
}

beforeEach(() => {
  vi.useFakeTimers()
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
  setLebar(1024)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  vi.useRealTimers()
})

describe('proteksi adaptif di perangkat sentuh', () => {
  it('resize yang hanya mengubah tinggi (keyboard ponsel) tidak mengaburkan layar', async () => {
    act(() => root.render(<Percobaan />))

    // Keyboard virtual muncul: tinggi berubah, lebar tetap.
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(1000)
    })

    expect(status()[0]).toBe('jelas')
  })

  it('jendela yang benar-benar diubah lebarnya tetap mengaburkan sebentar', async () => {
    act(() => root.render(<Percobaan />))

    await act(async () => {
      setLebar(600)
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(200)
    })

    expect(status()[0]).toBe('kabur')

    // Kaburnya sebentar saja: kembali jelas setelah 3 detik.
    await act(async () => {
      vi.advanceTimersByTime(3200)
    })

    expect(status()[0]).toBe('jelas')
  })

  it('saat anak mengetik di kolom jawaban, perubahan lebar tidak mengaburkan', async () => {
    const kolom = document.createElement('textarea')
    document.body.appendChild(kolom)

    act(() => root.render(<Percobaan />))
    kolom.focus()

    await act(async () => {
      setLebar(700)
      window.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(1000)
    })

    expect(status()[0]).toBe('jelas')

    kolom.remove()
  })

  it('kembali cepat dalam masa tenggang tidak mengunci layar', async () => {
    act(() => root.render(<Percobaan />))

    await act(async () => {
      window.dispatchEvent(new Event('blur'))
      vi.advanceTimersByTime(3000)
    })

    // Belum terkunci selama masa tenggang.
    expect(status()[1]).toBe('0')

    // Anak kembali (notifikasi ditutup, aplikasi dibuka lagi).
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      vi.advanceTimersByTime(30000)
    })

    expect(status()[1]).toBe('0')
  })

  it('pergi lebih lama dari masa tenggang baru mengunci layar 60 detik', async () => {
    act(() => root.render(<Percobaan />))

    await act(async () => {
      window.dispatchEvent(new Event('blur'))
      vi.advanceTimersByTime(8500)
    })

    expect(status()[1]).toBe('60')

    // Hitungannya berjalan mundur sampai nol lagi.
    await act(async () => {
      vi.advanceTimersByTime(60000)
    })

    expect(status()[1]).toBe('0')
  })

  it('membuka dialog pilih berkas tidak mengunci layar', async () => {
    const berkas = document.createElement('input')
    berkas.type = 'file'
    document.body.appendChild(berkas)

    act(() => root.render(<Percobaan />))

    // Peramban memindahkan fokus ke input berkas saat dialognya terbuka, lalu
    // jendela kehilangan fokus.
    await act(async () => {
      berkas.focus()
      window.dispatchEvent(new Event('blur'))
      vi.advanceTimersByTime(20000)
    })

    expect(status()[1]).toBe('0')

    berkas.remove()
  })
})
