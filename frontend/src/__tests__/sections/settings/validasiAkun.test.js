/**
 * Skema form akun adalah cermin aturan server (`PerbaruiAkunRequest`,
 * `GantiSandiRequest`). Tes ini menjaga agar aturan itu tidak berbeda: isian yang
 * lolos di sini harus diterima server, dan yang ditahan di sini pasti ditolak 422
 * di sana — bedanya apa pun membuat murid melihat "gagal menyimpan" tanpa tahu
 * apa yang salah.
 */
import { describe, expect, it } from 'vitest'
import { skemaAkunNama, skemaAkunSandi } from '../../../sections/settings/validasiAkun.js'

describe('skemaAkunNama', () => {
  it('menerima nama 2–60 huruf dan memangkas spasinya', () => {
    expect(skemaAkunNama.parse({ name: '  Bu Rina  ' }).name).toBe('Bu Rina')
  })

  it('menolak nama kosong dan nama terlalu panjang', () => {
    expect(skemaAkunNama.safeParse({ name: '   ' }).success).toBe(false)
    expect(skemaAkunNama.safeParse({ name: 'a' }).success).toBe(false)
    expect(skemaAkunNama.safeParse({ name: 'a'.repeat(61) }).success).toBe(false)
  })
})

describe('skemaAkunSandi', () => {
  const benar = {
    sandi_sekarang: 'sandi-lama-aman-10',
    password: 'sandi-baru-aman-10',
    konfirmasi: 'sandi-baru-aman-10',
  }

  it('menerima sandi baru yang cocok', () => {
    expect(skemaAkunSandi.safeParse(benar).success).toBe(true)
  })

  it('mewajibkan sandi sekarang', () => {
    const hasil = skemaAkunSandi.safeParse({ ...benar, sandi_sekarang: '   ' })

    expect(hasil.success).toBe(false)
    expect(hasil.error?.issues[0]?.message).toBe('Isi kata sandi yang sekarang.')
  })

  it('menahan sandi baru di bawah 10 karakter', () => {
    const hasil = skemaAkunSandi.safeParse({ ...benar, password: 'pendek-9x', konfirmasi: 'pendek-9x' })

    expect(hasil.success).toBe(false)
    expect(hasil.error?.issues[0]?.message).toBe('Kata sandi minimal 10 karakter.')
  })

  it('menandai konfirmasi yang tidak sama pada bidang konfirmasinya', () => {
    const hasil = skemaAkunSandi.safeParse({ ...benar, konfirmasi: 'sandi-baru-beda-10' })

    expect(hasil.success).toBe(false)
    expect(hasil.error?.issues[0]?.path).toEqual(['konfirmasi'])
    expect(hasil.error?.issues[0]?.message).toBe('Kata sandi baru belum sama.')
  })

  it('tidak menilai bentuk sandi lama — hanya server yang bisa mencocokkannya', () => {
    // Sandi lama yang sah bisa pendek bila dibuat sebelum aturan 10 karakter;
    // menahannya di klien justru mengunci murid dari akunnya sendiri.
    expect(skemaAkunSandi.safeParse({ ...benar, sandi_sekarang: 'x' }).success).toBe(true)
  })
})
