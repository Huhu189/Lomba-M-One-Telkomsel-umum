/**
 * Skema respon atur-ulang sandi (token sekali pakai).
 *
 * Backend menandai `tautan_dipakai: true` bila tautan yang dikirim sudah pernah
 * dipakai — UI memakainya untuk menampilkan halaman "tautan sudah pernah
 * dipakai" alih-alih formulir yang pasti gagal lagi.
 */
import { describe, expect, it } from 'vitest'
import { skemaResponAturUlang } from '../../../sections/auth/api.js'

describe('skemaResponAturUlang', () => {
  it('mem-parse respon sukses (tanpa penanda) dengan bawaan false', () => {
    const hasil = skemaResponAturUlang.parse({
      message: 'Kata sandi berhasil diganti. Silakan masuk.',
    })

    expect(hasil.message).toContain('berhasil diganti')
    expect(hasil.tautan_dipakai).toBe(false)
  })

  it('mem-parse penanda tautan sudah dipakai', () => {
    const hasil = skemaResponAturUlang.parse({
      message: 'Tautan tidak valid atau sudah pernah dipakai.',
      tautan_dipakai: true,
    })

    expect(hasil.tautan_dipakai).toBe(true)
  })

  it('menolak respon tanpa pesan', () => {
    expect(() => skemaResponAturUlang.parse({})).toThrow()
  })
})
