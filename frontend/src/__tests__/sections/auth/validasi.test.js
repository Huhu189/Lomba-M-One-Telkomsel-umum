import { describe, expect, it } from 'vitest'
import {
  skemaDaftar,
  skemaMasuk,
  skemaLupaSandi,
  skemaAturUlang,
  skemaKirimUlang,
} from '../../../sections/auth/validasi.js'

describe('skema validasi auth', () => {
  it('skemaMasuk menerima email + sandi valid', () => {
    expect(
      skemaMasuk.safeParse({ email: 'Rina@Sekolah.test', password: 'kata-sandi-aman-10' })
        .success,
    ).toBe(true)
  })

  it('skemaMasuk menolak sandi kurang dari 10 karakter', () => {
    const hasil = skemaMasuk.safeParse({ email: 'rina@sekolah.test', password: 'pendek' })
    expect(hasil.success).toBe(false)
  })

  it('skemaMasuk menolak email tanpa @', () => {
    const hasil = skemaMasuk.safeParse({ email: 'bukan-email', password: 'kata-sandi-aman-10' })
    expect(hasil.success).toBe(false)
  })

  it('skemaDaftar menolak konfirmasi sandi yang tidak sama', () => {
    const hasil = skemaDaftar.safeParse({
      name: 'Rina Siswa',
      email: 'rina@sekolah.test',
      password: 'kata-sandi-aman-10',
      konfirmasi: 'beda-10-karakter',
    })
    expect(hasil.success).toBe(false)
  })

  it('skemaDaftar menolak nama terlalu pendek', () => {
    const hasil = skemaDaftar.safeParse({
      name: 'R',
      email: 'rina@sekolah.test',
      password: 'kata-sandi-aman-10',
      konfirmasi: 'kata-sandi-aman-10',
    })
    expect(hasil.success).toBe(false)
  })

  it('skemaLupaSandi dan skemaKirimUlang menerima email valid', () => {
    expect(skemaLupaSandi.safeParse({ email: 'rina@sekolah.test' }).success).toBe(true)
    expect(skemaKirimUlang.safeParse({ email: 'rina@sekolah.test' }).success).toBe(true)
  })

  it('skemaAturUlang mewajibkan token dari tautan email', () => {
    const data = { email: 'rina@sekolah.test', password: 'kata-sandi-aman-10', konfirmasi: 'kata-sandi-aman-10' }
    expect(skemaAturUlang.safeParse({ ...data, token: '' }).success).toBe(false)
    expect(skemaAturUlang.safeParse({ ...data, token: 'abc123' }).success).toBe(true)
  })
})
