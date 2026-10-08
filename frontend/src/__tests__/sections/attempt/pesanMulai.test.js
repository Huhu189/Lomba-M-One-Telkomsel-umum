import { describe, expect, it } from 'vitest'
import { pesanMulaiGagal, retryMulai, statusGalatApi } from '../../../sections/attempt/pesanMulai.js'

describe('statusGalatApi', () => {
  it('membaca status respons dan undefined saat tidak ada respons', () => {
    expect(statusGalatApi({ response: { status: 422 } })).toBe(422)
    expect(statusGalatApi(new Error('offline'))).toBeUndefined()
  })
})

describe('pesanMulaiGagal', () => {
  it('meneruskan pesan aturan dari server tanpa menyarankan ulang', () => {
    const hasil = pesanMulaiGagal({ response: { status: 422, data: { message: 'Kuis belum dimulai.' } } })

    expect(hasil.pesan).toBe('Kuis belum dimulai.')
    expect(hasil.cobaLagi).toBe(false)
  })

  it('menyarankan coba lagi untuk galat jaringan dan 5xx', () => {
    expect(pesanMulaiGagal(new Error('offline')).cobaLagi).toBe(true)
    expect(pesanMulaiGagal({ response: { status: 503 } }).cobaLagi).toBe(true)
  })

  it('menandai 403 sebagai tanpa hak dan tidak bisa diulang', () => {
    const hasil = pesanMulaiGagal({ response: { status: 403, data: { message: 'Bukan untuk kelasmu.' } } })

    expect(hasil.judul).toContain('tidak berhak')
    expect(hasil.cobaLagi).toBe(false)
  })
})

describe('retryMulai', () => {
  it('tidak mengulang penolakan 4xx permanen', () => {
    expect(retryMulai(0, { response: { status: 422 } })).toBe(false)
    expect(retryMulai(0, { response: { status: 403 } })).toBe(false)
  })

  it('mengulang sekali untuk jaringan dan 5xx', () => {
    expect(retryMulai(0, new Error('offline'))).toBe(true)
    expect(retryMulai(0, { response: { status: 500 } })).toBe(true)
    expect(retryMulai(1, { response: { status: 500 } })).toBe(false)
  })
})
