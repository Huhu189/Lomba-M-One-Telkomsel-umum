import { describe, expect, it } from 'vitest'
import { jawabanTeks, kelasStatus, ringkasKunci } from '../../../sections/scoring/tampilan.js'

describe('jawabanTeks', () => {
  it('menandai jawaban yang belum dijawab atau hanya berisi spasi', () => {
    expect(jawabanTeks(null)).toBe('(belum dijawab)')
    expect(jawabanTeks(undefined)).toBe('(belum dijawab)')
    expect(jawabanTeks('   ')).toBe('(kosong)')
  })

  it('menampilkan boolean, angka, dan teks apa adanya', () => {
    expect(jawabanTeks(true)).toBe('Benar')
    expect(jawabanTeks(false)).toBe('Salah')
    expect(jawabanTeks(9)).toBe('9')
    expect(jawabanTeks('sembilan')).toBe('sembilan')
  })

  it('meringkas daftar dan peta jawaban bertingkat', () => {
    expect(jawabanTeks(['I2', 'I1'])).toBe('I2, I1')
    expect(jawabanTeks({ K1: 'N2', K2: 'N1' })).toBe('K1 → N2, K2 → N1')
    expect(jawabanTeks({ K1: null })).toBe('K1 → (belum dijawab)')
  })
})

describe('ringkasKunci', () => {
  it('menggabungkan bidang kunci menjadi satu baris', () => {
    expect(ringkasKunci({ jawaban: 'B' })).toBe('jawaban: B')
    expect(ringkasKunci({ pasangan: { K1: 'N1' } })).toBe('pasangan: K1 → N1')
    expect(ringkasKunci({ jawaban_baku: ['9'], ambang: 0.8 })).toBe('jawaban_baku: 9 · ambang: 0.8')
  })

  it('memberi tanda pisah untuk kunci kosong atau bukan objek', () => {
    expect(ringkasKunci({})).toBe('—')
    expect(ringkasKunci(null)).toBe('—')
    expect(ringkasKunci(['a'])).toBe('—')
  })
})

describe('kelasStatus', () => {
  it('memetakan status antrean ke kelas lencana', () => {
    expect(kelasStatus('perlu_tinjau')).toBe('badge-status peringatan')
    expect(kelasStatus('gagal')).toBe('badge-status salah')
    expect(kelasStatus('dinilai')).toBe('badge-status lembut')
    expect(kelasStatus('')).toBe('badge-status lembut')
  })
})
