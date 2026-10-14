/**
 * Alat grid penyusun soal (14 Oktober 2026).
 *
 * Keluhan pemilik produk: "pembuatan soal tabel itu sangat buruk … lebih baik
 * dalam GUI". Sebelumnya nama kolom tabel diketik sebagai teks berkoma, grid
 * teka silang ditulis sebagai teks ('kucing\n#n#i#t'), dan sinonim uraian
 * sebagai baris 'kata = alias'. Berkas ini menguji helper MURNI yang dipakai
 * grid-grid itu — bagian yang menentukan bentuk data yang dikirim ke server,
 * jadi salah di sini berarti soal tersimpan melenceng.
 */
import { describe, expect, it } from 'vitest'
import {
  MAKS_SEL,
  barisSinonimUraian,
  gridDariKotakSilang,
  hapusBarisSilang,
  hapusBarisSinonimUraian,
  hapusBarisTabel,
  hapusKolomSilang,
  hapusKolomTabel,
  kolomTabel,
  kolomTabelDiganti,
  kotakSilangDariGrid,
  samakanPanjangSilang,
  sinonimUraianDariTeks,
  tambahBarisSilang,
  tambahBarisSinonimUraian,
  tambahBarisTabel,
  tambahKolomSilang,
  tambahKolomTabel,
  teksDariBarisSinonimUraian,
  ubahBarisSinonimUraian,
  ubahKotakSilang,
} from '../../../sections/question/tipeSoal.js'

/** Tabel dua kolom dengan satu baris, seperti hasil grid editor. */
function tabelDuaKolom() {
  return {
    kolom: 'Soal, Jawaban',
    barisTabel: [
      {
        id: 'R1',
        sel: [
          { kode: 'r1c1', teks: '3 x 4' },
          { kode: 'r1c2', teks: '' },
        ],
      },
    ],
    kunciSel: { r1c2: '12' },
  }
}

describe('grid tabel isian', () => {
  it('tambah kolom: nama bawaan ikut ditulis dan tiap baris dapat sel kosong', () => {
    const hasil = tambahKolomTabel(tabelDuaKolom())

    expect(hasil).not.toBeNull()
    expect(kolomTabel(/** @type {any} */ (hasil))).toEqual(['Soal', 'Jawaban', 'Kolom 3'])
    expect(/** @type {any} */ (hasil).barisTabel[0].sel).toEqual([
      { kode: 'r1c1', teks: '3 x 4' },
      { kode: 'r1c2', teks: '' },
      { kode: 'r1c3', teks: '' },
    ])
  })

  it('tambah kolom: kode sel baru tidak bentrok dengan baris lain', () => {
    const state = {
      kolom: 'Soal, Jawaban',
      barisTabel: [
        { id: 'R1', sel: [{ kode: 'r1c1', teks: '' }, { kode: 'r1c2', teks: '' }] },
        { id: 'R2', sel: [{ kode: 'r2c1', teks: '' }, { kode: 'r2c2', teks: '' }] },
      ],
      kunciSel: {},
    }

    const hasil = /** @type {any} */ (tambahKolomTabel(state))
    const kode = hasil.barisTabel.flatMap((/** @type {any} */ baris) => baris.sel.map((/** @type {any} */ sel) => sel.kode))

    expect(kode).toHaveLength(6)
    // Server menolak kode sel kembar, jadi keunikan ini pagar mutu, bukan gaya.
    expect(new Set(kode).size).toBe(kode.length)
  })

  it('tambah kolom ditolak saat batas sel tercapai (null, bukan diam-diam)', () => {
    const penuh = {
      kolom: 'A, B',
      barisTabel: [...Array(MAKS_SEL / 2)].map((_, nomor) => ({
        id: `R${nomor + 1}`,
        sel: [
          { kode: `r${nomor + 1}c1`, teks: '' },
          { kode: `r${nomor + 1}c2`, teks: '' },
        ],
      })),
      kunciSel: {},
    }

    expect(tambahKolomTabel(penuh)).toBeNull()
    expect(tambahBarisTabel(penuh)).toBeNull()
  })

  it('hapus kolom membuang selnya di setiap baris beserta kunci selnya', () => {
    const hasil = /** @type {any} */ (hapusKolomTabel(tabelDuaKolom(), 0))

    expect(kolomTabel(hasil)).toEqual(['Jawaban'])
    expect(hasil.barisTabel[0].sel).toEqual([{ kode: 'r1c2', teks: '' }])
    // Kunci sel yang masih ada tetap menempel selnya; yang tak dikenal dibuang.
    expect(hasil.kunciSel).toEqual({ r1c2: '12' })
  })

  it('kolom terakhir tidak bisa dihapus', () => {
    expect(hapusKolomTabel({ ...tabelDuaKolom(), kolom: 'Soal' }, 0)).toBeNull()
    expect(hapusKolomTabel(tabelDuaKolom(), 5)).toBeNull()
  })

  it('tambah baris mengisi sel untuk tiap kolom', () => {
    const hasil = /** @type {any} */ (tambahBarisTabel(tabelDuaKolom()))

    expect(hasil.barisTabel).toHaveLength(2)
    expect(hasil.barisTabel[1].sel.map((/** @type {any} */ sel) => sel.teks)).toEqual(['', ''])
    expect(hasil.barisTabel[1].id).not.toBe(hasil.barisTabel[0].id)
  })

  it('tabel tanpa kolom tidak bisa ditambah barisnya', () => {
    expect(tambahBarisTabel({ kolom: '', barisTabel: [] })).toBeNull()
  })

  it('hapus baris membuang kunci sel baris itu saja', () => {
    const state = {
      kolom: 'Soal, Jawaban',
      barisTabel: [
        { id: 'R1', sel: [{ kode: 'r1c1', teks: '3 x 4' }, { kode: 'r1c2', teks: '' }] },
        { id: 'R2', sel: [{ kode: 'r2c1', teks: '5 x 5' }, { kode: 'r2c2', teks: '' }] },
      ],
      kunciSel: { r1c2: '12', r2c2: '25' },
    }

    const hasil = /** @type {any} */ (hapusBarisTabel(state, 0))

    expect(hasil.barisTabel.map((/** @type {any} */ baris) => baris.id)).toEqual(['R2'])
    expect(hasil.kunciSel).toEqual({ r2c2: '25' })
    expect(hapusBarisTabel({ ...state, barisTabel: [state.barisTabel[0]] }, 0)).toBeNull()
  })

  it('nama kolom tidak boleh menyisipkan kolom baru lewat koma', () => {
    const hasil = kolomTabelDiganti(tabelDuaKolom(), 0, 'Soal, Hasil')

    // Koma dibuang: satu koma di nama kolom tadinya menciptakan kolom hantu.
    expect(kolomTabel({ kolom: hasil })).toEqual(['Soal  Hasil', 'Jawaban'])
  })
})

describe('grid teka silang', () => {
  it('menulis huruf jawaban dan kotak hitam pada posisinya', () => {
    expect(ubahKotakSilang('..\n..', 0, 0, 'k')).toBe('k.\n..')
    expect(ubahKotakSilang('k.\n..', 1, 1, '#')).toBe('k.\n.#')
    expect(ubahKotakSilang('k.\n.#', 1, 1, '.')).toBe('k.\n..')
  })

  it('baris yang lebih pendek dipanjangkan supaya tiap baris sama panjang', () => {
    // Validasi & server menuntut grid persegi; baris pendek tadinya ditolak.
    expect(ubahKotakSilang('k\n..', 0, 0, 'x')).toBe('x.\n..')
    expect(samakanPanjangSilang([['a'], ['b', 'c', 'd']])).toEqual([
      ['a', '.', '.'],
      ['b', 'c', 'd'],
    ])
  })

  it('kotak di luar grid tidak mengubah apa pun', () => {
    expect(ubahKotakSilang('..\n..', 5, 5, 'k')).toBe('..\n..')
  })

  it('matriks kotak ⇄ teks grid bolak-balik sama', () => {
    const teks = 'kucing\n#n#i#t'

    expect(kotakSilangDariGrid(teks)).toEqual([
      ['k', 'u', 'c', 'i', 'n', 'g'],
      ['#', 'n', '#', 'i', '#', 't'],
    ])
    expect(gridDariKotakSilang(kotakSilangDariGrid(teks))).toBe(teks)
  })

  it('tambah baris & kolom memanjangkan grid, grid kosong mulai 2 kolom', () => {
    expect(tambahBarisSilang('..\n..')).toBe('..\n..\n..')
    expect(tambahKolomSilang('..\n..')).toBe('...\n...')
    expect(tambahBarisSilang('')).toBe('..')
    expect(tambahKolomSilang('')).toBeNull()
  })

  it('hapus baris/kolom menjaga teka silang minimal 2 × 2', () => {
    expect(hapusBarisSilang('..\n..', 0)).toBeNull()
    expect(hapusBarisSilang('...\n...\n...', 1)).toBe('...\n...')
    expect(hapusKolomSilang('..\n..', 1)).toBeNull()
    expect(hapusKolomSilang('...\n...', 2)).toBe('..\n..')
  })
})

describe('sinonim uraian', () => {
  it('teks lama terbaca sebagai baris kata + alias', () => {
    expect(barisSinonimUraian('fotosintesis = asimilasi, asimilasi')).toEqual([
      { kata: 'fotosintesis', alias: 'asimilasi, asimilasi' },
    ])
  })

  it('menulis ulang baris tetap memakai bentuk simpanan "kata = alias"', () => {
    const teks = teksDariBarisSinonimUraian([{ kata: 'rambut getar', alias: 'silia, silia' }])

    expect(teks).toBe('rambut getar = silia, silia')
    // Bentuk itu yang dibaca penilaian: petanya tidak berubah.
    expect(sinonimUraianDariTeks(teks)).toEqual({ 'rambut getar': ['silia', 'silia'] })
  })

  it('spasi yang sedang diketik tidak dimakan', () => {
    const awal = tambahBarisSinonimUraian('')
    const teks = ubahBarisSinonimUraian(awal, 0, 'alias', 'rambut ')

    expect(barisSinonimUraian(teks)).toEqual([{ kata: '', alias: 'rambut ' }])
    expect(teksDariBarisSinonimUraian(barisSinonimUraian(teks))).toBe(teks)
  })

  it('baris kosong tetap dibawa supaya bisa diketik, dan bisa dihapus', () => {
    expect(tambahBarisSinonimUraian('fotosintesis = asimilasi')).toBe('fotosintesis = asimilasi\n = ')
    expect(hapusBarisSinonimUraian('fotosintesis = asimilasi\nklorofil = ', 0)).toBe('klorofil = ')
  })
})
