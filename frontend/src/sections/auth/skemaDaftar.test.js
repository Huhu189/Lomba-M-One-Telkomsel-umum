/**
 * Kontrak respons backend untuk pendaftaran & kirim ulang verifikasi.
 * Skema ini yang menjaga frontend tetap sinkron saat server berubah.
 */
import { describe, expect, it } from 'vitest'
import { skemaResponsDaftar, skemaResponsKirimUlang } from './api.js'

const user = {
  id: 7,
  name: 'Rina Aulia',
  email: 'rina@murid.test',
  role: 'murid',
  status: 'pending',
  statusLabel: 'Menunggu verifikasi',
  emailTerverifikasi: false,
}

describe('skemaResponsDaftar', () => {
  it('menerima respons auto-login lengkap (murid langsung masuk)', () => {
    const hasil = skemaResponsDaftar.parse({
      message: 'Akun dibuat.',
      user,
      perlu_verifikasi: true,
      email_terkirim: true,
    })

    expect(hasil.user.email).toBe('rina@murid.test')
    expect(hasil.perlu_verifikasi).toBe(true)
    expect(hasil.email_terkirim).toBe(true)
  })

  it('menerima email_terkirim false (layanan email mati, akun tetap jadi)', () => {
    const hasil = skemaResponsDaftar.parse({
      message: 'Akun dibuat.',
      user,
      perlu_verifikasi: true,
      email_terkirim: false,
    })

    expect(hasil.email_terkirim).toBe(false)
  })

  it('menolak respons lama tanpa data user (kontrak harus diperbarui)', () => {
    expect(() => skemaResponsDaftar.parse({ message: 'Jika email belum terdaftar…' })).toThrow()
  })
})

describe('skemaResponsKirimUlang', () => {
  it('membaca status kirim untuk akun yang sudah masuk', () => {
    expect(skemaResponsKirimUlang.parse({ message: 'Terkirim.', email_terkirim: false }).email_terkirim)
      .toBe(false)
  })

  it('menolak respons tanpa penanda email_terkirim', () => {
    expect(() => skemaResponsKirimUlang.parse({ message: 'Terkirim.' })).toThrow()
  })
})
