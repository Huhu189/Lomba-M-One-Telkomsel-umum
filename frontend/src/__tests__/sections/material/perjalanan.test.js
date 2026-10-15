/**
 * Tes modul perjalanan materi: nama pos bawaan tema, nama yang diganti guru,
 * posisi & kenaikan tingkat, deteksi peristiwa kenaikan, dan titik jalur peta.
 *
 * Angka-angka di sini SENGAJA sama dengan Registry\TemaPerjalanan di backend
 * (fase "Mendaki Gunung" dan ambang tingkat 0/25/60/100) supaya pratinjau editor
 * tidak pernah berbeda dari peta yang dilihat murid.
 */
import { describe, expect, it } from 'vitest'
import {
  KODE_TANPA_PETA,
  MAKS_NAMA_LANGKAH,
  faseKe,
  kenaikanUntuk,
  labelPerjalanan,
  langkahLokal,
  petaLokal,
  posisiAktif,
  skemaPerjalanan,
  tanpaPeta,
  terapkanTema,
  tingkatKe,
  titikJalur,
  RUTE_TEMA,
} from '../../../sections/material/perjalanan/perjalanan.js'
import { blokBaru } from '../../../sections/material/editor/editorMateri.js'

/** Katalog tema seperti dikirim GET /api/v1/materi/tema. */
const TEMA = {
  kode: 'mendaki-gunung',
  nama: 'Mendaki Gunung',
  deskripsi: 'Naik dari basecamp ke puncak.',
  adegan: 'gunung',
  satuan: 'pos',
  fase: [
    { nama: 'Basecamp', ikon: 'tenda', warna: 'hijau' },
    { nama: 'Jalur Pinus', ikon: 'pohon', warna: 'hijau' },
    { nama: 'Sungai Deras', ikon: 'sungai', warna: 'biru' },
    { nama: 'Lereng Berbatu', ikon: 'batu', warna: 'coklat' },
    { nama: 'Kabut Puncak', ikon: 'kabut', warna: 'kelabu' },
    { nama: 'Puncak', ikon: 'bendera', warna: 'jingga' },
  ],
  tingkat: [
    { nomor: 1, nama: 'Pendaki Pemula', min: 0 },
    { nomor: 2, nama: 'Pendaki Terlatih', min: 25 },
    { nomor: 3, nama: 'Penjelajah Lereng', min: 60 },
    { nomor: 4, nama: 'Penakluk Puncak', min: 100 },
  ],
}

/**
 * Katalog tema "tanpa peta" seperti dikirim GET /api/v1/materi/tema. Angka dan
 * namanya sengaja sama dengan `TemaPerjalanan::semua()` di backend.
 */
const TANPA = {
  kode: 'tanpa',
  nama: 'Tanpa tema',
  deskripsi: 'Materi berjalan sebagai daftar bagian biasa.',
  adegan: 'polos',
  satuan: 'bagian',
  fase: [],
  tingkat: [],
}

/**
 * @param {number} nomor
 * @param {{ selesai?: boolean, wajib?: boolean, nama?: string }} [ubah]
 * @returns {import('../../../sections/material/perjalanan/perjalanan.js').DataLangkah}
 */
function langkah(nomor, ubah = {}) {
  return {
    block_id: nomor,
    nomor,
    nama: `Pos ${nomor}`,
    ikon: 'batu',
    warna: 'coklat',
    wajib: true,
    status: 'belum',
    selesai: false,
    ...ubah,
  }
}

/**
 * Peta perjalanan ringkas untuk uji kenaikan.
 * @param {{ posisi: number, selesai: number, total?: number, persen: number, tuntas?: boolean, tingkatNomor: number }} isi
 */
function peta(isi) {
  return {
    kode: 'mendaki-gunung',
    nama: 'Mendaki Gunung',
    tanpa: false,
    adegan: 'gunung',
    satuan: 'pos',
    deskripsi: '',
    video_url: null,
    langkah: [
      langkah(1, { selesai: isi.selesai > 0 }),
      langkah(2, { selesai: isi.selesai > 1 }),
      langkah(3),
      langkah(4),
    ],
    jumlah_langkah: 4,
    posisi: isi.posisi,
    selesai: isi.selesai,
    total: isi.total ?? 4,
    persen: isi.persen,
    tuntas: isi.tuntas ?? false,
    tingkat: {
      nomor: isi.tingkatNomor,
      nama: `Tingkat ${isi.tingkatNomor}`,
      min: 0,
      puncak: isi.persen >= 100,
    },
    tingkat_berikut: null,
  }
}

describe('nama langkah', () => {
  it('memakai nama fase bawaan tema sesuai urutan klip', () => {
    expect(faseKe(TEMA, 0).nama).toBe('Basecamp')
    expect(faseKe(TEMA, 3).nama).toBe('Lereng Berbatu')
    expect(faseKe(TEMA, 0).ikon).toBe('tenda')
    expect(faseKe(TEMA, 2).warna).toBe('biru')
    expect(faseKe(TEMA, 0).diubah).toBe(false)
  })

  it('melanjutkan sendiri bila klip lebih banyak daripada fase tema', () => {
    expect(faseKe(TEMA, 6).nama).toBe('Pos 7')
    expect(faseKe(TEMA, 9).nama).toBe('Pos 10')
    expect(faseKe(TEMA, 9).ikon).toBe('tanda')
  })

  it('memakai nama ganti dari guru dan menandainya sudah diubah', () => {
    const hasil = faseKe(TEMA, 0, 'Basecamp Sekolah')

    expect(hasil.nama).toBe('Basecamp Sekolah')
    expect(hasil.bawaan).toBe('Basecamp')
    expect(hasil.diubah).toBe(true)
    expect(hasil.ikon).toBe('tenda')
  })

  it('kembali ke nama bawaan saat guru mengosongkan nama', () => {
    expect(faseKe(TEMA, 1, '   ').nama).toBe('Jalur Pinus')
    expect(faseKe(TEMA, 1, null).diubah).toBe(false)
  })

  it('memangkas nama ganti yang kepanjangan', () => {
    const panjang = 'a'.repeat(MAKS_NAMA_LANGKAH + 20)
    expect(faseKe(TEMA, 0, panjang).nama).toHaveLength(MAKS_NAMA_LANGKAH)
  })

  it('tetap memberi nama walau katalog belum termuat', () => {
    expect(faseKe(undefined, 2).nama).toBe('Pos 3')
    expect(faseKe(undefined, 2).warna).toBe('kelabu')
  })

  it('mengisi nama semua klip saat tema diterapkan', () => {
    const blok = terapkanTema([blokBaru('teks'), blokBaru('media'), blokBaru('kuis')], TEMA)

    expect(blok.map((satu) => satu.fase)).toEqual(['Basecamp', 'Jalur Pinus', 'Sungai Deras'])
    // Klip lama tidak dimutasi (editor menggambar dari larik baru).
    expect(blokBaru('teks').fase).toBe('')
  })
})

describe('tingkat & posisi', () => {
  it('menaikkan tingkat mengikuti ambang yang sama dengan server', () => {
    expect(tingkatKe(TEMA, 0).nama).toBe('Pendaki Pemula')
    expect(tingkatKe(TEMA, 24).nomor).toBe(1)
    expect(tingkatKe(TEMA, 25).nama).toBe('Pendaki Terlatih')
    expect(tingkatKe(TEMA, 25).berikut?.sisa).toBe(35)
    expect(tingkatKe(TEMA, 60).nama).toBe('Penjelajah Lereng')
    expect(tingkatKe(TEMA, 100).nomor).toBe(4)
    expect(tingkatKe(TEMA, 100).puncak).toBe(true)
    expect(tingkatKe(TEMA, 100).berikut).toBeNull()
  })

  it('menjepit persentase di luar 0–100', () => {
    expect(tingkatKe(TEMA, -10).nomor).toBe(1)
    expect(tingkatKe(TEMA, 180).nomor).toBe(4)
  })

  it('memberi tingkat cadangan bila katalog kosong', () => {
    expect(tingkatKe(undefined, 40).nama).toBe('Pendaki')
    expect(tingkatKe(undefined, 40).berikut).toBeNull()
  })

  it('menunjuk langkah wajib pertama yang belum selesai', () => {
    expect(posisiAktif([langkah(1, { selesai: true }), langkah(2), langkah(3)])).toBe(2)
  })

  it('menunjuk langkah wajib terakhir bila semuanya selesai', () => {
    expect(posisiAktif([langkah(1, { selesai: true }), langkah(2, { selesai: true })])).toBe(2)
  })

  it('memakai semua langkah bila tidak ada yang wajib, dan 0 bila kosong', () => {
    expect(posisiAktif([langkah(1, { wajib: false }), langkah(2, { wajib: false })])).toBe(1)
    expect(posisiAktif([])).toBe(0)
  })
})

describe('pratinjau editor', () => {
  it('menyusun langkah dari klip yang belum disimpan', () => {
    const blok = [
      { ...blokBaru('teks'), fase: 'Pemberangkatan' },
      { ...blokBaru('teks'), wajib: false },
    ]

    const hasil = langkahLokal(blok, TEMA)

    expect(hasil[0]).toMatchObject({ nomor: 1, nama: 'Pemberangkatan', ikon: 'tenda', wajib: true, status: 'belum' })
    expect(hasil[1]).toMatchObject({ nomor: 2, nama: 'Jalur Pinus', wajib: false })
  })

  it('memakai nama tema ganti dan menghitung langkah wajib saja', () => {
    const blok = [blokBaru('teks'), { ...blokBaru('teks'), wajib: false }, blokBaru('teks')]

    const hasil = petaLokal(blok, TEMA, { nama: 'Ekspedisi 3A', videoUrl: 'https://contoh.test/latar.mp4' })

    expect(hasil.nama).toBe('Ekspedisi 3A')
    expect(hasil.total).toBe(2)
    expect(hasil.jumlah_langkah).toBe(3)
    expect(hasil.posisi).toBe(1)
    expect(hasil.persen).toBe(0)
    expect(hasil.tuntas).toBe(false)
    expect(hasil.video_url).toBe('https://contoh.test/latar.mp4')
    // Bentuknya sama dengan payload server, jadi komponen peta bisa memakainya.
    expect(() => skemaPerjalanan.parse(hasil)).not.toThrow()
  })

  it('jatuh ke nama bawaan tema bila guru belum menamainya', () => {
    expect(petaLokal([blokBaru('teks')], TEMA).nama).toBe('Mendaki Gunung')
    expect(petaLokal([blokBaru('teks')], TEMA, { nama: '   ' }).nama).toBe('Mendaki Gunung')
  })
})

describe('kenaikan', () => {
  it('tidak memunculkan perayaan bila tidak ada yang berubah', () => {
    expect(kenaikanUntuk(peta({ posisi: 1, selesai: 0, persen: 0, tingkatNomor: 1 }), peta({ posisi: 1, selesai: 0, persen: 0, tingkatNomor: 1 }))).toBeNull()
    expect(kenaikanUntuk(null, peta({ posisi: 1, selesai: 0, persen: 0, tingkatNomor: 1 }))).toBeNull()
  })

  it('memberi pesan naik satu langkah beserta nama posnya', () => {
    const hasil = kenaikanUntuk(
      peta({ posisi: 1, selesai: 0, persen: 0, tingkatNomor: 1 }),
      { ...peta({ posisi: 2, selesai: 1, persen: 25, tingkatNomor: 1 }), langkah: [langkah(1, { selesai: true }), langkah(2, { nama: 'Sungai Deras' })] },
    )

    expect(hasil?.jenis).toBe('langkah')
    expect(hasil?.judul).toBe('Naik ke pos 2: Sungai Deras')
  })

  it('mengutamakan pesan naik tingkat', () => {
    const hasil = kenaikanUntuk(
      peta({ posisi: 1, selesai: 0, persen: 0, tingkatNomor: 1 }),
      peta({ posisi: 2, selesai: 1, persen: 25, tingkatNomor: 2 }),
    )

    expect(hasil?.jenis).toBe('tingkat')
    expect(hasil?.judul).toBe('Naik tingkat: Tingkat 2')
  })

  it('mengutamakan pesan puncak saat perjalanan tuntas', () => {
    const hasil = kenaikanUntuk(
      peta({ posisi: 3, selesai: 3, persen: 75, tingkatNomor: 3 }),
      peta({ posisi: 4, selesai: 4, persen: 100, tuntas: true, tingkatNomor: 4 }),
    )

    expect(hasil?.jenis).toBe('puncak')
    expect(hasil?.pesan).toContain('4 pos wajib')
  })
})

describe('tanpa peta', () => {
  it('mengenali pilihan tanpa peta dari konfigurasi server maupun katalog', () => {
    expect(KODE_TANPA_PETA).toBe('tanpa')
    expect(tanpaPeta({ kode: 'tanpa' })).toBe(true)
    expect(tanpaPeta({ kode: 'mendaki-gunung', tanpa: true })).toBe(true)
    expect(tanpaPeta({ kode: 'mendaki-gunung', tanpa: false })).toBe(false)
    expect(tanpaPeta(undefined)).toBe(false)
    expect(tanpaPeta(null)).toBe(false)
  })

  it('menamai klip lanjutan mengikuti satuan tema, bukan selalu "Pos"', () => {
    expect(faseKe(TANPA, 0).nama).toBe('Bagian 1')
    expect(faseKe(TANPA, 4).nama).toBe('Bagian 5')
    expect(faseKe(TANPA, 0).ikon).toBe('tanda')
    expect(faseKe(undefined, 2).nama).toBe('Pos 3')
  })

  it('menandai pratinjau editor sebagai tanpa peta dan memakai satuan bagian', () => {
    const hasil = petaLokal([blokBaru('teks'), blokBaru('teks')], TANPA)

    expect(hasil.tanpa).toBe(true)
    expect(hasil.satuan).toBe('bagian')
    expect(hasil.nama).toBe('Tanpa tema')
    expect(hasil.langkah.map((satu) => satu.nama)).toEqual(['Bagian 1', 'Bagian 2'])
    // Bentuknya tetap sama dengan payload server, jadi komponen peta menerimanya.
    expect(() => skemaPerjalanan.parse(hasil)).not.toThrow()
  })

  it('memberi pesan kemajuan bagian biasa, bukan kiasan pendakian', () => {
    const dasar = {
      ...peta({ posisi: 1, selesai: 0, persen: 0, total: 2, tingkatNomor: 1 }),
      tanpa: true,
      satuan: 'bagian',
      tingkat: { nomor: 1, nama: '', min: 0, puncak: false },
    }

    const maju = kenaikanUntuk(dasar, { ...dasar, posisi: 2, selesai: 1, persen: 50 })

    expect(maju?.jenis).toBe('bagian')
    expect(maju?.judul).toBe('Bagian 1 dari 2 selesai')
    expect(maju?.pesan).toBe('Lanjut ke bagian berikutnya.')
    expect(maju?.judul).not.toContain('pos')

    const tuntas = kenaikanUntuk(dasar, { ...dasar, posisi: 2, selesai: 2, persen: 100, tuntas: true })

    expect(tuntas?.jenis).toBe('tuntas')
    expect(tuntas?.judul).toBe('2 bagian wajib selesai!')
  })

  it('tidak mengumumkan apa pun bila tidak ada bagian yang bertambah', () => {
    const dasar = {
      ...peta({ posisi: 1, selesai: 0, persen: 0, total: 2, tingkatNomor: 1 }),
      tanpa: true,
      satuan: 'bagian',
    }

    expect(kenaikanUntuk(dasar, { ...dasar })).toBeNull()
  })
})

describe('titik jalur', () => {
  it('mendaki dari kaki kiri ke puncak', () => {
    const titik = titikJalur(5)

    expect(titik).toHaveLength(5)
    expect(titik[0].y).toBeGreaterThan(titik[4].y)
    expect(titik[0].x).toBeLessThan(titik[4].x)
    expect(titik.every((satu) => satu.x > 0 && satu.x < 100)).toBe(true)
    expect(titik.every((satu) => satu.y > 0 && satu.y < 100)).toBe(true)
  })

  it('naik berbelok-belok (zigzag) dan tiap pos di punggungan, bukan di langit', () => {
    const titik = titikJalur(5)

    // Basecamp kiri bawah → lereng kanan → lereng kiri → punggung kanan →
    // puncak. Ruas-ruasnya menyeberang peta, jadi terbaca sebagai jalur
    // pendakian, bukan garis diagonal.
    expect(titik[0].x).toBeLessThan(50)
    expect(titik[1].x).toBeGreaterThan(50)
    expect(titik[2].x).toBeLessThan(50)
    expect(titik[3].x).toBeGreaterThan(50)
    // Pos terakhir berdiri DI puncak (punggungan gambarnya ada di y ≈ 39%),
    // bukan di langit di atasnya — sebab itu y = 42, bukan 12 seperti dulu.
    expect(titik[4]).toEqual({ x: 50, y: 42 })

    for (let indeks = 1; indeks < titik.length; indeks++) {
      expect(titik[indeks].y).toBeLessThan(titik[indeks - 1].y)
    }

    // Ruas kecuali pendakian terakhir wajib menyeberang peta; ruas terakhir
    // menuju puncak memang pendek secara geometri (puncak ada di tengah).
    const ruas = titik.slice(1).map((satu, indeks) => Math.abs(satu.x - titik[indeks].x))
    expect(ruas.slice(0, -1).every((lebar) => lebar >= 25)).toBe(true)
    expect(ruas[ruas.length - 1]).toBeGreaterThanOrEqual(10)

    // Belokan menyempit ke atas (bentuk lereng gunung).
    expect(ruas[ruas.length - 1]).toBeLessThan(ruas[0])
  })

  it('tidak pernah menaruh pos di langit, berapa pun jumlah pos — termasuk setelah kuis disisipkan', () => {
    // Pagar regresi untuk keluhan "saat disisipkan kuis hasilnya masih di
    // udara": rumus lama berhenti di y = 12% (langit, di atas punggungan yang
    // ada di y ≈ 39%), jadi menyisipkan satu bagian mendorong pos ke udara.
    for (let jumlah = 2; jumlah <= 12; jumlah++) {
      const titik = titikJalur(jumlah)

      expect(titik).toHaveLength(jumlah)
      expect(titik[0]).toEqual({ x: 6, y: 71 })
      expect(titik[titik.length - 1]).toEqual({ x: 50, y: 42 })
      // Titik teratas rute adalah puncaknya sendiri (42%), jadi tidak ada pos
      // yang berdiri lebih tinggi dari punggungan.
      expect(Math.min(...titik.map((satu) => satu.y))).toBeGreaterThanOrEqual(42)
    }
  })

  it('memakai rute tema yang dipilih (pulau & angkasa berbeda dari gunung)', () => {
    const pulau = titikJalur(RUTE_TEMA.pulau.length, 'pulau')
    const angkasa = titikJalur(RUTE_TEMA.angkasa.length, 'angkasa')

    expect(pulau).toEqual(RUTE_TEMA.pulau.map(({ x, y }) => ({ x, y })))
    expect(angkasa).toEqual(RUTE_TEMA.angkasa.map(({ x, y }) => ({ x, y })))
    expect(pulau).not.toEqual(titikJalur(RUTE_TEMA.pulau.length))

    // Adegan tak dikenal (mis. tema lama) tetap mendapat rute pendakian.
    expect(titikJalur(3, 'polos')).toEqual(titikJalur(3))
    expect(titikJalur(3, undefined)).toEqual(titikJalur(3))
  })

  it('menyisipkan satu pos menggeser pos lain di rute yang sama', () => {
    const lima = titikJalur(5, 'pulau')
    const enam = titikJalur(6, 'pulau')

    // Tempat pertama & terakhir tema tidak berubah; yang bergeser hanya pos di
    // antaranya — jadi menambah kuis tidak memindahkan pos ke tempat lain.
    expect(lima[0]).toEqual(enam[0])
    expect(lima[lima.length - 1]).toEqual(enam[enam.length - 1])
    expect(enam).toHaveLength(6)
  })

  it('memberi satu titik untuk satu langkah dan tidak meledak untuk nol', () => {
    expect(titikJalur(1)).toEqual([{ x: 6, y: 71 }])
    expect(titikJalur(1, 'angkasa')).toEqual([{ x: 11, y: 79 }])
    expect(titikJalur(0)).toHaveLength(1)
  })
})

describe('label dan skema', () => {
  it('menyusun keterangan posisi memakai satuan tema', () => {
    expect(labelPerjalanan(peta({ posisi: 3, selesai: 2, persen: 50, tingkatNomor: 2 }))).toBe('pos 3 dari 4')
    expect(labelPerjalanan({ ...peta({ posisi: 0, selesai: 0, persen: 0, tingkatNomor: 1 }), jumlah_langkah: 0 })).toBe('Belum ada langkah')
  })

  it('menolak peta dari server yang kehilangan bagian penting', () => {
    const kurang = peta({ posisi: 1, selesai: 0, persen: 0, tingkatNomor: 1 })

    expect(() => skemaPerjalanan.parse(kurang)).not.toThrow()

    const rusak = { ...kurang, tingkat: undefined }
    expect(() => skemaPerjalanan.parse(rusak)).toThrow()
  })
})
