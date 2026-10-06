import { describe, expect, it } from 'vitest'
import { skemaKuis, skemaSoalTampil } from './api.js'
import { formatDurasi, formatJadwal, statusTampilan } from './status.js'

/** Kuis draf versi guru (tanpa soal karena daftar tidak memuatnya). */
const kuisGuru = {
  id: 4,
  judul: 'Ulangan Matematika',
  deskripsi: null,
  status: 'draf',
  status_label: 'Draf',
  subject_id: 3,
  class_id: 2,
  mapel_nama: 'Matematika',
  kelas_nama: '6A',
  mulai_at: null,
  selesai_at: null,
  durasi_menit: 30,
  acak_soal: true,
  acak_opsi: true,
  jumlah_soal: 4,
  sedang_berjalan: false,
}

describe('skema kuis', () => {
  it('menerima kuis guru tanpa daftar soal', () => {
    const kuis = skemaKuis.parse(kuisGuru)
    expect(kuis.jumlah_soal).toBe(4)
    expect(kuis.soal).toBeUndefined()
  })

  it('menerima detail kuis murid dengan soal tanpa kunci', () => {
    const kuis = skemaKuis.parse({
      ...kuisGuru,
      status: 'publikasi',
      status_label: 'Publikasi',
      sedang_berjalan: true,
      soal: [
        { id: 12, tipe: 'benar_salah', tipe_label: 'Benar / salah', konten: { teks: '1 + 1 = 2.' }, skor: 10 },
      ],
    })

    expect(kuis.soal?.[0].kunci).toBeUndefined()
    expect(kuis.sedang_berjalan).toBe(true)
  })

  it('skema soal tampil menolak skor bukan angka', () => {
    expect(() =>
      skemaSoalTampil.parse({ id: 1, tipe: 'uraian', tipe_label: 'Uraian', konten: {}, skor: 'sepuluh' }),
    ).toThrow()
  })
})

describe('statusTampilan', () => {
  it('menandai draf dan arsip', () => {
    expect(statusTampilan({ ...kuisGuru, status: 'draf' }).label).toBe('Draf')
    expect(statusTampilan({ ...kuisGuru, status: 'arsip' }).label).toBe('Diarsipkan')
  })

  it('membedakan sedang berjalan, belum dimulai, dan selesai', () => {
    const dasar = { status: 'publikasi', sedang_berjalan: false, selesai_at: null, mulai_at: null }

    expect(statusTampilan({ ...dasar, sedang_berjalan: true }).label).toBe('Sedang berjalan')
    expect(
      statusTampilan({ ...dasar, mulai_at: new Date(Date.now() + 3_600_000).toISOString() }).label,
    ).toBe('Belum dimulai')
    expect(
      statusTampilan({ ...dasar, mulai_at: new Date(Date.now() - 3_600_000).toISOString() }).label,
    ).toBe('Selesai')
  })
})

describe('format kuis', () => {
  it('menulis durasi jam dan menit', () => {
    expect(formatDurasi(30)).toBe('30 menit')
    expect(formatDurasi(60)).toBe('1 jam')
    expect(formatDurasi(75)).toBe('1 jam 15 menit')
  })

  it('menulis jadwal dengan nama bulan Indonesia', () => {
    expect(formatJadwal('2026-10-06T10:00:00+07:00')).toContain('Okt')
    expect(formatJadwal(null)).toBe('—')
  })
})
