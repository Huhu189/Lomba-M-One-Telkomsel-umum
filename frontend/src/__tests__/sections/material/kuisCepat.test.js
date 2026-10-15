/**
 * Tes logika murni "Buat kuis cepat" di editor materi: validasi isian dan
 * muatan soal yang dikirim ke API (pilihan kosong dibuang, huruf diurutkan
 * ulang, kunci mengikuti pilihan yang ditandai benar).
 */
import { describe, expect, it } from 'vitest'
import {
  galatKuisCepat,
  galatSoalCepat,
  muatanSoalCepat,
  soalCepatKosong,
  soalCepatTerisi,
  uraiSoalDariTeks,
} from '../../../sections/material/kuis/kuisCepat.js'

/** @param {Partial<import('../../../sections/material/kuis/kuisCepat.js').SoalCepat>} [ubah] */
const soal = (ubah = {}) => ({ ...soalCepatKosong(), teks: '2 + 2 = ?', opsi: ['3', '4', '', ''], benar: 1, ...ubah })

describe('validasi kuis cepat', () => {
  it('soal tanpa pertanyaan dilewati, bukan dianggap salah', () => {
    expect(soalCepatTerisi(soalCepatKosong())).toBe(false)
    expect(galatSoalCepat(soalCepatKosong(), 1)).toBe('')
  })

  it('meminta minimal dua pilihan', () => {
    expect(galatSoalCepat(soal({ opsi: ['3', '', '', ''], benar: 0 }), 2)).toBe(
      'Soal 2: isi minimal dua pilihan jawaban.',
    )
  })

  it('menolak jawaban benar yang menunjuk pilihan kosong', () => {
    expect(galatSoalCepat(soal({ benar: 3 }), 1)).toBe(
      'Soal 1: pilihan yang ditandai benar masih kosong.',
    )
  })

  it('memeriksa judul dan durasi, tetapi soal boleh kosong sama sekali', () => {
    const dasar = { judul: 'Kuis Pecahan', durasi: '10', soal: [soalCepatKosong()] }

    expect(galatKuisCepat(dasar)).toBe('')
    expect(galatKuisCepat({ ...dasar, judul: '  ' })).toBe('Judul kuis wajib diisi.')
    expect(galatKuisCepat({ ...dasar, durasi: '0' })).toMatch(/Durasi/)
    expect(galatKuisCepat({ ...dasar, durasi: '2,5' })).toMatch(/Durasi/)
  })

  it('melaporkan galat soal pertama yang tidak sah dengan nomor urut soal terisi', () => {
    const galat = galatKuisCepat({
      judul: 'K',
      durasi: '5',
      soal: [soalCepatKosong(), soal(), soal({ opsi: ['x', '', '', ''], benar: 0 })],
    })

    expect(galat).toBe('Soal 2: isi minimal dua pilihan jawaban.')
  })
})

describe('muatan soal cepat', () => {
  it('membuang pilihan kosong, menghuruf ulang, dan memindahkan kunci', () => {
    const muatan = muatanSoalCepat(soal({ opsi: ['', '4', '', '5'], benar: 3 }), 7)

    expect(muatan.subject_id).toBe(7)
    expect(muatan.tipe).toBe('pilihan_ganda')
    expect(muatan.konten.teks).toBe('2 + 2 = ?')
    expect(muatan.konten.opsi).toEqual([
      { id: 'A', teks: '4' },
      { id: 'B', teks: '5' },
    ])
    expect(JSON.stringify(muatan.kunci)).toContain('"B"')
    expect(muatan.skor).toBe(10)
    expect(muatan.aktif).toBe(true)
  })
})

describe('urai soal dari teks tempelan', () => {
  it('membaca soal bernomor, tanda * dan baris Jawaban', () => {
    const { soal: hasil, tanpaKunci } = uraiSoalDariTeks(
      ['1. Ibu kota Indonesia?', 'A. Bandung', '*B. Jakarta', 'C. Medan', '', '2) 2 + 2 = ?', 'a. 3', 'b. 4', 'Jawaban: b'].join('\n'),
    )

    expect(hasil).toHaveLength(2)
    expect(hasil[0]).toEqual({ teks: 'Ibu kota Indonesia?', opsi: ['Bandung', 'Jakarta', 'Medan', ''], benar: 1 })
    expect(hasil[1]).toEqual({ teks: '2 + 2 = ?', opsi: ['3', '4', '', ''], benar: 1 })
    expect(tanpaKunci).toBe(0)
  })

  it('soal tanpa tanda jawaban memakai A dan dihitung', () => {
    const { soal: hasil, tanpaKunci } = uraiSoalDariTeks('1. Apa?\nA. x\nB. y')

    expect(hasil[0].benar).toBe(0)
    expect(tanpaKunci).toBe(1)
  })

  it('soal tanpa nomor dipisah baris kosong; pertanyaan boleh beberapa baris', () => {
    const { soal: hasil } = uraiSoalDariTeks('Baris satu\nlanjutan\nA. p\nB. q\n\nSoal kedua\nA. r\nB. s')

    expect(hasil).toHaveLength(2)
    expect(hasil[0].teks).toBe('Baris satu\nlanjutan')
    expect(hasil[1].teks).toBe('Soal kedua')
  })

  it('teks kosong atau tanpa soal menghasilkan daftar kosong', () => {
    expect(uraiSoalDariTeks('   \n\n').soal).toEqual([])
  })
})
