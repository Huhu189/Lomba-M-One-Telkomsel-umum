import { describe, expect, it } from 'vitest'
import {
  labelStatus,
  pesanKumpul,
  ringkasProgres,
  statusSoal,
} from '../../../sections/attempt/navigatorSoal.js'

describe('statusSoal', () => {
  it('memisahkan dijawab, ragu-ragu, dan belum dijawab', () => {
    expect(statusSoal({ terjawab: true, ragu: false })).toBe('dijawab')
    expect(statusSoal({ terjawab: false, ragu: false })).toBe('kosong')
    expect(statusSoal({ terjawab: true, ragu: true })).toBe('ragu')
  })

  it('ragu menang atas terjawab: soal yang diisi lalu ditandai tetap perlu ditinjau', () => {
    expect(statusSoal({ terjawab: true, ragu: true })).toBe('ragu')
  })

  it('setiap status punya label teks (status tidak hanya warna)', () => {
    expect(labelStatus('ragu')).toBe('ragu-ragu')
    expect(labelStatus('dijawab')).toBe('sudah dijawab')
    expect(labelStatus('kosong')).toBe('belum dijawab')
  })
})

describe('ringkasProgres', () => {
  const soal = [{ id: 11 }, { id: 12 }, { id: 13 }, { id: 14 }]

  it('menghitung terjawab, ragu, dan kosong', () => {
    const ringkas = ringkasProgres(soal, { 11: 'a', 13: 2 }, { 13: true })
    expect(ringkas).toEqual({
      total: 4,
      terjawab: 2,
      ragu: 1,
      kosong: 2,
      semuaTerjawab: false,
    })
  })

  it('nilai kosong/undefined/null tidak dihitung sebagai terjawab', () => {
    const ringkas = ringkasProgres(soal, { 11: '', 12: null, 13: '  ' }, {})
    expect(ringkas.terjawab).toBe(1)
    expect(ringkas.kosong).toBe(3)
  })

  it('semuaTerjawab benar hanya bila semua soal terisi', () => {
    expect(ringkasProgres(soal, { 11: 'a', 12: 'b', 13: 'c', 14: 'd' }, {}).semuaTerjawab).toBe(true)
    expect(ringkasProgres([], {}, {}).semuaTerjawab).toBe(false)
  })
})

describe('pesanKumpul', () => {
  it('menyebut soal yang belum selesai bila masih ada', () => {
    expect(pesanKumpul({ ragu: 0, kosong: 2 })).toContain('belum selesai')
    expect(pesanKumpul({ ragu: 1, kosong: 0 })).toContain('belum selesai')
  })

  it('memberi pesan berbeda saat semua sudah dijawab', () => {
    expect(pesanKumpul({ ragu: 0, kosong: 0 })).toContain('Semua soal sudah dijawab')
  })

  it('selalu menyebut jawaban tidak bisa diubah lagi', () => {
    expect(pesanKumpul({ ragu: 2, kosong: 3 })).toContain('tidak bisa diubah')
    expect(pesanKumpul({ ragu: 0, kosong: 0 })).toContain('tidak bisa diubah')
  })
})
