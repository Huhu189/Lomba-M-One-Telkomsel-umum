import { describe, expect, it } from 'vitest'
import { skemaHalamanSoal, skemaSoal, skemaSoalMurid, skemaTag } from '../../../sections/question/api.js'

/** Potongan SoalResource versi guru. */
const soalGuru = {
  id: 12,
  subject_id: 3,
  tag_id: null,
  tipe: 'pilihan_ganda',
  tipe_label: 'Pilihan ganda',
  objektif: true,
  konten: { teks: 'Berapa hasil 4 + 5?', opsi: [{ id: 'A', teks: '8' }, { id: 'B', teks: '9' }] },
  kunci: { jawaban: 'B' },
  pembahasan: null,
  skor: 10,
  aktif: true,
  mapel_nama: 'Matematika',
  tag_nama: null,
}

describe('skema tag', () => {
  it('menerima tag dengan jumlah soal', () => {
    const tag = skemaTag.parse({ id: 1, nama: 'Operasi Hitung', deskripsi: null, jumlah_soal: 4 })
    expect(tag.jumlah_soal).toBe(4)
  })

  it('menolak id tag yang bukan angka', () => {
    expect(() => skemaTag.parse({ id: '1', nama: 'x', deskripsi: null })).toThrow()
  })
})

describe('skema soal', () => {
  it('menerima soal guru lengkap dengan kunci', () => {
    const soal = skemaSoal.parse(soalGuru)
    expect(soal.kunci.jawaban).toBe('B')
    expect(soal.tipe_label).toBe('Pilihan ganda')
  })

  it('menolak soal tanpa konten terstruktur', () => {
    expect(() => skemaSoal.parse({ ...soalGuru, konten: 'teks bebas' })).toThrow()
  })

  it('skema murid tidak memuat kunci maupun pembahasan', () => {
    const soalMurid = skemaSoalMurid.parse({
      id: 12,
      tipe: 'pilihan_ganda',
      tipe_label: 'Pilihan ganda',
      konten: soalGuru.konten,
      skor: 10,
    })

    expect(Object.keys(soalMurid)).not.toContain('kunci')
    expect(Object.keys(soalMurid)).not.toContain('pembahasan')
  })
})

describe('skema halaman bank soal', () => {
  it('menerima respons berpaginasi', () => {
    const halaman = skemaHalamanSoal.parse({
      data: [soalGuru],
      meta: { total: 1, current_page: 1, last_page: 1 },
    })

    expect(halaman.data).toHaveLength(1)
    expect(halaman.meta.total).toBe(1)
  })

  it('menolak respons tanpa meta paginasi', () => {
    expect(() => skemaHalamanSoal.parse({ data: [soalGuru] })).toThrow()
  })
})
