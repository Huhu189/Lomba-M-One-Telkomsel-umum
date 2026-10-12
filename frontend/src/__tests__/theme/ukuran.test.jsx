// @vitest-environment jsdom
/**
 * Ukuran tulisan (papan putaran 3: "Ukuran: dua pilihan saja. Satu variabel,
 * --s. Normal untuk semua, Besar untuk murid kecil atau layar jauh.").
 *
 * Yang dijaga berkas ini adalah kontrak JS-nya: pilihan sah hanya
 * 'normal'/'besar', pilihan tersimpan dipakai lagi, isi localStorage yang rusak
 * jatuh ke Normal, dan tombolnya benar-benar menuliskan pilihan ke <html>.
 *
 * Pagar untuk sisi CSS-nya (satu variabel --s yang mengalikan seluruh skala,
 * termasuk judul Bootstrap) sengaja TIDAK di sini, melainkan di
 * docs/smoke-ui-ukuran.mjs — karena ia harus mengukur ukuran huruf yang benar-
 * benar dipakai peramban, bukan membaca berkas CSS sebagai teks. Membacanya
 * sebagai teks pun tidak jalan: `import.meta.glob(..., { query: '?raw' })`
 * mengembalikan string kosong untuk CSS di Vite/vitest versi repo ini.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import TombolUkuran from '../../shared/layout/TombolUkuran.jsx'
import {
  bacaUkuranAwal,
  mulaiUkuran,
  skemaUkuran,
  terapkanUkuran,
  useTemaStore,
} from '../../shared/store/tema.js'

/** @type {{ IS_REACT_ACT_ENVIRONMENT?: boolean }} */ (globalThis).IS_REACT_ACT_ENVIRONMENT = true

const KUNCI_UKURAN = 'ukuran-ulangan'

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-ukuran')
  useTemaStore.setState({ ukuran: 'normal' })
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  window.localStorage.clear()
})

describe('ukuran tulisan', () => {
  it('hanya menerima normal dan besar', () => {
    expect(skemaUkuran.options).toEqual(['normal', 'besar'])
  })

  it('tanpa pilihan tersimpan memakai Normal, isi rusak pun Normal', () => {
    expect(bacaUkuranAwal()).toBe('normal')

    window.localStorage.setItem(KUNCI_UKURAN, 'rapat')
    expect(bacaUkuranAwal()).toBe('normal')

    window.localStorage.setItem(KUNCI_UKURAN, 'besar')
    expect(bacaUkuranAwal()).toBe('besar')
  })

  it('mulaiUkuran memasang atribut di <html>', () => {
    window.localStorage.setItem(KUNCI_UKURAN, 'besar')
    mulaiUkuran()

    expect(document.documentElement.getAttribute('data-ukuran')).toBe('besar')
    expect(useTemaStore.getState().ukuran).toBe('besar')
  })

  it('tombol membalik Normal ↔ Besar, menulis atribut, dan mengingatnya', () => {
    terapkanUkuran('normal')
    act(() => {
      root.render(<TombolUkuran />)
    })

    const tombol = /** @type {HTMLButtonElement} */ (wadah.querySelector('button'))
    expect(tombol.getAttribute('aria-pressed')).toBe('false')
    expect(tombol.getAttribute('aria-label')).toContain('Normal')

    act(() => tombol.click())

    expect(document.documentElement.getAttribute('data-ukuran')).toBe('besar')
    expect(window.localStorage.getItem(KUNCI_UKURAN)).toBe('besar')
    expect(wadah.querySelector('button')?.getAttribute('aria-pressed')).toBe('true')

    act(() => wadah.querySelector('button')?.click())
    expect(document.documentElement.getAttribute('data-ukuran')).toBe('normal')
  })
})
