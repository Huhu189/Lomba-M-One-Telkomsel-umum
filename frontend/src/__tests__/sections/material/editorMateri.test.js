/**
 * Tes helper murni editor materi. Yang dijaga: bentuk baris editor, muatan yang
 * dikirim ke server, urutan klip (geser/sisip), dan template yang memang masih
 * kosong.
 */
import { describe, expect, it } from 'vitest'
import {
  TEMPLATE_MATERI,
  adaTemplate,
  blokBaru,
  ciriKlip,
  dariServer,
  muatanBlok,
  pindahBlok,
  sisipBlok,
} from '../../../sections/material/editorMateri.js'

describe('baris blok', () => {
  it('membuat baris baru dengan bawaan wajib dan kosong', () => {
    expect(blokBaru('media')).toEqual({
      tipe: 'media',
      wajib: true,
      teks: '',
      keterangan: '',
      unggahan_kode: '',
      quiz_id: '',
    })
  })

  it('memetakan blok server ke baris editor dan tahan field hilang', () => {
    const hasil = dariServer([
      { tipe: 'teks', wajib: false, teks: 'Halo', keterangan: null, unggahan_kode: 7 },
      { tipe: 'kuis', wajib: true, quiz_id: 12 },
      {},
    ])

    expect(hasil).toEqual([
      { tipe: 'teks', wajib: false, teks: 'Halo', keterangan: '', unggahan_kode: '', quiz_id: '' },
      { tipe: 'kuis', wajib: true, teks: '', keterangan: '', unggahan_kode: '', quiz_id: 12 },
      { tipe: 'teks', wajib: false, teks: '', keterangan: '', unggahan_kode: '', quiz_id: '' },
    ])

    expect(dariServer(undefined)).toEqual([])
  })
})

describe('muatan ke server', () => {
  it('mengemas isi sesuai tipe blok dan hanya blok kuis yang membawa quiz_id', () => {
    const muatan = muatanBlok([
      { tipe: 'teks', wajib: true, teks: 'Penjelasan', keterangan: '', unggahan_kode: '', quiz_id: '' },
      { tipe: 'media', wajib: false, teks: '', keterangan: 'Peta', unggahan_kode: 'abc', quiz_id: '' },
      { tipe: 'kuis', wajib: true, teks: '', keterangan: '', unggahan_kode: '', quiz_id: '9' },
    ])

    expect(muatan).toEqual([
      { tipe: 'teks', wajib: true, isi: { teks: 'Penjelasan' }, quiz_id: null },
      { tipe: 'media', wajib: false, isi: { unggahan_kode: 'abc', keterangan: 'Peta' }, quiz_id: null },
      { tipe: 'kuis', wajib: true, isi: undefined, quiz_id: 9 },
    ])
  })
})

describe('urutan klip', () => {
  const blok = /** @type {import('../../../sections/material/editorMateri.js').BarisBlok[]} */ ([
    { tipe: 'teks', wajib: true, teks: 'a', keterangan: '', unggahan_kode: '', quiz_id: '' },
    { tipe: 'media', wajib: true, teks: 'b', keterangan: '', unggahan_kode: '', quiz_id: '' },
    { tipe: 'kuis', wajib: true, teks: 'c', keterangan: '', unggahan_kode: '', quiz_id: '' },
  ])

  it('memindahkan klip ke posisi lain dan mengembalikan larik baru', () => {
    const hasil = pindahBlok(blok, 0, 2)
    expect(hasil.map((satu) => satu.teks)).toEqual(['b', 'c', 'a'])
    // Larik asal tidak ikut berubah.
    expect(blok.map((satu) => satu.teks)).toEqual(['a', 'b', 'c'])
  })

  it('mengembalikan larik apa adanya bila tujuan tidak sah', () => {
    expect(pindahBlok(blok, 0, 0)).toBe(blok)
    expect(pindahBlok(blok, -1, 2)).toBe(blok)
    expect(pindahBlok(blok, 0, 5)).toBe(blok)
  })

  it('menyisipkan blok di akhir atau posisi tertentu dan melaporkan indeksnya', () => {
    const akhir = sisipBlok(blok, blokBaru('teks'))
    expect(akhir.indeks).toBe(3)
    expect(akhir.blok).toHaveLength(4)
    expect(akhir.blok[3].tipe).toBe('teks')

    const tengah = sisipBlok(blok, blokBaru('kuis'), 1)
    expect(tengah.indeks).toBe(1)
    expect(tengah.blok[1].tipe).toBe('kuis')
    expect(tengah.blok.map((satu) => satu.tipe)).toEqual(['teks', 'kuis', 'media', 'kuis'])
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
