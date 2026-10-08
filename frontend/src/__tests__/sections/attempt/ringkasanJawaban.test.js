import { describe, expect, it } from 'vitest'
import { adaJawaban, hitungTerjawab } from '../../../sections/attempt/ringkasanJawaban.js'

describe('adaJawaban', () => {
  // Q-19: isian singkat yang diketik lalu dihapus menyisakan "" dan dulu tetap
  // terhitung terjawab.
  it('tidak menghitung string kosong atau hanya spasi', () => {
    expect(adaJawaban('')).toBe(false)
    expect(adaJawaban('   ')).toBe(false)
    expect(adaJawaban('Jakarta')).toBe(true)
  })

  it('tidak menghitung nilai yang belum ada', () => {
    expect(adaJawaban(undefined)).toBe(false)
    expect(adaJawaban(null)).toBe(false)
  })

  it('tidak menghitung daftar atau peta kosong', () => {
    expect(adaJawaban([])).toBe(false)
    expect(adaJawaban({})).toBe(false)
    expect(adaJawaban(['a'])).toBe(true)
    expect(adaJawaban({ k1: 'n1' })).toBe(true)
  })

  it('menghitung angka dan boolean sebagai pilihan sah', () => {
    expect(adaJawaban(0)).toBe(true)
    expect(adaJawaban(false)).toBe(true)
    expect(adaJawaban(true)).toBe(true)
  })
})

describe('hitungTerjawab', () => {
  it('hanya menghitung soal yang benar-benar berisi', () => {
    const soal = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    const jawaban = { 1: 'Jakarta', 2: '', 3: ['a', 'b'], 4: undefined }

    expect(hitungTerjawab(soal, jawaban)).toBe(2)
  })

  it('mengembalikan 0 bila belum ada jawaban', () => {
    expect(hitungTerjawab([{ id: 1 }], {})).toBe(0)
  })
})
