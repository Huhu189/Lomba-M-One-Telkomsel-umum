import { describe, expect, it } from 'vitest'
import {
  TIPE,
  kontenDariState,
  kunciDariState,
  stateDariSoal,
  stateSoalKosong,
} from '../../../sections/question/tipeSoal.js'
import {
  skemaBenarSalahMajemukKunci,
  skemaIsianAngkaKunci,
  skemaPilihanGambarKunci,
  skemaPilihanGandaKompleksKunci,
  skemaSusunHurufKunci,
  skemaUrutGambarKunci,
  validasiSoal,
} from '../../../sections/question/validasi.js'

/**
 * State dasar dengan mapel terisi.
 * @param {string} tipe
 */
function dasar(tipe) {
  const state = stateSoalKosong()
  state.subject_id = '3'
  state.tipe = tipe
  return state
}

describe('pilihan ganda kompleks', () => {
  it('membangun konten opsi dan kunci daftar id', () => {
    const state = dasar(TIPE.pilihanGandaKompleks)
    state.teks = 'Centang bilangan genap.'
    state.opsi = [
      { id: 'o1', teks: '4' },
      { id: 'o2', teks: '7' },
      { id: 'o3', teks: '10' },
    ]
    state.benarKompleks = ['o1', 'o3']

    expect(kontenDariState(state).opsi).toEqual([
      { id: 'o1', teks: '4' },
      { id: 'o2', teks: '7' },
      { id: 'o3', teks: '10' },
    ])
    expect(kunciDariState(state)).toEqual({ benar: ['o1', 'o3'] })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menolak kunci kosong dan semua opsi sebagai kunci', () => {
    const state = dasar(TIPE.pilihanGandaKompleks)
    state.teks = 'Centang bilangan genap.'
    state.opsi = [
      { id: 'o1', teks: '4' },
      { id: 'o2', teks: '7' },
      { id: 'o3', teks: '10' },
    ]
    state.benarKompleks = []
    expect(validasiSoal(state).length).toBeGreaterThan(0)

    state.benarKompleks = ['o1', 'o2', 'o3']
    expect(validasiSoal(state).length).toBeGreaterThan(0)
  })

  it('skema Zod menolak kunci duplikat', () => {
    expect(skemaPilihanGandaKompleksKunci.safeParse({ benar: ['o1', 'o1'] }).success).toBe(false)
    expect(skemaPilihanGandaKompleksKunci.safeParse({ benar: ['o1', 'o2'] }).success).toBe(true)
  })
})

describe('benar/salah majemuk', () => {
  it('membangun konten pernyataan dan kunci peta boolean', () => {
    const state = dasar(TIPE.benarSalahMajemuk)
    state.teks = 'Tandai tiap pernyataan.'
    state.pernyataan = [
      { id: 'P1', teks: '1 + 1 = 2' },
      { id: 'P2', teks: '2 + 2 = 5' },
    ]
    state.kunciPernyataan = { P1: true, P2: false }

    expect(kontenDariState(state).pernyataan).toHaveLength(2)
    expect(kunciDariState(state)).toEqual({ jawaban: { P1: true, P2: false } })
    expect(validasiSoal(state)).toEqual([])
  })

  it('skema Zod menolak peta bernilai bukan boolean', () => {
    expect(skemaBenarSalahMajemukKunci.safeParse({ jawaban: { P1: 'yes' } }).success).toBe(false)
    expect(skemaBenarSalahMajemukKunci.safeParse({ jawaban: { P1: true } }).success).toBe(true)
  })
})

describe('isian angka', () => {
  it('membangun kunci angka + toleransi dan satuan opsional', () => {
    const state = dasar(TIPE.isianAngka)
    state.teks = 'Berapa hasil 12 + 9?'
    state.satuan = 'cm'
    state.angkaNilai = '21'
    state.angkaToleransi = '0,5'.replace(',', '.')

    expect(kontenDariState(state)).toEqual({ teks: 'Berapa hasil 12 + 9?', satuan: 'cm' })
    expect(kunciDariState(state)).toEqual({ nilai: 21, toleransi: 0.5 })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menolak toleransi negatif', () => {
    const state = dasar(TIPE.isianAngka)
    state.teks = 'Berapa?'
    state.angkaNilai = '10'
    state.angkaToleransi = '-1'
    expect(validasiSoal(state).length).toBeGreaterThan(0)
    expect(skemaIsianAngkaKunci.safeParse({ nilai: 10, toleransi: -1 }).success).toBe(false)
  })
})

describe('susun huruf', () => {
  it('memakai petunjuk + kata tanpa isi soal, dan tidak menyertakan teks', () => {
    const state = dasar(TIPE.susunHuruf)
    state.petunjuk = 'Nama hewan mengeong.'
    state.kataSusun = 'kucing'

    const konten = kontenDariState(state)
    expect(konten).toEqual({ petunjuk: 'Nama hewan mengeong.' })
    expect(konten).not.toHaveProperty('teks')
    expect(kunciDariState(state)).toEqual({ kata: 'kucing' })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menolak kata ber-spasi dan kata terlalu pendek', () => {
    const state = dasar(TIPE.susunHuruf)
    state.petunjuk = 'Petunjuk.'
    state.kataSusun = 'kucing oren'
    expect(validasiSoal(state).length).toBeGreaterThan(0)

    state.kataSusun = 'a'
    expect(validasiSoal(state).length).toBeGreaterThan(0)

    expect(skemaSusunHurufKunci.safeParse({ kata: 'kucing' }).success).toBe(true)
    expect(skemaSusunHurufKunci.safeParse({ kata: 'kucing oren' }).success).toBe(false)
  })

  it('boleh tanpa isi soal karena pertanyaannya petunjuk', () => {
    const state = dasar(TIPE.susunHuruf)
    state.teks = ''
    state.petunjuk = 'Petunjuk.'
    state.kataSusun = 'kucing'
    expect(validasiSoal(state)).toEqual([])
  })
})

describe('pilihan gambar', () => {
  it('membangun konten opsi media dan kunci id', () => {
    const state = dasar(TIPE.pilihanGambar)
    state.teks = 'Pilih lingkaran.'
    state.opsiGambar = [
      { id: 'G1', media: '/media/lingkaran.png' },
      { id: 'G2', media: '/media/persegi.png' },
    ]
    state.jawabanGambar = 'G1'

    expect(kontenDariState(state).opsi).toEqual([
      { id: 'G1', media: '/media/lingkaran.png' },
      { id: 'G2', media: '/media/persegi.png' },
    ])
    expect(kunciDariState(state)).toEqual({ benar: 'G1' })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menerima isi soal kosong dan menolak gambar tanpa media', () => {
    const state = dasar(TIPE.pilihanGambar)
    state.teks = ''
    state.opsiGambar = [
      { id: 'G1', media: '/media/a.png' },
      { id: 'G2', media: '/media/b.png' },
    ]
    state.jawabanGambar = 'G1'
    expect(validasiSoal(state)).toEqual([])

    state.opsiGambar = [
      { id: 'G1', media: '/media/a.png' },
      { id: 'G2', media: '' },
    ]
    expect(validasiSoal(state).length).toBeGreaterThan(0)
    expect(skemaPilihanGambarKunci.safeParse({ benar: '' }).success).toBe(false)
  })
})

describe('urut gambar', () => {
  it('membangun kunci urutan dari nomor posisi', () => {
    const state = dasar(TIPE.urutGambar)
    state.teks = 'Urutkan dari kecil.'
    state.itemGambar = [
      { id: 'U1', media: '/media/a.png', posisi: '3' },
      { id: 'U2', media: '/media/b.png', posisi: '1' },
      { id: 'U3', media: '/media/c.png', posisi: '2' },
    ]

    expect(kontenDariState(state).item).toEqual([
      { id: 'U1', media: '/media/a.png' },
      { id: 'U2', media: '/media/b.png' },
      { id: 'U3', media: '/media/c.png' },
    ])
    expect(kunciDariState(state)).toEqual({ urutan: ['U2', 'U3', 'U1'] })
    expect(validasiSoal(state)).toEqual([])
    expect(skemaUrutGambarKunci.safeParse({ urutan: ['U2', 'U3', 'U1'] }).success).toBe(true)
    expect(skemaUrutGambarKunci.safeParse({ urutan: ['U2'] }).success).toBe(false)
  })

  it('menolak nomor urut kembar', () => {
    const state = dasar(TIPE.urutGambar)
    state.teks = 'Urutkan.'
    state.itemGambar = [
      { id: 'U1', media: '/media/a.png', posisi: '1' },
      { id: 'U2', media: '/media/b.png', posisi: '1' },
    ]
    expect(validasiSoal(state).length).toBeGreaterThan(0)
  })
})

describe('muat ulang soal tersimpan (stateDariSoal)', () => {
  it('mengembalikan state pilihan ganda kompleks apa adanya', () => {
    const state = stateDariSoal({
      id: 9,
      subject_id: 3,
      tag_id: null,
      tipe: 'pilihan_ganda_kompleks',
      konten: {
        teks: 'Centang genap.',
        opsi: [
          { id: 'o1', teks: '4' },
          { id: 'o2', teks: '7' },
          { id: 'o3', teks: '10' },
        ],
      },
      kunci: { benar: ['o1', 'o3'] },
      pembahasan: '',
      skor: 5,
      aktif: true,
    })

    expect(state.benarKompleks).toEqual(['o1', 'o3'])
    expect(kunciDariState(state)).toEqual({ benar: ['o1', 'o3'] })
  })

  it('mengembalikan state susun huruf dari petunjuk + kata', () => {
    const state = stateDariSoal({
      id: 10,
      subject_id: 3,
      tag_id: null,
      tipe: 'susun_huruf',
      konten: { petunjuk: 'Nama hewan mengeong.' },
      kunci: { kata: 'kucing' },
      pembahasan: '',
      skor: 5,
      aktif: true,
    })

    expect(state.petunjuk).toBe('Nama hewan mengeong.')
    expect(state.kataSusun).toBe('kucing')
    expect(validasiSoal(state)).toEqual([])
  })
})
