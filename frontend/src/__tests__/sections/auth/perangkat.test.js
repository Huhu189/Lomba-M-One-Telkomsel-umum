// @vitest-environment jsdom
/**
 * Kode perangkat siswa tamu (T1/T2).
 *
 * Identitas tamu tidak boleh diturunkan dari nama: dua anak bernama sama akan
 * berbagi akun, dan siapa pun yang mengetik nama itu bisa melanjutkan pekerjaan
 * anak lain. Yang dijaga di sini adalah kontraknya: kode dibuat sekali per
 * perangkat, dikirim saat masuk, dan versi server yang selalu disimpan.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KUNCI_PERANGKAT, kodePerangkat, simpanKodePerangkat } from '../../../sections/auth/perangkat.js'

vi.mock('../../../shared/api/client.js', () => ({
  client: { post: vi.fn(), get: vi.fn() },
  ambilCsrfCookie: vi.fn(async () => undefined),
}))

const { client } = await import('../../../shared/api/client.js')
const { masukTamu } = await import('../../../sections/auth/api.js')

const kirim = /** @type {import('vitest').Mock} */ (client.post)

/**
 * Respons server yang sah untuk masuk tamu.
 *
 * @param {string} kode
 * @param {string} [nama]
 */
function responsTamu(kode, nama = 'Rara') {
  return {
    data: {
      message: 'Kamu masuk sebagai siswa tamu di perangkat ini.',
      kode_perangkat: kode,
      user: {
        id: 9,
        name: nama,
        email: 'tamu+abc@tamu.invalid',
        role: 'murid',
        status: 'aktif',
        statusLabel: 'Aktif',
        emailTerverifikasi: true,
        isTamu: true,
      },
    },
  }
}

beforeEach(() => {
  window.localStorage.clear()
  kirim.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('kode perangkat', () => {
  it('dibuat sekali lalu dipakai ulang di perangkat yang sama', () => {
    const pertama = kodePerangkat()
    const kedua = kodePerangkat()

    expect(pertama.length).toBeGreaterThanOrEqual(8)
    expect(kedua).toBe(pertama)
    expect(window.localStorage.getItem(KUNCI_PERANGKAT)).toBe(pertama)
  })

  it('tetap menghasilkan kode walau penyimpanan diblokir (ulangan tidak boleh gagal)', () => {
    const simpan = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('penyimpanan diblokir')
    })

    expect(() => kodePerangkat()).not.toThrow()
    expect(kodePerangkat().length).toBeGreaterThanOrEqual(8)

    simpan.mockRestore()
  })

  it('mengabaikan kode yang jelas tidak sah', () => {
    simpanKodePerangkat('pendek')
    simpanKodePerangkat(12)

    expect(window.localStorage.getItem(KUNCI_PERANGKAT)).toBeNull()
  })
})

describe('masuk sebagai tamu', () => {
  it('mengirim kode perangkat dan menyimpan kode dari server', async () => {
    kirim.mockResolvedValue(responsTamu('perangkat-server-0001'))

    const user = await masukTamu('Rara')

    expect(user.id).toBe(9)
    expect(kirim).toHaveBeenCalledTimes(1)
    expect(kirim.mock.calls[0][0]).toBe('/v1/auth/tamu')
    expect(kirim.mock.calls[0][1].nama).toBe('Rara')
    // Kode yang dikirim klien selalu berbentuk sah untuk server.
    expect(kirim.mock.calls[0][1].kode_perangkat).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)

    // Yang disimpan adalah kode dari server (bisa berbeda bila klien belum punya).
    expect(window.localStorage.getItem(KUNCI_PERANGKAT)).toBe('perangkat-server-0001')

    // Masuk berikutnya dari perangkat ini memakai kode yang sama.
    kirim.mockResolvedValue(responsTamu('perangkat-server-0001'))

    await masukTamu('Rara Sari')

    expect(kirim.mock.calls[1][1].kode_perangkat).toBe('perangkat-server-0001')
  })

  it('menolak respons tanpa kode perangkat, bukan diam-diam kehilangan identitas', async () => {
    kirim.mockResolvedValue({ data: { message: 'ok', user: responsTamu('x'.repeat(10)).data.user } })

    await expect(masukTamu('Rara')).rejects.toThrow()
  })
})
