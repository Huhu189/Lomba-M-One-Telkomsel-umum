/**
 * Tes helper bingkai editor: rasio terkunci, penyesuaian media, kuis sisipan
 * (mode jeda/berjalan), dan posisi jarum merah.
 */
import { describe, expect, it } from 'vitest'
import {
  blokBaru,
  dariServer,
  detikDariX,
  gayaMedia,
  klipDasarPada,
  kuisJeda,
  kuisPadaWaktu,
  muatanBlok,
  rasioAngka,
  tampilanKlip,
  ubahTampilan,
} from '../../../sections/material/editorMateri.js'

const video = () => blokBaru('media', { track: 0, mulai_detik: 0, durasi_detik: 60 })
/**
 * @param {number} mulai
 * @param {Record<string, string|number>|undefined} [tampilan]
 */
const kuis = (mulai, tampilan) =>
  ({ ...blokBaru('kuis', { track: 1, mulai_detik: mulai, durasi_detik: 10, quiz_id: '3' }), tampilan })

describe('rasio bingkai', () => {
  it('mengubah rasio jadi angka dan jatuh ke 16:9 bila tak sah', () => {
    expect(rasioAngka('9:16')).toBeCloseTo(0.5625)
    expect(rasioAngka('1:1')).toBe(1)
    expect(rasioAngka('ngawur')).toBeCloseTo(16 / 9)
    expect(rasioAngka(undefined)).toBeCloseTo(16 / 9)
  })
})

describe('penyesuaian tampilan', () => {
  it('memberi bawaan dan menjepit nilai di luar batas', () => {
    expect(tampilanKlip(video())).toEqual({ fit: 'contain', fokus_x: 50, fokus_y: 50, zoom: 1 })
    expect(
      tampilanKlip({ ...video(), tampilan: { fit: 'cover', fokus_x: 999, fokus_y: -5, zoom: 9 } }),
    ).toEqual({ fit: 'cover', fokus_x: 100, fokus_y: 0, zoom: 3 })
    expect(tampilanKlip(kuis(5))).toEqual({ mode: 'jeda', tata: 'vertikal' })
    expect(tampilanKlip(blokBaru('teks'))).toEqual({})
  })

  it('mengubah sebagian pengaturan tanpa menyentuh klip lain', () => {
    const blok = [video(), kuis(5)]
    const hasil = ubahTampilan(blok, 1, { mode: 'berjalan' })

    expect(tampilanKlip(hasil[1])).toEqual({ mode: 'berjalan', tata: 'vertikal' })
    expect(hasil[0]).toBe(blok[0])
  })

  it('menurunkan gaya CSS: fit, titik fokus, zoom', () => {
    const gaya = gayaMedia({ ...video(), tampilan: { fit: 'cover', fokus_x: 20, fokus_y: 80, zoom: 1.5 } })

    expect(gaya).toEqual({
      objectFit: 'cover',
      objectPosition: '20% 80%',
      transform: 'scale(1.5)',
      transformOrigin: '20% 80%',
    })
    expect(gayaMedia(video()).transform).toBeUndefined()
  })

  it('mengirim tampilan hanya bila guru pernah mengaturnya, dan stabil bolak-balik', () => {
    const polos = muatanBlok([video(), kuis(5)])

    expect(polos[0]).not.toHaveProperty('tampilan')
    expect(polos[1]).not.toHaveProperty('tampilan')

    const diatur = ubahTampilan([video()], 0, { fit: 'cover', zoom: 1.25 })
    const kirim = muatanBlok(diatur)

    // Yang dikirim sudah ternormalkan; dibaca balik dari server → muatan sama.
    expect(kirim[0].tampilan).toEqual({ fit: 'cover', fokus_x: 50, fokus_y: 50, zoom: 1.25 })

    const dariSv = dariServer([
      { tipe: 'media', wajib: true, isi: { unggahan_kode: '', keterangan: '' }, track: 0, mulai_detik: 0, durasi_detik: 60, tampilan: kirim[0].tampilan },
    ])

    expect(muatanBlok(dariSv)[0].tampilan).toEqual(kirim[0].tampilan)
  })
})

describe('lapisan dasar dan kuis', () => {
  it('kuis tidak menutupi video pada layar dasar', () => {
    const blok = [video(), kuis(10)]

    expect(klipDasarPada(blok, 12)?.tipe).toBe('media')
  })

  it('mencari kuis yang jendelanya memuat detik tertentu', () => {
    const blok = [video(), kuis(10), kuis(30)]

    expect(kuisPadaWaktu(blok, 5)).toHaveLength(0)
    expect(kuisPadaWaktu(blok, 12).map((satu) => satu.indeks)).toEqual([1])
    expect(kuisPadaWaktu(blok, 20)).toHaveLength(0)
  })
})

describe('kuis bermode jeda', () => {
  it('berhenti tepat di titik kuis saat playhead melewatinya', () => {
    const blok = [video(), kuis(12.5)]

    expect(kuisJeda(blok, 12.25, 12.5, new Set())?.indeks).toBe(1)
    expect(kuisJeda(blok, 0, 12.2, new Set())).toBeNull()
  })

  it('tidak memicu kuis yang sudah dilanjutkan atau yang bermode berjalan', () => {
    const blok = [video(), kuis(12.5), kuis(20, { mode: 'berjalan' })]

    expect(kuisJeda(blok, 12, 13, new Set([1]))).toBeNull()
    expect(kuisJeda(blok, 19, 21, new Set())).toBeNull()
  })

  it('memilih yang paling awal bila beberapa terlewati sekaligus', () => {
    const blok = [video(), kuis(30), kuis(10)]

    expect(kuisJeda(blok, 0, 60, new Set())?.indeks).toBe(2)
  })
})

describe('jarum merah', () => {
  it('mengubah posisi pointer jadi detik, dibulatkan 0,1 dan dijepit', () => {
    const kotak = { left: 100, width: 200 }

    expect(detikDariX(200, kotak, 60)).toBe(30)
    expect(detikDariX(50, kotak, 60)).toBe(0)
    expect(detikDariX(999, kotak, 60)).toBe(60)
    expect(detikDariX(133, kotak, 60)).toBe(9.9)
    expect(detikDariX(10, { left: 0, width: 0 }, 60)).toBe(0)
  })
})
