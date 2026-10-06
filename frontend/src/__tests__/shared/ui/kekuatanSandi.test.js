import { describe, expect, it } from 'vitest'
import { nilaiKekuatanSandi } from '../../../shared/ui/kekuatanSandi.js'

describe('nilaiKekuatanSandi', () => {
  it('kosong → tingkat 0 tanpa label', () => {
    const hasil = nilaiKekuatanSandi('')
    expect(hasil.tingkat).toBe(0)
    expect(hasil.label).toBe('')
    expect(hasil.cukup).toBe(false)
  })

  it('kurang dari 10 karakter → belum cukup, saran menyebut sisa karakter', () => {
    const hasil = nilaiKekuatanSandi('abc123')
    expect(hasil.cukup).toBe(false)
    expect(hasil.label).toBe('Belum cukup')
    expect(hasil.saran).toContain('4')
  })

  it('tepat 10 karakter huruf kecil saja → cukup tetapi hanya tingkat 2', () => {
    const hasil = nilaiKekuatanSandi('abcdefghij')
    expect(hasil.cukup).toBe(true)
    expect(hasil.tingkat).toBe(2)
  })

  it('sandi berulang tidak dianggap kuat meski panjang', () => {
    const hasil = nilaiKekuatanSandi('aaaaaaaaaaaaaaaaaaaa')
    expect(hasil.tingkat).toBe(1)
    expect(hasil.label).toBe('Lemah')
  })

  it('panjang + beragam → sangat kuat', () => {
    const hasil = nilaiKekuatanSandi('Sandi-Kuat-123!')
    expect(hasil.tingkat).toBe(4)
    expect(hasil.cukup).toBe(true)
  })

  it('konsisten dengan aturan resmi: cukup ⇔ minimal 10 karakter', () => {
    for (const s of ['a', 'abcdefghi', 'abcdefghij', 'Abcdefghij1!']) {
      expect(nilaiKekuatanSandi(s).cukup).toBe(s.length >= 10)
    }
  })
})
