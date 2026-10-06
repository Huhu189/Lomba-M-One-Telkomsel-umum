import { describe, expect, it } from 'vitest'
import { skemaKelasForm, skemaMapelForm, skemaMuridForm } from '../../../sections/school/validasi.js'

describe('skemaKelasForm', () => {
  it('menerima kelas valid', () => {
    const hasil = skemaKelasForm.safeParse({ nama: '6A', tingkat: '6', tahun_ajaran: '2026/2027' })
    expect(hasil.success).toBe(true)
  })

  it('menolak tingkat di luar 1-6', () => {
    expect(skemaKelasForm.safeParse({ nama: '6A', tingkat: '7' }).success).toBe(false)
    expect(skemaKelasForm.safeParse({ nama: '6A', tingkat: '0' }).success).toBe(false)
    expect(skemaKelasForm.safeParse({ nama: '6A', tingkat: '' }).success).toBe(false)
  })

  it('menolak nama kosong', () => {
    expect(skemaKelasForm.safeParse({ nama: '   ', tingkat: '1' }).success).toBe(false)
  })
})

describe('skemaMuridForm', () => {
  it('menerima murid valid', () => {
    const hasil = skemaMuridForm.safeParse({ nama: 'Ayu Lestari', email: 'ayu@murid.test', class_id: '1' })
    expect(hasil.success).toBe(true)
  })

  it('menolak email salah dan kelas kosong sekaligus', () => {
    const hasil = skemaMuridForm.safeParse({ nama: 'Ayu', email: 'bukan-email', class_id: '' })
    expect(hasil.success).toBe(false)

    if (!hasil.success) {
      const jalur = hasil.error.issues.map((issue) => issue.path[0])
      expect(jalur).toContain('email')
      expect(jalur).toContain('class_id')
    }
  })
})

describe('skemaMapelForm', () => {
  it('menolak kode dengan karakter aneh', () => {
    expect(skemaMapelForm.safeParse({ nama: 'Matematika', kode: 'MT K!' }).success).toBe(false)
  })

  it('menerima kode kosong (opsional)', () => {
    expect(skemaMapelForm.safeParse({ nama: 'Matematika' }).success).toBe(true)
  })
})
