/**
 * Tes pemutar murid: kapan kuis di dalam video muncul, dan aturan boleh-buka
 * yang kini mengikuti timeline (server yang menghitung, klien menampilkan).
 */
import { describe, expect, it } from 'vitest'
import {
  blokBerikutnya,
  bolehDibuka,
  skemaBukaBlok,
  skemaRingkasanMateri,
} from '../../../sections/material/api.js'
import { kuisJatuhTempo, sisaWajib, sisipanUntuk } from '../../../sections/material/pemutar/pemutarMateri.js'

/** @param {Record<string, unknown>} lebih */
const blok = (lebih) => ({
  block_id: 1,
  urutan: 1,
  tipe: 'teks',
  tipe_label: 'Teks',
  wajib: true,
  status: 'belum',
  status_label: 'Belum dibuka',
  ...lebih,
})

/** @param {Array<Record<string, unknown>>} daftar */
const ringkasan = (daftar) =>
  skemaRingkasanMateri.parse({
    materi: { id: 1, judul: 'M', deskripsi: null },
    blok: daftar,
    // Peta perjalanan tidak diuji di sini; bagian pemutar hanya butuh bentuk sah.
    perjalanan: {
      kode: 'mendaki-gunung',
      nama: 'Mendaki Gunung',
      tanpa: false,
      adegan: 'gunung',
      satuan: 'pos',
      video_url: null,
      langkah: [],
      jumlah_langkah: 0,
      posisi: 0,
      selesai: 0,
      total: 0,
      persen: 0,
      tuntas: false,
      tingkat: { nomor: 1, nama: 'Pendaki Pemula', min: 0, puncak: false },
      tingkat_berikut: null,
    },
    jumlah_blok: daftar.length,
    selesai_wajib: 0,
    jumlah_wajib: daftar.length,
    persen: 0,
  })

const data = ringkasan([
  blok({ block_id: 10, urutan: 1, tipe: 'media', mulai_detik: 0, durasi_detik: 60 }),
  blok({ block_id: 12, urutan: 3, tipe: 'kuis', mulai_detik: 40, durasi_detik: 5, host_id: 10 }),
  blok({ block_id: 11, urutan: 2, tipe: 'kuis', mulai_detik: 15, durasi_detik: 5, host_id: 10 }),
  blok({ block_id: 13, urutan: 4, tipe: 'teks', mulai_detik: 70, durasi_detik: 10 }),
])

describe('kuis di dalam video', () => {
  it('mengumpulkan sisipan satu video, urut titik mulai', () => {
    expect(sisipanUntuk(data, 10).map((satu) => satu.block_id)).toEqual([11, 12])
    expect(sisipanUntuk(data, 99)).toEqual([])
  })

  it('memunculkan kuis saat video mencapai titiknya, bukan sebelumnya', () => {
    const sisipan = sisipanUntuk(data, 10)

    expect(kuisJatuhTempo(sisipan, 14.5, new Set())).toBeNull()
    expect(kuisJatuhTempo(sisipan, 15.1, new Set())?.block_id).toBe(11)
  })

  it('murid melompat jauh: kuis paling awal yang muncul lebih dulu', () => {
    expect(kuisJatuhTempo(sisipanUntuk(data, 10), 55, new Set())?.block_id).toBe(11)
  })

  it('tidak memunculkan lagi kuis yang sudah ditutup atau selesai', () => {
    const sisipan = sisipanUntuk(data, 10)

    expect(kuisJatuhTempo(sisipan, 55, new Set([11]))?.block_id).toBe(12)
    expect(kuisJatuhTempo(sisipan, 55, new Set([11, 12]))).toBeNull()

    const selesai = sisipan.map((satu) => ({ ...satu, status: 'selesai' }))

    expect(kuisJatuhTempo(selesai, Number.POSITIVE_INFINITY, new Set())).toBeNull()
  })

  it('saat video selesai (Infinity) semua kuis tersisa muncul bertahap', () => {
    expect(kuisJatuhTempo(sisipanUntuk(data, 10), Number.POSITIVE_INFINITY, new Set())?.block_id).toBe(11)
  })

  it('menghitung kuis wajib yang masih tersisa', () => {
    const sisipan = sisipanUntuk(data, 10)

    expect(sisaWajib(sisipan)).toBe(2)
    expect(sisaWajib(sisipan, new Set([11]))).toBe(1)
    expect(sisaWajib(sisipan.map((satu) => ({ ...satu, wajib: false })))).toBe(0)
  })
})

describe('daftar bagian murid', () => {
  it('membaca penempatan klip dari server', () => {
    expect(data.blok[1].host_id).toBe(10)
    // Bingkai materi dikunci 16:9, jadi tidak ada lagi rasio yang dibaca klien.
    expect('rasio' in data.materi).toBe(false)
  })

  it('memakai keputusan boleh_dibuka dari server bila ada', () => {
    expect(bolehDibuka(data, { ...data.blok[0], boleh_dibuka: false })).toBe(false)
    expect(bolehDibuka(data, { ...data.blok[0], boleh_dibuka: true })).toBe(true)
  })

  it('"lanjut" melewati kuis sisipan dan mengikuti timeline', () => {
    expect(blokBerikutnya(data)?.block_id).toBe(10)

    const videoSelesai = ringkasan(
      data.blok.map((satu) => (satu.block_id === 10 ? { ...satu, status: 'selesai' } : satu)),
    )

    expect(blokBerikutnya(videoSelesai)?.block_id).toBe(13)
  })

  it('membaca tampilan media saat blok dibuka', () => {
    const dibuka = skemaBukaBlok.parse({
      blok: blok({
        block_id: 10,
        tipe: 'media',
        media: { kode: 'abc', tampilan: { fit: 'cover', zoom: 1.5 } },
        tampilan: { fit: 'cover', zoom: 1.5 },
      }),
      attempt: null,
    })

    expect(dibuka.blok.media?.tampilan).toEqual({ fit: 'cover', zoom: 1.5 })
  })
})
