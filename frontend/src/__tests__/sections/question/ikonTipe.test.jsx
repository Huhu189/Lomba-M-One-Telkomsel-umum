import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  DAFTAR_TIPE,
  IKON_TIPE,
  TIPE,
  ikonTipe,
} from '../../../sections/question/tipeSoal.js'

/**
 * Pemilih jenis soal ringkas (papan 11 revisi) menampilkan seluruh jenis
 * sekaligus sebagai petak berikon, jadi setiap tipe wajib punya ikon — kalau
 * tidak, petaknya kosong tanpa penanda.
 */
describe('ikon jenis soal', () => {
  it('setiap jenis soal punya ikon petak', () => {
    const nilai = Object.values(TIPE)

    expect(DAFTAR_TIPE.map((baris) => baris.nilai)).toEqual(nilai)

    for (const tipe of nilai) {
      expect(typeof IKON_TIPE[tipe], `ikon ${tipe} belum ada`).toBe('function')
      expect(ikonTipe(tipe)).toBe(IKON_TIPE[tipe])
    }
  })

  it('tipe yang belum dikenal tidak melempar', () => {
    expect(ikonTipe('tipe_karangan')).toBeUndefined()
  })

  it('setiap ikon ter-render sebagai <svg> viewBox 24 dengan currentColor', () => {
    for (const baris of DAFTAR_TIPE) {
      const Ikon = baris.ikon

      if (Ikon === undefined) throw new Error(`ikon ${baris.nilai} tidak ada`)

      const html = renderToStaticMarkup(<Ikon size={22} />)

      expect(html, `ikon ${baris.nilai}`).toContain('<svg')
      expect(html, `ikon ${baris.nilai}`).toContain('viewBox="0 0 24 24"')
      expect(html, `ikon ${baris.nilai}`).toContain('stroke="currentColor"')
    }
  })
})
