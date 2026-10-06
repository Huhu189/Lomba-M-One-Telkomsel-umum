import { describe, expect, it, vi } from 'vitest'
import {
  BATAS_ANTREAN,
  BATAS_BERKELOMPOK,
  buatPengirimKejadian,
  COOLDOWN_MS,
  harusCobaLagi,
  rapikanAntrean,
  UMUR_ANTREAN_MS,
} from '../../security/pengirimKejadian.js'

/**
 * Penyimpanan tiruan ala localStorage.
 *
 * @returns {{ isi: Map<string, string>,
 *   baca: (kunci: string) => string | null,
 *   tulis: (kunci: string, nilai: string) => void,
 *   bersihkan: (kunci: string) => void }}
 */
function penyimpanan() {
  /** @type {Map<string, string>} */
  const isi = new Map()
  return {
    isi,
    baca: (kunci) => isi.get(kunci) ?? null,
    tulis: (kunci, nilai) => {
      isi.set(kunci, nilai)
    },
    bersihkan: (kunci) => {
      isi.delete(kunci)
    },
  }
}

describe('aturan retry pengiriman kejadian', () => {
  it('mengulang saat jaringan mati, 5xx, 408, dan 429; membuang pada 4xx lain', () => {
    expect(harusCobaLagi(new Error('jaringan mati'))).toBe(true)
    expect(harusCobaLagi({ response: { status: 500 } })).toBe(true)
    expect(harusCobaLagi({ response: { status: 503 } })).toBe(true)
    expect(harusCobaLagi({ response: { status: 408 } })).toBe(true)
    expect(harusCobaLagi({ response: { status: 429 } })).toBe(true)
    expect(harusCobaLagi({ response: { status: 403 } })).toBe(false)
    expect(harusCobaLagi({ response: { status: 422 } })).toBe(false)
  })
})

describe('antrean offline', () => {
  it('membuang entri kedaluwarsa dan menyisakan paling banyak 200', () => {
    const sekarang = Date.UTC(2026, 9, 6, 12, 0, 0)
    const kedaluwarsa = { client_at: new Date(sekarang - UMUR_ANTREAN_MS - 1000).toISOString() }
    const masihHidup = { client_at: new Date(sekarang - 1000).toISOString() }

    expect(rapikanAntrean([kedaluwarsa, masihHidup], sekarang)).toEqual([masihHidup])

    // Urutan antrean selalu kronologis (yang lama di depan), jadi yang
    // dipertahankan saat penuh adalah yang paling belakang.
    const jumlah = BATAS_ANTREAN + 25
    const banyak = Array.from({ length: jumlah }, (_, i) => ({
      client_at: new Date(sekarang - (jumlah - i) * 1000).toISOString(),
      nomor: i,
    }))

    const hasil = rapikanAntrean(banyak, sekarang)

    expect(hasil).toHaveLength(BATAS_ANTREAN)
    expect(hasil[0].nomor).toBe(25)
    expect(hasil[hasil.length - 1].nomor).toBe(jumlah - 1)
  })
})

describe('pengirim kejadian per attempt', () => {
  it('dedupe: kejadian sama dalam jendela cooldown hanya dicatat sekali', async () => {
    const simpan = penyimpanan()
    const kirim = vi.fn().mockResolvedValue({ tersimpan: 1 })

    let jam = 1000
    const pengirim = buatPengirimKejadian({
      attemptId: 5,
      kirim,
      jam: () => jam,
      ...simpan,
    })

    expect(pengirim.catat('paste_attempt')).toBe(true)
    // Masih dalam cooldown → ditolak dedupe.
    expect(pengirim.catat('paste_attempt')).toBe(false)

    jam += COOLDOWN_MS + 1
    expect(pengirim.catat('paste_attempt')).toBe(true)

    expect(pengirim.jumlahTertunda()).toBe(2)
  })

  it('mengirim berkelompok maksimal 50 dan mempertahankan sisanya saat gagal jaringan', async () => {
    const simpan = penyimpanan()

    /** @type {number[]} */
    const ukuranKelompok = []
    const kirim = vi.fn().mockImplementation(async (_attemptId, kejadian) => {
      ukuranKelompok.push(kejadian.length)

      if (ukuranKelompok.length === 2) {
        throw new Error('jaringan mati')
      }

      return { tersimpan: kejadian.length }
    })

    let jam = 0
    const pengirim = buatPengirimKejadian({ attemptId: 9, kirim, jam: () => (jam += 2000), ...simpan })

    for (let i = 0; i < 120; i += 1) {
      pengirim.catat('tab_switch', { ke: i })
    }

    const hasil = await pengirim.kirimSekarang()

    expect(ukuranKelompok[0]).toBe(BATAS_BERKELOMPOK)
    // Kelompok kedua gagal karena jaringan → sisanya menunggu, bukan hilang.
    expect(hasil.gagal).toBe(true)
    expect(hasil.terkirim).toBe(BATAS_BERKELOMPOK)
    expect(pengirim.jumlahTertunda()).toBe(120 - BATAS_BERKELOMPOK)
  })

  it('membuang kejadian yang ditolak permanen (4xx) supaya antrean tidak macet', async () => {
    const simpan = penyimpanan()
    const kirim = vi.fn().mockRejectedValue({ response: { status: 422 } })

    let jam = 0
    const pengirim = buatPengirimKejadian({ attemptId: 3, kirim, jam: () => (jam += 2000), ...simpan })

    pengirim.catat('window_blur')
    pengirim.catat('tab_switch')

    const hasil = await pengirim.kirimSekarang()

    expect(hasil.terkirim).toBe(0)
    expect(hasil.gagal).toBe(false)
    expect(pengirim.jumlahTertunda()).toBe(0)
  })

  it('meneruskan antrean yang belum terkirim dari sesi sebelumnya', async () => {
    const simpan = penyimpanan()
    const sekarang = Date.now()
    simpan.tulis(
      'kejadian-ulangan-4',
      JSON.stringify([{ kategori: 'tab_switch', client_at: new Date(sekarang - 500).toISOString() }]),
    )

    const kirim = vi.fn().mockResolvedValue({ tersimpan: 1 })
    const pengirim = buatPengirimKejadian({ attemptId: 4, kirim, jam: () => sekarang, ...simpan })

    expect(pengirim.jumlahTertunda()).toBe(1)

    await pengirim.kirimSekarang()

    expect(kirim).toHaveBeenCalledWith(4, [expect.objectContaining({ kategori: 'tab_switch' })])
    expect(pengirim.jumlahTertunda()).toBe(0)
  })

  it('data antrean yang rusak diabaikan, bukan membuat ulangan gagal', () => {
    const simpan = penyimpanan()
    simpan.tulis('kejadian-ulangan-8', '{bukan json')

    const pengirim = buatPengirimKejadian({
      attemptId: 8,
      kirim: vi.fn(),
      jam: () => Date.now(),
      ...simpan,
    })

    expect(pengirim.jumlahTertunda()).toBe(0)
    expect(simpan.isi.has('kejadian-ulangan-8')).toBe(false)
  })
})
