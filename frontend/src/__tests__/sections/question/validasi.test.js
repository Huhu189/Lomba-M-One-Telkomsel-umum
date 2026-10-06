import { describe, expect, it } from 'vitest'
import {
  TIPE,
  kontenDariState,
  kunciDariState,
  pisahKata,
  sinonimUraianDariTeks,
  stateDariSoal,
  stateSoalKosong,
  teksDariSinonimUraian,
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

/** State letak kata valid. */
function stateLetakKata() {
  const state = stateSoalKosong()
  state.subject_id = '3'
  state.tipe = TIPE.letakKata
  state.teks = 'Letakkan kata pada posisi yang tepat.'
  state.kata = [
    { id: 'W1', teks: 'kucing' },
    { id: 'W2', teks: 'berlari' },
  ]
  state.posisi = [
    { id: 'P1', teks: 'Subjek' },
    { id: 'P2', teks: 'Predikat' },
  ]
  state.penempatan = { W1: 'P1', W2: 'P2' }
  return state
}

/** State hubung kata valid. */
function stateHubungKata() {
  const state = stateSoalKosong()
  state.subject_id = '3'
  state.tipe = TIPE.hubungKata
  state.teks = 'Hubungkan kata dengan pasangannya.'
  state.kiri = [
    { id: 'K1', teks: 'besar' },
    { id: 'K2', teks: 'panas' },
  ]
  state.kanan = [
    { id: 'N1', teks: 'kecil' },
    { id: 'N2', teks: 'dingin' },
  ]
  state.sambungan = { K1: 'N1', K2: 'N2' }
  return state
}

/** State isian singkat valid. */
function stateIsianSingkat() {
  const state = stateSoalKosong()
  state.subject_id = '3'
  state.tipe = TIPE.isianSingkat
  state.teks = 'Berapa hasil 4 + 5?'
  state.jawabanBaku = [{ teks: '9', sinonim: 'sembilan' }]
  return state
}

/** State uraian valid. */
function stateUraian() {
  const state = stateSoalKosong()
  state.subject_id = '3'
  state.tipe = TIPE.uraian
  state.teks = 'Jelaskan cara menjumlahkan dua bilangan.'
  state.kataKunci = [{ teks: 'jumlah', bobot: '' }]
  return state
}

describe('validasiSoal', () => {
  it('menerima soal objektif yang lengkap', () => {
    expect(validasiSoal(statePilihanGanda())).toEqual([])
    expect(validasiSoal(stateMenjodohkan())).toEqual([])
    expect(validasiSoal(stateMengurutkan())).toEqual([])
    expect(validasiSoal(stateLetakKata())).toEqual([])
    expect(validasiSoal(stateHubungKata())).toEqual([])
  })

  it('menerima soal bertingkat isian singkat dan uraian', () => {
    expect(validasiSoal(stateIsianSingkat())).toEqual([])
    expect(validasiSoal(stateUraian())).toEqual([])
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

  it('menolak letak kata tanpa penempatan lengkap', () => {
    const state = stateLetakKata()
    state.penempatan = { W1: 'P1' }
    expect(validasiSoal(state)).toContain('Setiap kata wajib punya posisi di kunci.')

    state.penempatan = { W1: 'P1', W2: 'PX' }
    expect(validasiSoal(state)).toContain('Ada penempatan yang menunjuk posisi tak dikenal.')
  })

  it('menolak hubung kata yang belum lengkap sambungannya', () => {
    const state = stateHubungKata()
    state.sambungan = { K1: 'N1' }
    expect(validasiSoal(state)).toContain('Setiap item kiri wajib punya pasangan di kunci.')
  })

  it('menolak isian singkat tanpa jawaban baku', () => {
    const state = stateIsianSingkat()
    state.jawabanBaku = [{ teks: '   ', sinonim: '' }]
    expect(validasiSoal(state)).toContain('Setiap jawaban baku wajib berupa teks.')
  })

  it('menolak ambang kemiripan di luar 0 sampai 1', () => {
    const state = stateIsianSingkat()
    state.ambang = '1.5'
    expect(validasiSoal(state)[0]).toContain('Ambang kemiripan isian')

    state.ambang = ''
    expect(validasiSoal(state)).toEqual([])
  })

  it('menolak uraian tanpa kata kunci dan bobot bukan angka positif', () => {
    const kosong = stateUraian()
    kosong.kataKunci = []
    expect(validasiSoal(kosong)).toContain('Uraian wajib punya minimal satu kata kunci.')

    const bobotSalah = stateUraian()
    bobotSalah.kataKunci = [{ teks: 'jumlah', bobot: '0' }]
    expect(validasiSoal(bobotSalah)).toContain('Bobot kata kunci wajib bilangan lebih dari 0.')
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

  it('menyusun konten letak kata tanpa kunci penempatan ikut pada konten', () => {
    const state = stateLetakKata()

    expect(kontenDariState(state)).toEqual({
      teks: 'Letakkan kata pada posisi yang tepat.',
      kata: [
        { id: 'W1', teks: 'kucing' },
        { id: 'W2', teks: 'berlari' },
      ],
      posisi: [
        { id: 'P1', teks: 'Subjek' },
        { id: 'P2', teks: 'Predikat' },
      ],
    })
    expect(kunciDariState(state)).toEqual({ penempatan: { W1: 'P1', W2: 'P2' } })
  })

  it('menyusun konten dan kunci hubung kata', () => {
    const state = stateHubungKata()

    expect(kontenDariState(state).kiri).toEqual([
      { id: 'K1', teks: 'besar' },
      { id: 'K2', teks: 'panas' },
    ])
    expect(kunciDariState(state)).toEqual({ sambungan: { K1: 'N1', K2: 'N2' } })
  })

  it('menyusun kunci isian singkat dengan sinonim dan ambang', () => {
    const state = stateIsianSingkat()

    expect(kunciDariState(state)).toEqual({
      jawaban_baku: ['9'],
      sinonim: [['sembilan']],
      ambang: 0.8,
    })

    state.angkaPersis = false
    state.negasi = 'bukan, tidak'
    state.ambang = ''
    expect(kunciDariState(state)).toEqual({
      jawaban_baku: ['9'],
      sinonim: [['sembilan']],
      angka_persis: false,
      negasi: ['bukan', 'tidak'],
    })
  })

  it('menyusun kunci uraian dengan bobot opsional dan sinonim', () => {
    const state = stateUraian()
    expect(kunciDariState(state)).toEqual({ kata_kunci: [{ teks: 'jumlah' }], ambang_lulus: 0.6 })

    state.kataKunci = [
      { teks: 'jumlah', bobot: '2' },
      { teks: 'hasil', bobot: '' },
    ]
    state.sinonimUraian = 'jumlah = tambah, total'
    expect(kunciDariState(state)).toEqual({
      kata_kunci: [{ teks: 'jumlah', bobot: 2 }, { teks: 'hasil' }],
      ambang_lulus: 0.6,
      sinonim: { jumlah: ['tambah', 'total'] },
    })
  })
})

describe('bantuan teks', () => {
  it('pisahKata memangkas spasi dan membuang bagian kosong', () => {
    expect(pisahKata(' sembilan , 9 , ')).toEqual(['sembilan', '9'])
    expect(pisahKata('')).toEqual([])
  })

  it('sinonimUraianDariTeks bolak-balik dengan teksDariSinonimUraian', () => {
    const peta = sinonimUraianDariTeks('jumlah = tambah, total\nhasil = jawaban')
    expect(peta).toEqual({ jumlah: ['tambah', 'total'], hasil: ['jawaban'] })
    expect(teksDariSinonimUraian(peta)).toBe('jumlah = tambah, total\nhasil = jawaban')

    expect(sinonimUraianDariTeks('baris tanpa pemisah')).toEqual({})
    expect(teksDariSinonimUraian(null)).toBe('')
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

  it('membuka soal isian singkat beserta sinonim, ambang, dan negasinya', () => {
    const state = stateDariSoal({
      id: 11,
      subject_id: 3,
      tag_id: null,
      tipe: 'isian_singkat',
      konten: { teks: 'Berapa hasil 4 + 5?' },
      kunci: { jawaban_baku: ['9'], sinonim: [['sembilan']], ambang: 0.9, angka_persis: false, negasi: ['bukan'] },
      pembahasan: null,
      skor: 4,
      aktif: true,
    })

    expect(state.jawabanBaku).toEqual([{ teks: '9', sinonim: 'sembilan' }])
    expect(state.ambang).toBe('0.9')
    expect(state.angkaPersis).toBe(false)
    expect(state.negasi).toBe('bukan')
  })

  it('membuka soal uraian beserta kata kunci berbobot', () => {
    const state = stateDariSoal({
      id: 12,
      subject_id: 3,
      tag_id: null,
      tipe: 'uraian',
      konten: { teks: 'Jelaskan.' },
      kunci: {
        kata_kunci: [{ teks: 'jumlah', bobot: 2 }, { teks: 'hasil' }],
        ambang_lulus: 0.5,
        sinonim: { jumlah: ['tambah'] },
      },
      pembahasan: null,
      skor: 10,
      aktif: true,
    })

    expect(state.kataKunci).toEqual([
      { teks: 'jumlah', bobot: '2' },
      { teks: 'hasil', bobot: '' },
    ])
    expect(state.ambangLulus).toBe('0.5')
    expect(state.sinonimUraian).toBe('jumlah = tambah')
  })

  it('membuka soal letak kata dan hubung kata apa adanya', () => {
    const letak = stateDariSoal({
      id: 13,
      subject_id: 3,
      tag_id: null,
      tipe: 'letak_kata',
      konten: {
        teks: 'Letakkan.',
        kata: [{ id: 'W1', teks: 'kucing' }],
        posisi: [{ id: 'P1', teks: 'Subjek' }],
      },
      kunci: { penempatan: { W1: 'P1' } },
      pembahasan: null,
      skor: 5,
      aktif: true,
    })

    expect(letak.kata).toEqual([{ id: 'W1', teks: 'kucing' }])
    expect(letak.penempatan).toEqual({ W1: 'P1' })

    const hubung = stateDariSoal({
      id: 14,
      subject_id: 3,
      tag_id: null,
      tipe: 'hubung_kata',
      konten: {
        teks: 'Hubungkan.',
        kiri: [{ id: 'K1', teks: 'besar' }],
        kanan: [{ id: 'N1', teks: 'kecil' }],
      },
      kunci: { sambungan: { K1: 'N1' } },
      pembahasan: null,
      skor: 5,
      aktif: true,
    })

    expect(hubung.kanan).toEqual([{ id: 'N1', teks: 'kecil' }])
    expect(hubung.sambungan).toEqual({ K1: 'N1' })
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
