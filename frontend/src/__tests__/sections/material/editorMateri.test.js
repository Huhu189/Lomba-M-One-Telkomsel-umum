/**
 * Tes helper murni editor materi (NLE). Yang dijaga: bentuk klip, muatan yang
 * dikirim ke server (termasuk penempatan timeline), urutan klip, susunan track,
 * klip aktif pada waktu tertentu, dan template yang memang masih kosong.
 */
import { describe, expect, it } from 'vitest'
import {
  DURASI_BAWAAN,
  JUMLAH_TRACK,
  TEMPLATE_MATERI,
  adaTemplate,
  blokBaru,
  ciriKlip,
  dariServer,
  durasiTotal,
  formatWaktu,
  klipPada,
  muatanBlok,
  pindahBlok,
  setMulai,
  sisipBlok,
  susunTrack,
  trackMaksimal,
} from '../../../sections/material/editorMateri.js'

/**
 * @param {import('../../../sections/material/editorMateri.js').TipeBlok} tipe
 * @param {Partial<import('../../../sections/material/editorMateri.js').BarisBlok>} [ubah]
 * @returns {import('../../../sections/material/editorMateri.js').BarisBlok}
 */
function klip(tipe, ubah = {}) {
  return { ...blokBaru(tipe), ...ubah }
}

describe('klip', () => {
  it('membuat klip baru dengan bawaan timeline', () => {
    expect(blokBaru('media')).toEqual({
      tipe: 'media',
      wajib: true,
      teks: '',
      keterangan: '',
      unggahan_kode: '',
      quiz_id: '',
      track: 0,
      mulai_detik: 0,
      durasi_detik: DURASI_BAWAAN,
    })
  })

  it('memetakan blok server ke klip dan tahan field hilang', () => {
    const hasil = dariServer([
      { tipe: 'teks', wajib: false, teks: 'Halo', track: 2, mulai_detik: 5, durasi_detik: 7 },
      { tipe: 'kuis', wajib: true, quiz_id: 12 },
      {},
    ])

    expect(hasil).toEqual([
      { tipe: 'teks', wajib: false, teks: 'Halo', keterangan: '', unggahan_kode: '', quiz_id: '', track: 2, mulai_detik: 5, durasi_detik: 7 },
      { tipe: 'kuis', wajib: true, teks: '', keterangan: '', unggahan_kode: '', quiz_id: 12, track: 0, mulai_detik: DURASI_BAWAAN, durasi_detik: DURASI_BAWAAN },
      { tipe: 'teks', wajib: false, teks: '', keterangan: '', unggahan_kode: '', quiz_id: '', track: 0, mulai_detik: 2 * DURASI_BAWAAN, durasi_detik: DURASI_BAWAAN },
    ])

    expect(dariServer(undefined)).toEqual([])
  })
})

describe('muatan ke server', () => {
  it('mengemas isi sesuai tipe dan menyertakan penempatan timeline', () => {
    const muatan = muatanBlok([
      klip('teks', { teks: 'Penjelasan', track: 1, mulai_detik: 3.5, durasi_detik: 8 }),
      klip('media', { keterangan: 'Peta', unggahan_kode: 'abc' }),
      klip('kuis', { quiz_id: '9', track: 2, mulai_detik: 2 }),
    ])

    expect(muatan).toEqual([
      { tipe: 'teks', wajib: true, isi: { teks: 'Penjelasan' }, quiz_id: null, track: 1, mulai_detik: 3.5, durasi_detik: 8 },
      { tipe: 'media', wajib: true, isi: { unggahan_kode: 'abc', keterangan: 'Peta' }, quiz_id: null, track: 0, mulai_detik: 0, durasi_detik: DURASI_BAWAAN },
      { tipe: 'kuis', wajib: true, isi: undefined, quiz_id: 9, track: 2, mulai_detik: 2, durasi_detik: DURASI_BAWAAN },
    ])
  })
})

describe('urutan klip', () => {
  const blok = [klip('teks', { teks: 'a' }), klip('media', { teks: 'b' }), klip('kuis', { teks: 'c' })]

  it('memindahkan klip ke posisi lain dan mengembalikan larik baru', () => {
    const hasil = pindahBlok(blok, 0, 2)
    expect(hasil.map((satu) => satu.teks)).toEqual(['b', 'c', 'a'])
    expect(blok.map((satu) => satu.teks)).toEqual(['a', 'b', 'c'])
  })

  it('mengembalikan larik apa adanya bila tujuan tidak sah', () => {
    expect(pindahBlok(blok, 0, 0)).toBe(blok)
    expect(pindahBlok(blok, -1, 2)).toBe(blok)
    expect(pindahBlok(blok, 0, 5)).toBe(blok)
  })

  it('menyisipkan klip di akhir atau posisi tertentu dan melaporkan indeksnya', () => {
    const akhir = sisipBlok(blok, blokBaru('teks'))
    expect(akhir.indeks).toBe(3)
    expect(akhir.blok).toHaveLength(4)

    const tengah = sisipBlok(blok, blokBaru('kuis'), 1)
    expect(tengah.indeks).toBe(1)
    expect(tengah.blok.map((satu) => satu.tipe)).toEqual(['teks', 'kuis', 'media', 'kuis'])
  })
})

describe('timeline', () => {
  it('menyusun klip per track dan selalu menampilkan track dasar', () => {
    const blok = [
      klip('media', { track: 0, mulai_detik: 0, durasi_detik: 10 }),
      klip('teks', { track: 2, mulai_detik: 4, durasi_detik: 6 }),
      klip('kuis', { track: 0, mulai_detik: 12, durasi_detik: 5 }),
    ]

    expect(trackMaksimal(blok)).toBe(2)

    const track = susunTrack(blok)
    expect(track).toHaveLength(3) // track 0, 1, 2
    expect(track[0].klip.map((satu) => satu.indeks)).toEqual([0, 2])
    expect(track[1].klip).toEqual([])
    expect(track[2].klip.map((satu) => satu.baris.tipe)).toEqual(['teks'])

    // Tanpa klip, timeline tetap punya track dasar.
    expect(susunTrack([])).toHaveLength(JUMLAH_TRACK)
  })

  it('menghitung durasi total minimal dan titik akhir terjauh', () => {
    expect(durasiTotal([])).toBe(60)
    expect(durasiTotal([klip('teks', { mulai_detik: 50, durasi_detik: 20 })])).toBe(70)
  })

  it('memilih klip aktif pada waktu tertentu, track tertinggi menang', () => {
    const blok = [
      klip('media', { track: 0, mulai_detik: 0, durasi_detik: 20, teks: 'bawah' }),
      klip('media', { track: 1, mulai_detik: 5, durasi_detik: 10, teks: 'atas' }),
    ]

    expect(klipPada(blok, 2)?.teks).toBe('bawah')
    expect(klipPada(blok, 6)?.teks).toBe('atas')
    expect(klipPada(blok, 40)).toBeNull()
  })

  it('menggeser titik mulai dan menjepitnya agar tidak negatif', () => {
    const blok = [klip('teks', { mulai_detik: 4 })]
    expect(setMulai(blok, 0, 12.34)[0].mulai_detik).toBe(12.3)
    expect(setMulai(blok, 0, -5)[0].mulai_detik).toBe(0)
  })

  it('memformat detik jadi mm:ss', () => {
    expect(formatWaktu(0)).toBe('00:00')
    expect(formatWaktu(75)).toBe('01:15')
  })
})

describe('ciri klip & template', () => {
  it('memberi ikon/label per tipe dan fallback untuk tipe tak dikenal', () => {
    expect(ciriKlip('teks')).toEqual({ ikon: '¶', label: 'Teks' })
    expect(ciriKlip('media')).toEqual({ ikon: '▶', label: 'Media' })
    expect(ciriKlip('kuis')).toEqual({ ikon: '?', label: 'Kuis sisipan' })
    expect(ciriKlip(/** @type {any} */ ('entah'))).toEqual({ ikon: '•', label: 'Blok' })
  })

  it('template sengaja masih kosong', () => {
    expect(TEMPLATE_MATERI).toEqual([])
    expect(adaTemplate()).toBe(false)
  })
})
