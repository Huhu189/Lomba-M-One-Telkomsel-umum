import { describe, expect, it } from 'vitest'
import { sapaanWaktu } from './Beranda.jsx'
import { inisial } from '../../shared/layout/KerangkaUmum.jsx'

describe('sapaanWaktu', () => {
  it('menyesuaikan dengan jam', () => {
    expect(sapaanWaktu(new Date(2026, 9, 6, 7))).toBe('Selamat pagi')
    expect(sapaanWaktu(new Date(2026, 9, 6, 12))).toBe('Selamat siang')
    expect(sapaanWaktu(new Date(2026, 9, 6, 16))).toBe('Selamat sore')
    expect(sapaanWaktu(new Date(2026, 9, 6, 21))).toBe('Selamat malam')
  })
})

describe('inisial', () => {
  it('maksimal dua huruf, huruf besar', () => {
    expect(inisial('rina aulia putri')).toBe('RA')
    expect(inisial('Budi')).toBe('B')
    expect(inisial('   ')).toBe('?')
  })
})
