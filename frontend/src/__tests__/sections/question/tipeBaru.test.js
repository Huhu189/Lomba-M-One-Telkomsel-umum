import { describe, expect, it } from 'vitest'
import {
  TIPE,
  kontenDariState,
  kunciDariState,
  stateDariSoal,
  stateSoalKosong,
} from '../../../sections/question/tipeSoal.js'
import {
  skemaBacaJamKunci,
  skemaBenarSalahMajemukKunci,
  skemaGarisBilanganKunci,
  skemaHotspotGambarKunci,
  skemaIsianAngkaKunci,
  skemaIsianRumpangKunci,
  skemaKlasifikasiKunci,
  skemaPilihanGambarKunci,
  skemaPilihanGandaKompleksKunci,
  skemaSusunHurufKunci,
  skemaTabelIsianKunci,
  skemaTekaSilangMiniKunci,
  skemaTugasUnggahKunci,
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

describe('isian rumpang', () => {
  /** @param {ReturnType<typeof dasar>} state */
  function isiRumpang(state) {
    state.teks = 'Ibu kota Indonesia adalah {{1}} dan 4 x 5 = {{2}}.'
    state.lubang = { 1: 'Jakarta', 2: '20' }
    return state
  }

  it('menyimpan penanda pada teks dan kunci per lubang', () => {
    const state = isiRumpang(dasar(TIPE.isianRumpang))

    expect(kontenDariState(state)).toEqual({
      teks: 'Ibu kota Indonesia adalah {{1}} dan 4 x 5 = {{2}}.',
    })
    expect(kunciDariState(state)).toEqual({ lubang: { 1: ['Jakarta'], 2: ['20'] } })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menerima beberapa jawaban diterima dalam satu lubang', () => {
    const state = isiRumpang(dasar(TIPE.isianRumpang))
    state.lubang = { 1: 'Jakarta, DKI Jakarta', 2: '20' }

    expect(kunciDariState(state)).toEqual({
      lubang: { 1: ['Jakarta', 'DKI Jakarta'], 2: ['20'] },
    })
    expect(validasiSoal(state)).toEqual([])
    expect(skemaIsianRumpangKunci.safeParse(kunciDariState(state)).success).toBe(true)
  })

  it('menolak teks tanpa penanda, penanda melompat, dan lubang tanpa jawaban', () => {
    const tanpaPenanda = isiRumpang(dasar(TIPE.isianRumpang))
    tanpaPenanda.teks = 'Tidak ada penanda di sini.'
    expect(validasiSoal(tanpaPenanda).length).toBeGreaterThan(0)

    const melompat = isiRumpang(dasar(TIPE.isianRumpang))
    melompat.teks = 'Isi {{1}} lalu {{3}}.'
    melompat.lubang = { 1: 'a', 3: 'b' }
    expect(validasiSoal(melompat).length).toBeGreaterThan(0)

    const kosong = isiRumpang(dasar(TIPE.isianRumpang))
    kosong.lubang = { 1: 'Jakarta', 2: '' }
    expect(validasiSoal(kosong).length).toBeGreaterThan(0)

    expect(skemaIsianRumpangKunci.safeParse({ lubang: { 1: [] } }).success).toBe(false)
    expect(skemaIsianRumpangKunci.safeParse({ lubang: { 1: ['', '  '] } }).success).toBe(false)
  })

  it('membuka kembali lubang dari soal tersimpan', () => {
    const state = stateDariSoal({
      id: 20,
      subject_id: 3,
      tag_id: null,
      tipe: 'isian_rumpang',
      konten: { teks: 'Hasil 2 + 2 adalah {{1}}.' },
      kunci: { lubang: { 1: ['4', 'empat'] } },
      pembahasan: null,
      skor: 5,
      aktif: true,
    })

    expect(state.lubang).toEqual({ 1: '4, empat' })
    expect(kunciDariState(state)).toEqual({ lubang: { 1: ['4', 'empat'] } })
    expect(validasiSoal(state)).toEqual([])
  })
})

describe('klasifikasi', () => {
  /** @param {ReturnType<typeof dasar>} state */
  function isiKlasifikasi(state) {
    state.teks = 'Kelompokkan hewan berikut.'
    state.itemKlasifikasi = [
      { id: 'I1', teks: 'kucing' },
      { id: 'I2', teks: 'ayam' },
    ]
    state.kotak = [
      { id: 'K1', teks: 'Mamalia' },
      { id: 'K2', teks: 'Unggas' },
    ]
    state.petaKlasifikasi = { I1: 'K1', I2: 'K2' }
    return state
  }

  it('menyusun item, kotak berlabel, dan kunci peta', () => {
    const state = isiKlasifikasi(dasar(TIPE.klasifikasi))

    expect(kontenDariState(state)).toEqual({
      teks: 'Kelompokkan hewan berikut.',
      item: [
        { id: 'I1', teks: 'kucing' },
        { id: 'I2', teks: 'ayam' },
      ],
      kotak: [
        { id: 'K1', label: 'Mamalia' },
        { id: 'K2', label: 'Unggas' },
      ],
    })
    expect(kunciDariState(state)).toEqual({ peta: { I1: 'K1', I2: 'K2' } })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menolak item tanpa kotak, kotak ganda, dan kotak tak dikenal', () => {
    const belumLengkap = isiKlasifikasi(dasar(TIPE.klasifikasi))
    belumLengkap.petaKlasifikasi = { I1: 'K1' }
    expect(validasiSoal(belumLengkap).length).toBeGreaterThan(0)

    const kotakAsing = isiKlasifikasi(dasar(TIPE.klasifikasi))
    kotakAsing.petaKlasifikasi = { I1: 'K9', I2: 'K2' }
    expect(validasiSoal(kotakAsing).length).toBeGreaterThan(0)

    const labelKosong = isiKlasifikasi(dasar(TIPE.klasifikasi))
    labelKosong.kotak = [
      { id: 'K1', teks: 'Mamalia' },
      { id: 'K2', teks: '' },
    ]
    expect(validasiSoal(labelKosong).length).toBeGreaterThan(0)

    expect(skemaKlasifikasiKunci.safeParse({ peta: { I1: 'K1', I2: '' } }).success).toBe(false)
    expect(skemaKlasifikasiKunci.safeParse({ peta: { I1: 'K1' } }).success).toBe(true)
  })

  it('membuka kembali item, kotak, dan peta dari soal tersimpan', () => {
    const state = stateDariSoal({
      id: 21,
      subject_id: 3,
      tag_id: null,
      tipe: 'klasifikasi',
      konten: {
        teks: 'Kelompokkan.',
        item: [{ id: 'I1', teks: 'kucing' }],
        kotak: [{ id: 'K1', label: 'Mamalia' }],
      },
      kunci: { peta: { I1: 'K1' } },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    expect(state.itemKlasifikasi).toEqual([{ id: 'I1', teks: 'kucing' }])
    expect(state.kotak).toEqual([{ id: 'K1', teks: 'Mamalia' }])
    expect(state.petaKlasifikasi).toEqual({ I1: 'K1' })
  })
})

describe('tabel isian', () => {
  /** @param {ReturnType<typeof dasar>} state */
  function isiTabel(state) {
    state.teks = 'Isi tabel hasil perkalian.'
    state.kolom = 'Soal, Hasil'
    state.barisTabel = [
      {
        id: 'R1',
        sel: [
          { kode: 'r1c1', teks: '3 x 4' },
          { kode: 'r1c2', teks: '' },
        ],
      },
    ]
    state.kunciSel = { r1c2: '12, dua belas' }
    return state
  }

  it('menyusun kolom, baris, dan kunci hanya untuk sel kosong', () => {
    const state = isiTabel(dasar(TIPE.tabelIsian))

    expect(kontenDariState(state)).toEqual({
      teks: 'Isi tabel hasil perkalian.',
      kolom: ['Soal', 'Hasil'],
      baris: [
        {
          id: 'R1',
          sel: [{ kode: 'r1c1', teks: '3 x 4' }, { kode: 'r1c2' }],
        },
      ],
    })
    expect(kunciDariState(state)).toEqual({ sel: { r1c2: ['12', 'dua belas'] } })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menolak tabel tanpa kolom, kode kembar, dan sel kosong tanpa jawaban', () => {
    const tanpaKolom = isiTabel(dasar(TIPE.tabelIsian))
    tanpaKolom.kolom = ''
    expect(validasiSoal(tanpaKolom).length).toBeGreaterThan(0)

    const kodeKembar = isiTabel(dasar(TIPE.tabelIsian))
    kodeKembar.barisTabel = [
      {
        id: 'R1',
        sel: [
          { kode: 'r1c1', teks: '3 x 4' },
          { kode: 'r1c1', teks: '' },
        ],
      },
    ]
    kodeKembar.kunciSel = { r1c1: '12' }
    expect(validasiSoal(kodeKembar).length).toBeGreaterThan(0)

    const tanpaJawaban = isiTabel(dasar(TIPE.tabelIsian))
    tanpaJawaban.kunciSel = {}
    expect(validasiSoal(tanpaJawaban).length).toBeGreaterThan(0)

    expect(skemaTabelIsianKunci.safeParse({ sel: { r1c2: [] } }).success).toBe(false)
    expect(skemaTabelIsianKunci.safeParse({ sel: { r1c2: ['12'] } }).success).toBe(true)
  })

  it('membuka kembali kolom, baris, dan kunci sel dari soal tersimpan', () => {
    const state = stateDariSoal({
      id: 22,
      subject_id: 3,
      tag_id: null,
      tipe: 'tabel_isian',
      konten: {
        teks: 'Isi tabel.',
        kolom: ['Soal', 'Hasil'],
        baris: [
          { id: 'R1', sel: [{ kode: 'r1c1', teks: '3 x 4' }, { kode: 'r1c2' }] },
        ],
      },
      kunci: { sel: { r1c2: ['12'] } },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    expect(state.kolom).toBe('Soal, Hasil')
    expect(state.barisTabel).toEqual([
      { id: 'R1', sel: [{ kode: 'r1c1', teks: '3 x 4' }, { kode: 'r1c2', teks: '' }] },
    ])
    expect(state.kunciSel).toEqual({ r1c2: '12' })
    expect(validasiSoal(state)).toEqual([])
  })
})

describe('garis bilangan', () => {
  /** @param {ReturnType<typeof dasar>} state */
  function isiGaris(state) {
    state.teks = 'Tandai bilangan 7 pada garis bilangan.'
    state.garisMin = '0'
    state.garisMax = '10'
    state.garisLangkah = '1'
    state.garisNilai = '7'
    state.garisToleransi = '0'
    return state
  }

  it('menyusun rentang angka dan kunci nilai + toleransi', () => {
    const state = isiGaris(dasar(TIPE.garisBilangan))

    expect(kontenDariState(state)).toEqual({
      teks: 'Tandai bilangan 7 pada garis bilangan.',
      min: 0,
      max: 10,
      langkah: 1,
    })
    expect(kunciDariState(state)).toEqual({ nilai: 7, toleransi: 0 })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menerima toleransi desimal dan menolak rentang terbalik atau nilai di luar rentang', () => {
    const bertoleransi = isiGaris(dasar(TIPE.garisBilangan))
    bertoleransi.garisNilai = '6.5'
    bertoleransi.garisToleransi = '0.5'
    expect(kunciDariState(bertoleransi)).toEqual({ nilai: 6.5, toleransi: 0.5 })
    expect(validasiSoal(bertoleransi)).toEqual([])

    const terbalik = isiGaris(dasar(TIPE.garisBilangan))
    terbalik.garisMin = '10'
    terbalik.garisMax = '0'
    expect(validasiSoal(terbalik).length).toBeGreaterThan(0)

    const diLuar = isiGaris(dasar(TIPE.garisBilangan))
    diLuar.garisNilai = '20'
    expect(validasiSoal(diLuar).length).toBeGreaterThan(0)

    const tanpaLangkah = isiGaris(dasar(TIPE.garisBilangan))
    tanpaLangkah.garisLangkah = '0'
    expect(validasiSoal(tanpaLangkah).length).toBeGreaterThan(0)

    expect(skemaGarisBilanganKunci.safeParse({ nilai: 7, toleransi: -1 }).success).toBe(false)
    expect(skemaGarisBilanganKunci.safeParse({ nilai: 7, toleransi: 0.5 }).success).toBe(true)
  })

  it('membuka kembali rentang dan kunci dari soal tersimpan', () => {
    const state = stateDariSoal({
      id: 23,
      subject_id: 3,
      tag_id: null,
      tipe: 'garis_bilangan',
      konten: { teks: 'Tandai.', min: 0, max: 20, langkah: 2 },
      kunci: { nilai: 12, toleransi: 0.5 },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    expect(state.garisMin).toBe('0')
    expect(state.garisMax).toBe('20')
    expect(state.garisLangkah).toBe('2')
    expect(state.garisNilai).toBe('12')
    expect(state.garisToleransi).toBe('0.5')
    expect(validasiSoal(state)).toEqual([])
  })
})

describe('hotspot gambar', () => {
  /** @param {ReturnType<typeof dasar>} state */
  function isiHotspot(state) {
    state.teks = 'Ketuk gambar lingkaran.'
    state.media = '/media/bentuk.png'
    state.areaHotspot = [
      { id: 'A1', x: '5', y: '10', w: '20', h: '30' },
      { id: 'A2', x: '40', y: '10', w: '20', h: '30' },
    ]
    state.benarHotspot = ['A2']
    return state
  }

  it('mengubah persen editor menjadi koordinat 0–1', () => {
    const state = isiHotspot(dasar(TIPE.hotspotGambar))

    expect(kontenDariState(state).area).toEqual([
      { id: 'A1', x: 0.05, y: 0.1, w: 0.2, h: 0.3 },
      { id: 'A2', x: 0.4, y: 0.1, w: 0.2, h: 0.3 },
    ])
    expect(kunciDariState(state)).toEqual({ area_benar: ['A2'] })
    expect(validasiSoal(state)).toEqual([])
    expect(skemaHotspotGambarKunci.safeParse(kunciDariState(state)).success).toBe(true)
  })

  it('menolak hotspot tanpa gambar, area keluar bidang, dan tanpa kunci', () => {
    const tanpaGambar = isiHotspot(dasar(TIPE.hotspotGambar))
    tanpaGambar.media = ''
    expect(validasiSoal(tanpaGambar).length).toBeGreaterThan(0)

    const keluar = isiHotspot(dasar(TIPE.hotspotGambar))
    keluar.areaHotspot = [{ id: 'A1', x: '90', y: '10', w: '30', h: '30' }]
    keluar.benarHotspot = ['A1']
    expect(validasiSoal(keluar).length).toBeGreaterThan(0)

    const tanpaKunci = isiHotspot(dasar(TIPE.hotspotGambar))
    tanpaKunci.benarHotspot = []
    expect(validasiSoal(tanpaKunci).length).toBeGreaterThan(0)
    expect(skemaHotspotGambarKunci.safeParse({ area_benar: [] }).success).toBe(false)
  })

  it('membuka kembali area dan kunci dari soal tersimpan', () => {
    const state = stateDariSoal({
      id: 40,
      subject_id: 3,
      tag_id: null,
      tipe: 'hotspot_gambar',
      konten: {
        teks: 'Ketuk.',
        media: '/media/bentuk.png',
        area: [{ id: 'a1', x: 0.25, y: 0.5, w: 0.1, h: 0.1 }],
      },
      kunci: { area_benar: ['a1'] },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    expect(state.areaHotspot).toEqual([{ id: 'a1', x: '25', y: '50', w: '10', h: '10' }])
    expect(state.benarHotspot).toEqual(['a1'])
    expect(validasiSoal(state)).toEqual([])
  })
})

describe('baca jam', () => {
  it('menyusun kunci jam dan menit sebagai angka', () => {
    const state = dasar(TIPE.bacaJam)
    state.teks = 'Tunjukkan pukul setengah delapan.'
    state.jamJam = '7'
    state.jamMenit = '30'

    expect(kontenDariState(state).teks).toBe('Tunjukkan pukul setengah delapan.')
    expect(kontenDariState(state)).not.toHaveProperty('jam')
    expect(kunciDariState(state)).toEqual({ jam: 7, menit: 30 })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menolak jam di luar 0–11 dan menit di luar 0–59', () => {
    const state = dasar(TIPE.bacaJam)
    state.teks = 'Tunjukkan pukul berapa.'
    state.jamJam = '12'
    expect(validasiSoal(state).length).toBeGreaterThan(0)

    state.jamJam = '7'
    state.jamMenit = '60'
    expect(validasiSoal(state).length).toBeGreaterThan(0)

    expect(skemaBacaJamKunci.safeParse({ jam: 7, menit: 30 }).success).toBe(true)
    expect(skemaBacaJamKunci.safeParse({ jam: 7, menit: 30.5 }).success).toBe(false)
    expect(skemaBacaJamKunci.safeParse({ jam: 13, menit: 0 }).success).toBe(false)
  })

  it('membuka kembali waktu dari soal tersimpan', () => {
    const state = stateDariSoal({
      id: 41,
      subject_id: 3,
      tag_id: null,
      tipe: 'baca_jam',
      konten: { teks: 'Tunjukkan pukul berapa.' },
      kunci: { jam: 0, menit: 15 },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    expect(state.jamJam).toBe('0')
    expect(state.jamMenit).toBe('15')
    expect(validasiSoal(state)).toEqual([])
  })
})

describe('tugas unggah', () => {
  it('menyusun konten jenis berkas dan kunci rubrik bernilai angka', () => {
    const state = dasar(TIPE.tugasUnggah)
    state.teks = 'Unggah foto pekerjaanmu.'
    state.jenisBerkas = 'Foto JPG atau PNG'
    state.rubrik = [
      { butir: 'Langkah lengkap', poin: '3' },
      { butir: 'Hasil benar', poin: '2' },
    ]

    expect(kontenDariState(state).jenis_berkas).toBe('Foto JPG atau PNG')
    expect(kunciDariState(state)).toEqual({
      rubrik: [
        { butir: 'Langkah lengkap', poin: 3 },
        { butir: 'Hasil benar', poin: 2 },
      ],
    })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menolak jenis berkas kosong dan poin rubrik nol', () => {
    const state = dasar(TIPE.tugasUnggah)
    state.teks = 'Unggah foto.'
    state.jenisBerkas = ''
    expect(validasiSoal(state).length).toBeGreaterThan(0)

    state.jenisBerkas = 'Foto'
    state.rubrik = [{ butir: 'Rapi', poin: '0' }]
    expect(validasiSoal(state).length).toBeGreaterThan(0)

    expect(skemaTugasUnggahKunci.safeParse({ rubrik: [{ butir: 'Rapi', poin: 0 }] }).success).toBe(false)
    expect(skemaTugasUnggahKunci.safeParse({ rubrik: [{ butir: 'Rapi', poin: 1 }] }).success).toBe(true)
  })

  it('membuka kembali rubrik dari soal tersimpan', () => {
    const state = stateDariSoal({
      id: 42,
      subject_id: 3,
      tag_id: null,
      tipe: 'tugas_unggah',
      konten: { teks: 'Unggah foto.', jenis_berkas: 'Foto JPG' },
      kunci: { rubrik: [{ butir: 'Langkah lengkap', poin: 3 }] },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    expect(state.jenisBerkas).toBe('Foto JPG')
    expect(state.rubrik).toEqual([{ butir: 'Langkah lengkap', poin: '3' }])
    expect(validasiSoal(state)).toEqual([])
  })
})

describe('teka silang mini', () => {
  /** @param {ReturnType<typeof dasar>} state */
  function isiSilang(state) {
    state.teks = 'Isi teka silang berikut.'
    state.gridSilang = 'kat\n#i#'
    state.petunjukSilang = [
      { arah: 'mendatar', nomor: '1', teks: 'Nama hewan mengeong.', mulai: '0,0', panjang: '3' },
      { arah: 'menurun', nomor: '2', teks: 'Ada di tengah.', mulai: '0,1', panjang: '2' },
    ]
    return state
  }

  it('memisahkan bentuk grid dari huruf jawaban', () => {
    const state = isiSilang(dasar(TIPE.tekaSilangMini))
    const konten = kontenDariState(state)

    expect(konten.grid).toEqual([['', '', ''], ['#', '', '#']])
    expect(konten.mendatar).toEqual([
      { nomor: 1, teks: 'Nama hewan mengeong.', sel: ['0,0', '0,1', '0,2'] },
    ])
    expect(konten.menurun).toEqual([{ nomor: 2, teks: 'Ada di tengah.', sel: ['0,1', '1,1'] }])
    // Bentuk kotak tidak memuat satu huruf jawaban pun.
    expect(JSON.stringify(konten.grid)).toBe('[["","",""],["#","","#"]]')
    expect(kunciDariState(state)).toEqual({
      sel: { '0,0': 'k', '0,1': 'a', '0,2': 't', '1,1': 'i' },
    })
    expect(validasiSoal(state)).toEqual([])
  })

  it('menolak grid tak rata dan kotak yang belum diberi huruf', () => {
    const takRata = isiSilang(dasar(TIPE.tekaSilangMini))
    takRata.gridSilang = 'kat\n#i'
    expect(validasiSoal(takRata).length).toBeGreaterThan(0)

    const belumDiisi = isiSilang(dasar(TIPE.tekaSilangMini))
    belumDiisi.gridSilang = 'ka.\n#i#'
    expect(validasiSoal(belumDiisi).length).toBeGreaterThan(0)

    const hurufAsing = isiSilang(dasar(TIPE.tekaSilangMini))
    hurufAsing.gridSilang = 'ka1\n#i#'
    expect(validasiSoal(hurufAsing).length).toBeGreaterThan(0)
  })

  it('menolak petunjuk yang keluar grid, melewati kotak hitam, atau kembar nomornya', () => {
    const keluar = isiSilang(dasar(TIPE.tekaSilangMini))
    keluar.petunjukSilang = [
      { arah: 'mendatar', nomor: '1', teks: 'Terlalu panjang.', mulai: '0,0', panjang: '4' },
    ]
    expect(validasiSoal(keluar).length).toBeGreaterThan(0)

    const kotakHitam = isiSilang(dasar(TIPE.tekaSilangMini))
    kotakHitam.petunjukSilang = [
      { arah: 'menurun', nomor: '1', teks: 'Melewati kotak hitam.', mulai: '0,0', panjang: '2' },
    ]
    expect(validasiSoal(kotakHitam).length).toBeGreaterThan(0)

    const kembar = isiSilang(dasar(TIPE.tekaSilangMini))
    kembar.petunjukSilang = [
      { arah: 'mendatar', nomor: '1', teks: 'Pertama.', mulai: '0,0', panjang: '3' },
      { arah: 'mendatar', nomor: '1', teks: 'Kedua.', mulai: '1,1', panjang: '1' },
    ]
    expect(validasiSoal(kembar).length).toBeGreaterThan(0)

    expect(skemaTekaSilangMiniKunci.safeParse({ sel: { '0,0': 'k' } }).success).toBe(true)
    expect(skemaTekaSilangMiniKunci.safeParse({ sel: { '0,0': 'kk' } }).success).toBe(false)
  })

  it('membuka kembali grid berisi huruf, petunjuk, dan kuncinya', () => {
    const state = stateDariSoal({
      id: 43,
      subject_id: 3,
      tag_id: null,
      tipe: 'teka_silang_mini',
      konten: {
        teks: 'Isi teka silang.',
        grid: [['', '', ''], ['#', '', '#']],
        mendatar: [{ nomor: 1, teks: 'Nama hewan mengeong.', sel: ['0,0', '0,1', '0,2'] }],
        menurun: [{ nomor: 2, teks: 'Tengah.', sel: ['0,1', '1,1'] }],
      },
      kunci: { sel: { '0,0': 'k', '0,1': 'a', '0,2': 't', '1,1': 'i' } },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    expect(state.gridSilang).toBe('kat\n#i#')
    expect(state.petunjukSilang).toEqual([
      { arah: 'mendatar', nomor: '1', teks: 'Nama hewan mengeong.', mulai: '0,0', panjang: '3' },
      { arah: 'menurun', nomor: '2', teks: 'Tengah.', mulai: '0,1', panjang: '2' },
    ])
    expect(validasiSoal(state)).toEqual([])
  })
})
