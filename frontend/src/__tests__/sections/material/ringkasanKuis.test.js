/**
 * Tes helper layar sesudah kuis sisipan: saklar guru (bawaan mati), bintang,
 * urutan & rekap kartu ingat, dan status ringkasan. Juga skema respons server
 * dan normalisasi saklar di editor (kuis lama tidak berubah bentuk).
 */
import { describe, expect, it } from 'vitest'
import { skemaRingkasanKuis } from '../../../sections/material/api.js'
import { tampilanKlip, ubahTampilan, muatanBlok, blokBaru } from '../../../sections/material/editor/editorMateri.js'
import {
  adaLayarTambahan,
  bintangDariPersen,
  kartuUlang,
  persenSkor,
  pesanCapaian,
  rekapKartu,
  saklarSesudahKuis,
  statusRingkasan,
  urutKartu,
} from '../../../sections/material/kuis/ringkasanKuis.js'

/** @param {number} id @param {number} nomor @param {boolean|null} benar */
const kartu = (id, nomor, benar) => ({ question_id: id, nomor, depan: `Soal ${nomor}`, belakang: 'A', catatan: null, benar })

describe('saklarSesudahKuis', () => {
  it('bawaan mati bila guru tidak mengaturnya', () => {
    expect(saklarSesudahKuis(null)).toEqual({ ringkasan: false, kartu: false, papan: false })
    expect(saklarSesudahKuis({ mode: 'jeda', tata: 'vertikal' })).toEqual({ ringkasan: false, kartu: false, papan: false })
  })

  it('membaca 1 / true / "1" sebagai nyala, 0 sebagai mati', () => {
    const saklar = saklarSesudahKuis({ ringkasan: 1, kartu: 0, papan: '1' })

    expect(saklar).toEqual({ ringkasan: true, kartu: false, papan: true })
    expect(adaLayarTambahan(saklar)).toBe(true)
    expect(adaLayarTambahan(saklarSesudahKuis({ kartu: 0 }))).toBe(false)
  })
})

describe('skor & bintang', () => {
  it('persen tidak pernah NaN dan dijepit 0–100', () => {
    expect(persenSkor(3, 4)).toBe(75)
    expect(persenSkor(0, 0)).toBe(0)
    expect(persenSkor(null, 4)).toBe(0)
    expect(persenSkor(9, 4)).toBe(100)
  })

  it('bintang: ambang ramah anak, bintang pertama untuk yang sudah benar sebagian', () => {
    expect([0, 1, 59, 60, 84, 85, 100].map(bintangDariPersen)).toEqual([0, 1, 1, 2, 2, 3, 3])
  })

  it('pesan capaian selalu ada dan tidak membandingkan dengan murid lain', () => {
    for (const persen of [0, 30, 70, 100]) expect(pesanCapaian(persen).length).toBeGreaterThan(10)
  })
})

describe('kartu ingat', () => {
  const semua = [kartu(1, 1, true), kartu(2, 2, false), kartu(3, 3, null), kartu(4, 4, true)]

  it('kartu yang salah/belum dinilai lebih dulu, lalu yang benar, urut nomor', () => {
    expect(urutKartu(semua).map((k) => k.question_id)).toEqual([2, 3, 1, 4])
  })

  it('tidak mengubah larik asal', () => {
    const salinan = [...semua]
    urutKartu(semua)
    expect(semua).toEqual(salinan)
  })

  it('rekap menghitung ingat/belum/tersisa dan penanda selesai', () => {
    expect(rekapKartu(semua, { 1: 'ingat', 2: 'belum' })).toEqual({ ingat: 1, belum: 1, tersisa: 2, selesai: false })
    expect(rekapKartu(semua, { 1: 'ingat', 2: 'belum', 3: 'ingat', 4: 'ingat' }).selesai).toBe(true)
    expect(rekapKartu([], {}).selesai).toBe(false)
  })

  it('kartu ulang hanya yang dinilai belum ingat', () => {
    expect(kartuUlang(semua, { 1: 'ingat', 2: 'belum', 3: 'belum' }).map((k) => k.question_id)).toEqual([2, 3])
  })
})

describe('statusRingkasan', () => {
  it('selalu membawa label teks, bukan hanya warna', () => {
    expect(statusRingkasan({ terjawab: true, benar: true })).toEqual({ kunci: 'benar', label: 'Benar' })
    expect(statusRingkasan({ terjawab: true, benar: false }).kunci).toBe('salah')
    expect(statusRingkasan({ terjawab: false, benar: false }).kunci).toBe('kosong')
    expect(statusRingkasan({ terjawab: true, benar: null }).kunci).toBe('tinjau')
  })
})

describe('skemaRingkasanKuis', () => {
  it('menerima respons dengan hanya bagian yang dibuka guru', () => {
    const hasil = skemaRingkasanKuis.parse({ opsi: { ringkasan: false, kartu: false, papan: true }, papan: { skor_maksimal: 4, peserta: 1, teratas: [], saya: null } })

    expect(hasil.soal).toBeUndefined()
    expect(hasil.papan?.peserta).toBe(1)
  })

  it('menolak baris soal tanpa teks', () => {
    expect(() => skemaRingkasanKuis.parse({ opsi: { ringkasan: true, kartu: false, papan: false }, soal: [{ question_id: 1 }] })).toThrow()
  })
})

describe('editor: saklar sesudah kuis', () => {
  it('kuis lama tidak mendapat kunci baru saat dinormalkan', () => {
    expect(tampilanKlip({ tipe: 'kuis', tampilan: { mode: 'jeda', tata: 'vertikal' } })).toEqual({ mode: 'jeda', tata: 'vertikal' })
  })

  it('saklar yang diatur ikut, dinormalkan ke 0/1, dan dikirim ke server', () => {
    const blok = [{ ...blokBaru('kuis', { quiz_id: 7 }) }]
    const nyala = ubahTampilan(blok, 0, { ringkasan: 1, kartu: 0 })

    expect(tampilanKlip(nyala[0])).toEqual({ mode: 'jeda', tata: 'vertikal', ringkasan: 1, kartu: 0 })
    expect(muatanBlok(nyala)[0].tampilan).toEqual({ mode: 'jeda', tata: 'vertikal', ringkasan: 1, kartu: 0 })
    // Nilai aneh dibaca mati, bukan nyala.
    expect(tampilanKlip({ tipe: 'kuis', tampilan: { papan: 'ya' } }).papan).toBe(0)
  })
})
