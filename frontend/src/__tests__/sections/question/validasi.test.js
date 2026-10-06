import { describe, expect, it } from 'vitest'
import {
  TIPE,
  kontenDariState,
  kunciDariState,
  stateDariSoal,
  stateSoalKosong,
  urutanDariItem,
} from '../../../sections/question/tipeSoal.js'
import { skemaTagForm, validasiSoal } from '../../../sections/question/validasi.js'

/** State pilihan ganda valid. */
function statePilihanGanda() {
  const state = stateSoalKosong()
  state.subject_id = '3'
  state.teks = 'Berapa hasil 4 + 5?'
  state.opsi = [
    { id: 'A', teks: '8' },
    { id: 'B', teks: '9' },
  ]
  state.jawaban = 'B'
  return state
}

/** State menjodohkan valid. */
function stateMenjodohkan() {
  const state = stateSoalKosong()
  state.subject_id = '3'
  state.tipe = TIPE.menjodohkan
  state.teks = 'Jodohkan hasil dengan operasinya.'
  state.kiri = [
    { id: 'K1', teks: '4 + 5' },
    { id: 'K2', teks: '3 + 3' },
  ]
  state.kanan = [
    { id: 'N1', teks: '6' },
    { id: 'N2', teks: '9' },
  ]
  state.pasangan = { K1: 'N2', K2: 'N1' }
  return state
}

/** State mengurutkan valid. */
function stateMengurutkan() {
  const state = stateSoalKosong()
  state.subject_id = '3'
  state.tipe = TIPE.mengurutkan
  state.teks = 'Urutkan dari yang terkecil.'
  state.item = [
    { id: 'I1', teks: '9', posisi: '3' },
    { id: 'I2', teks: '2', posisi: '1' },
    { id: 'I3', teks: '5', posisi: '2' },
  ]
  return state
}

describe('validasiSoal', () => {
  it('menerima soal objektif yang lengkap', () => {
    expect(validasiSoal(statePilihanGanda())).toEqual([])
    expect(validasiSoal(stateMenjodohkan())).toEqual([])
    expect(validasiSoal(stateMengurutkan())).toEqual([])
  })

  it('menolak soal yang belum diisi mapel, teks, dan opsinya', () => {
    const galat = validasiSoal(stateSoalKosong())

    expect(galat).toContain('Pilih mapel dulu.')
    expect(galat).toContain('Isi soal wajib diisi.')
    expect(galat).toContain('Setiap opsi wajib punya teks.')
  })

  it('menolak skor di luar 1 sampai 100', () => {
    const state = statePilihanGanda()
    state.skor = '0'
    expect(validasiSoal(state)).toContain('Skor harus angka 1 sampai 100.')

    state.skor = '120'
    expect(validasiSoal(state)).toContain('Skor harus angka 1 sampai 100.')
  })

  it('menolak kunci pilihan ganda yang tidak menunjuk opsi mana pun', () => {
    const state = statePilihanGanda()
    state.jawaban = 'Z'
    expect(validasiSoal(state)).toContain('Tandai satu opsi sebagai kunci jawaban.')
  })

  it('menolak menjodohkan yang belum lengkap pasangannya', () => {
    const state = stateMenjodohkan()
    state.pasangan = { K1: 'N1' }
    expect(validasiSoal(state)).toContain('Setiap item kiri wajib punya pasangan di kunci.')
  })

  it('menolak mengurutkan dengan nomor kembar', () => {
    const state = stateMengurutkan()
    state.item[1].posisi = '3'
    expect(validasiSoal(state)).toContain(
      'Isi nomor urut benar untuk setiap item (1 sampai jumlah item, tanpa angka kembar).',
    )
  })

  it('menolak tipe esai yang belum didukung', () => {
    const state = statePilihanGanda()
    state.tipe = TIPE.uraian
    expect(validasiSoal(state)[0]).toContain('baru mendukung soal objektif')
  })
})

describe('builder konten & kunci', () => {
  it('memangkas spasi dan membuang media/MathML kosong', () => {
    const state = statePilihanGanda()
    state.teks = '  Berapa hasil 4 + 5?  '
    state.media = '   '

    const konten = kontenDariState(state)

    expect(konten.teks).toBe('Berapa hasil 4 + 5?')
    expect(konten).not.toHaveProperty('media')
    expect(konten).not.toHaveProperty('matematika')
    expect(konten.opsi).toEqual([
      { id: 'A', teks: '8' },
      { id: 'B', teks: '9' },
    ])
  })

  it('menyusun kunci sesuai tipe', () => {
    expect(kunciDariState(statePilihanGanda())).toEqual({ jawaban: 'B' })

    const benarSalah = stateSoalKosong()
    benarSalah.tipe = TIPE.benarSalah
    benarSalah.benar = false
    expect(kunciDariState(benarSalah)).toEqual({ benar: false })

    expect(kunciDariState(stateMenjodohkan())).toEqual({ pasangan: { K1: 'N2', K2: 'N1' } })
    expect(kunciDariState(stateMengurutkan())).toEqual({ urutan: ['I2', 'I3', 'I1'] })
  })

  it('urutanDariItem mengabaikan urutan penulisan item', () => {
    const item = [
      { id: 'a', teks: '', posisi: '2' },
      { id: 'b', teks: '', posisi: '1' },
    ]
    expect(urutanDariItem(item)).toEqual(['b', 'a'])
  })
})

describe('stateDariSoal', () => {
  it('membuka soal pilihan ganda tersimpan', () => {
    const state = stateDariSoal({
      id: 7,
      subject_id: 3,
      tag_id: null,
      tipe: 'pilihan_ganda',
      konten: {
        teks: 'Berapa hasil 4 + 5?',
        opsi: [
          { id: 'A', teks: '8' },
          { id: 'B', teks: '9' },
        ],
      },
      kunci: { jawaban: 'B' },
      pembahasan: 'Jumlahkan dulu.',
      skor: 5,
      aktif: false,
    })

    expect(state.id).toBe(7)
    expect(state.subject_id).toBe('3')
    expect(state.tag_id).toBe('')
    expect(state.jawaban).toBe('B')
    expect(state.skor).toBe('5')
    expect(state.aktif).toBe(false)
    expect(state.pembahasan).toBe('Jumlahkan dulu.')
  })

  it('mengubah kunci urutan menjadi posisi tiap item', () => {
    const state = stateDariSoal({
      id: 9,
      subject_id: 3,
      tag_id: null,
      tipe: 'mengurutkan',
      konten: {
        teks: 'Urutkan.',
        item: [
          { id: 'I1', teks: '9' },
          { id: 'I2', teks: '2' },
        ],
      },
      kunci: { urutan: ['I2', 'I1'] },
      pembahasan: null,
      skor: 10,
      aktif: true,
    })

    expect(state.item.map((satu) => satu.posisi)).toEqual(['2', '1'])
  })
})

describe('skemaTagForm', () => {
  it('menerima nama tag yang wajar', () => {
    expect(skemaTagForm.parse({ nama: ' Operasi Hitung ', deskripsi: '' }).nama).toBe('Operasi Hitung')
  })

  it('menolak nama tag terlalu pendek', () => {
    expect(() => skemaTagForm.parse({ nama: 'A' })).toThrow()
  })
})
