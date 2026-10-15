/**
 * Tes potong video: pangkas kiri melompati sumber, belah di jarum, offset
 * sinkron, dan penjaga simpan otomatis.
 */
import { describe, expect, it } from 'vitest'
import {
  awalPotong,
  belahKlip,
  blokBaru,
  blokLengkap,
  offsetMedia,
  pangkasKiri,
  tanpaPotong,
  tampilanKlip,
} from '../../../sections/material/editor/editorMateri.js'

const media = (ubah = {}) => blokBaru('media', { unggahan_kode: 'abc', ...ubah })

describe('pangkasKiri pada klip media', () => {
  it('melompati bagian awal sumber, ujung kanan tetap', () => {
    const [satu] = pangkasKiri([media({ mulai_detik: 2 })], 0, 5)

    expect(satu.mulai_detik).toBe(5)
    expect(satu.durasi_detik).toBe(7)
    expect(awalPotong(satu)).toBe(3)
  })

  it('tidak bisa dimundurkan melewati awal sumbernya', () => {
    const dipotong = pangkasKiri([media({ mulai_detik: 2 })], 0, 5)
    const [satu] = pangkasKiri(dipotong, 0, 0)

    expect(satu.mulai_detik).toBe(2)
    expect(satu.durasi_detik).toBe(10)
    expect(awalPotong(satu)).toBe(0)
  })

  it('klip teks tidak mendapat potongan sumber', () => {
    const [satu] = pangkasKiri([blokBaru('teks', { mulai_detik: 1 })], 0, 4)

    expect(satu.tampilan).toBeUndefined()
  })
})

describe('belahKlip', () => {
  it('membelah media; bagian kanan melanjutkan sumber dari titik potong', () => {
    const hasil = belahKlip([media({ mulai_detik: 1 })], 0, 4)

    expect(hasil.berhasil).toBe(true)
    expect(hasil.indeks).toBe(1)
    expect(hasil.blok.map((b) => [b.mulai_detik, b.durasi_detik, awalPotong(b)])).toEqual([
      [1, 3, 0],
      [4, 7, 3],
    ])
  })

  it('membelah klip yang sudah dipotong kepalanya dengan potongan kumulatif', () => {
    const dipotong = pangkasKiri([media({ mulai_detik: 2 })], 0, 5)
    const hasil = belahKlip(dipotong, 0, 8)

    expect(hasil.blok.map((b) => awalPotong(b))).toEqual([3, 6])
  })

  it('menolak titik di tepi klip, klip teks, dan klip kuis', () => {
    expect(belahKlip([media()], 0, 0).berhasil).toBe(false)
    expect(belahKlip([media()], 0, 10).berhasil).toBe(false)
    expect(belahKlip([blokBaru('teks')], 0, 3).berhasil).toBe(false)
    expect(belahKlip([blokBaru('kuis')], 0, 3).berhasil).toBe(false)
  })
})

describe('offsetMedia dengan potongan awal', () => {
  it('menambah titik awal potongan ke posisi media', () => {
    expect(offsetMedia(6, 5, 4, 3)).toBe(4)
    expect(offsetMedia(9, 5, 2, 3)).toBe(5)
    expect(offsetMedia(1, 5, 4)).toBe(0)
  })
})

describe('tampilan & penjaga simpan otomatis', () => {
  it('potong_awal hanya ikut payload bila > 0', () => {
    expect(tampilanKlip(media())).not.toHaveProperty('potong_awal')
    expect(tampilanKlip(media({ tampilan: { potong_awal: 2.5 } })).potong_awal).toBe(2.5)
  })

  it('tanpaPotong membuang titik potong saat sumber diganti', () => {
    const satu = media({ tampilan: { potong_awal: 4, zoom: 2 } })

    expect(tanpaPotong(satu).tampilan).toEqual({ zoom: 2 })
  })

  it('blokLengkap menolak media tanpa sumber dan kuis tanpa pilihan', () => {
    expect(blokLengkap([blokBaru('media')])).toBe(false)
    expect(blokLengkap([blokBaru('kuis')])).toBe(false)
    expect(blokLengkap([media(), blokBaru('teks'), blokBaru('media', { tautan: 'https://x.id/a.mp4' })])).toBe(true)
  })
})
