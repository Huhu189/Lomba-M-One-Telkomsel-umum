// @vitest-environment jsdom
/**
 * Tes riwayat jawaban lokal (sistem luring).
 *
 * Yang dijaga: validasi sebelum menulis ke perangkat, ringkasan yang bisa
 * dibaca murid, penandaan "terkirim", penghapusan saat submit/sesi berakhir, dan
 * data localStorage yang rusak TIDAK dipakai (validasi Zod).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  BATAS_ENTRI,
  BATAS_PAYLOAD,
  KUNCI_SIMPANAN,
  STATUS_LOKAL,
  STATUS_TERKIRIM,
  amanDicatat,
  formatWaktuRiwayat,
  rapikanRiwayat,
  ringkasNilai,
  sisipkanEntri,
  useRiwayatJawaban,
} from '../../../sections/attempt/riwayatJawaban.js'

/**
 * Baris riwayat contoh.
 * @param {number} soalId
 * @param {Partial<import('../../../sections/attempt/riwayatJawaban.js').EntriRiwayat>} [ubah]
 * @returns {import('../../../sections/attempt/riwayatJawaban.js').EntriRiwayat}
 */
const entri = (soalId, ubah = {}) => ({
  soal_id: soalId,
  nomor: soalId,
  tipe: 'pilihan_ganda',
  ringkas: 'B',
  at: 1000,
  server_at: '2026-10-06T03:00:00.000Z',
  status: STATUS_LOKAL,
  ...ubah,
})

beforeEach(() => {
  localStorage.clear()
  useRiwayatJawaban.setState({ aktif: true, perAttempt: {} })
})

describe('ringkasNilai', () => {
  it('menampilkan teks, angka, dan boolean apa adanya', () => {
    expect(ringkasNilai('15')).toBe('15')
    expect(ringkasNilai(42)).toBe('42')
    expect(ringkasNilai(true)).toBe('benar')
    expect(ringkasNilai(false)).toBe('salah')
  })

  it('menandai jawaban kosong sebagai dikosongkan', () => {
    expect(ringkasNilai('')).toBe('dikosongkan')
    expect(ringkasNilai('   ')).toBe('dikosongkan')
    expect(ringkasNilai(null)).toBe('dikosongkan')
    expect(ringkasNilai(undefined)).toBe('dikosongkan')
    expect(ringkasNilai([])).toBe('dikosongkan')
    expect(ringkasNilai({})).toBe('dikosongkan')
  })

  it('meringkas daftar dan peta sesuai bentuk soal', () => {
    expect(ringkasNilai(['B', 'A', 'C'])).toBe('B → A → C')
    expect(ringkasNilai([['a', 'b'], ['c', 'd']])).toBe('2 baris terisi')
    expect(ringkasNilai(['x', ['y']])).toBe('2 pilihan tersusun')
    expect(ringkasNilai({ 1: 'kucing', 2: 'anjing' })).toBe('2 isian: kucing, anjing')
  })

  it('memotong ringkasan yang kepanjangan', () => {
    const panjang = 'a'.repeat(200)
    const hasil = ringkasNilai(panjang)

    expect(hasil.length).toBeLessThanOrEqual(80)
    expect(hasil.endsWith('…')).toBe(true)
  })
})

describe('amanDicatat', () => {
  it('menerima bentuk jawaban yang wajar', () => {
    expect(amanDicatat('B')).toBe(true)
    expect(amanDicatat(0)).toBe(true)
    expect(amanDicatat(false)).toBe(true)
    expect(amanDicatat(['B', 'A'])).toBe(true)
    expect(amanDicatat({ 1: 'kucing' })).toBe(true)
    // undefined = soal dikosongkan; tetap sah untuk tidak dicatat.
    expect(amanDicatat(undefined)).toBe(true)
  })

  it('menolak nilai yang tidak bisa dibaca kembali dari penyimpanan', () => {
    expect(amanDicatat(() => 'x')).toBe(false)
    expect(amanDicatat(Number.NaN)).toBe(false)
    expect(amanDicatat(Number.POSITIVE_INFINITY)).toBe(false)
    expect(amanDicatat({ a: Number.NaN })).toBe(false)
  })

  it('menolak nilai yang melebihi kuota penyimpanan perangkat', () => {
    // Ukuran dihitung dari bentuk JSON-nya (string dapat tambahan dua tanda kutip).
    expect(amanDicatat('a'.repeat(BATAS_PAYLOAD - 2))).toBe(true)
    expect(amanDicatat('a'.repeat(BATAS_PAYLOAD + 1))).toBe(false)
  })
})

describe('sisipkanEntri', () => {
  it('satu soal hanya punya satu baris — yang baru menimpa yang lama', () => {
    const hasil = sisipkanEntri([entri(7), entri(8)], entri(7, { ringkas: 'C', at: 2000 }))

    expect(hasil).toHaveLength(2)
    expect(hasil[1].ringkas).toBe('C')
  })

  it('memangkas dari yang paling lama', () => {
    const daftar = Array.from({ length: BATAS_ENTRI }, (_, i) => entri(i + 1))
    const hasil = sisipkanEntri(daftar, entri(999))

    expect(hasil).toHaveLength(BATAS_ENTRI)
    expect(hasil[0].soal_id).toBe(2)
    expect(hasil.at(-1)?.soal_id).toBe(999)
  })
})

describe('rapikanRiwayat', () => {
  it('membuang attempt yang kedaluwarsa dan menyisakan yang paling baru', () => {
    const sekarang = 10_000_000
    const isi = {
      1: { entri: [entri(1)], disimpanAt: sekarang - 8 * 24 * 60 * 60 * 1000 },
      2: { entri: [entri(2)], disimpanAt: sekarang - 1000 },
      3: { entri: [entri(3)], disimpanAt: sekarang - 500 },
    }

    const hasil = rapikanRiwayat(isi, sekarang)

    expect(Object.keys(hasil)).toEqual(['2', '3'])
  })
})

describe('formatWaktuRiwayat', () => {
  it('menampilkan jam:menit:detik menurut jam server', () => {
    expect(formatWaktuRiwayat(new Date(2026, 9, 6, 7, 5, 9).toISOString())).toBe('07:05:09')
  })

  it('aman saat cap waktu tidak terbaca', () => {
    expect(formatWaktuRiwayat('bukan-tanggal')).toBe('—')
  })
})

describe('store riwayat jawaban', () => {
  it('mencatat jawaban, menandainya terkirim, lalu menghitung yang menunggu', () => {
    const store = useRiwayatJawaban.getState()

    expect(
      store.catat(7, {
        soal_id: 21,
        nomor: 1,
        tipe: 'pilihan_ganda',
        jawaban: 'B',
        server_at: '2026-10-06T03:00:00.000Z',
      }),
    ).toBe(true)

    expect(store.ambil(7)).toHaveLength(1)
    expect(store.ambil(7)[0].ringkas).toBe('B')
    expect(store.ambil(7)[0].status).toBe(STATUS_LOKAL)
    expect(store.tertunda(7)).toBe(1)

    store.tandaiTerkirim(7, 21)

    expect(useRiwayatJawaban.getState().ambil(7)[0].status).toBe(STATUS_TERKIRIM)
    expect(useRiwayatJawaban.getState().tertunda(7)).toBe(0)
  })

  it('menolak nilai yang tidak layak dan tidak menulis apa pun ke perangkat', () => {
    const store = useRiwayatJawaban.getState()

    expect(
      store.catat(7, {
        soal_id: 21,
        nomor: 1,
        tipe: 'uraian',
        jawaban: () => 'x',
        server_at: '2026-10-06T03:00:00.000Z',
      }),
    ).toBe(false)

    expect(useRiwayatJawaban.getState().ambil(7)).toEqual([])
    expect(localStorage.getItem(KUNCI_SIMPANAN) ?? '').not.toContain('"21"')
  })

  it('tidak mencatat apa pun saat riwayat lokal dimatikan', () => {
    useRiwayatJawaban.getState().nyalakan(false)

    expect(
      useRiwayatJawaban.getState().catat(7, {
        soal_id: 21,
        nomor: 1,
        tipe: 'pilihan_ganda',
        jawaban: 'B',
        server_at: '2026-10-06T03:00:00.000Z',
      }),
    ).toBe(false)
    expect(useRiwayatJawaban.getState().aktif).toBe(false)
    expect(useRiwayatJawaban.getState().ambil(7)).toEqual([])
  })

  it('menyimpan hasil ke localStorage sehingga bertahan muat ulang', () => {
    useRiwayatJawaban.getState().catat(7, {
      soal_id: 21,
      nomor: 1,
      tipe: 'pilihan_ganda',
      jawaban: 'B',
      server_at: '2026-10-06T03:00:00.000Z',
    })

    const tersimpan = JSON.parse(localStorage.getItem(KUNCI_SIMPANAN) ?? '{}')

    expect(tersimpan.state.perAttempt['7'].entri[0].soal_id).toBe(21)
  })

  it('menghapus riwayat satu attempt setelah submit, dan semuanya saat keluar', () => {
    const store = useRiwayatJawaban.getState()

    store.catat(7, {
      soal_id: 21,
      nomor: 1,
      tipe: 'pilihan_ganda',
      jawaban: 'B',
      server_at: '2026-10-06T03:00:00.000Z',
    })
    store.bersihkan(7)

    expect(useRiwayatJawaban.getState().ambil(7)).toEqual([])

    useRiwayatJawaban.getState().catat(8, {
      soal_id: 22,
      nomor: 2,
      tipe: 'pilihan_ganda',
      jawaban: 'A',
      server_at: '2026-10-06T03:00:00.000Z',
    })
    useRiwayatJawaban.getState().bersihkanSemua()

    expect(useRiwayatJawaban.getState().perAttempt).toEqual({})
  })

  it('mengabaikan isi localStorage yang rusak (validasi Zod)', async () => {
    localStorage.setItem(
      KUNCI_SIMPANAN,
      JSON.stringify({
        state: { aktif: true, perAttempt: { 7: { entri: [{ soal_id: 'bukan angka' }], disimpanAt: 1 } } },
        version: 1,
      }),
    )

    const denganPersist = /** @type {typeof useRiwayatJawaban & { persist: { rehydrate: () => Promise<void> } }} */ (
      useRiwayatJawaban
    )

    await denganPersist.persist.rehydrate()

    expect(useRiwayatJawaban.getState().perAttempt).toEqual({})
  })
})
