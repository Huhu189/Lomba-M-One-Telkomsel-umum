/**
 * Registry tipe soal sisi klien — cermin App\Sections\Question\Enums\TipeSoal
 * dan RegistryTipeSoal di backend.
 *
 * Delapan tipe soal sudah bisa disimpan: enam objektif (pilihan ganda,
 * benar/salah, menjodohkan, mengurutkan, letak kata, hubung kata) dan dua
 * bertingkat (isian singkat, uraian) yang dinilai lewat kata kunci lalu bisa
 * dikoreksi guru pada antrean koreksi manual.
 */

/** Nilai tipe soal — harus sama persis dengan enum backend. */
export const TIPE = {
  pilihanGanda: 'pilihan_ganda',
  benarSalah: 'benar_salah',
  isianSingkat: 'isian_singkat',
  uraian: 'uraian',
  menjodohkan: 'menjodohkan',
  mengurutkan: 'mengurutkan',
  letakKata: 'letak_kata',
  hubungKata: 'hubung_kata',
  pilihanGandaKompleks: 'pilihan_ganda_kompleks',
  benarSalahMajemuk: 'benar_salah_majemuk',
  isianAngka: 'isian_angka',
  pilihanGambar: 'pilihan_gambar',
  urutGambar: 'urut_gambar',
  susunHuruf: 'susun_huruf',
  isianRumpang: 'isian_rumpang',
  klasifikasi: 'klasifikasi',
  tabelIsian: 'tabel_isian',
  garisBilangan: 'garis_bilangan',
}

/** @type {Record<string, string>} */
export const LABEL_TIPE = {
  [TIPE.pilihanGanda]: 'Pilihan ganda',
  [TIPE.benarSalah]: 'Benar / salah',
  [TIPE.isianSingkat]: 'Isian singkat',
  [TIPE.uraian]: 'Uraian',
  [TIPE.menjodohkan]: 'Menjodohkan',
  [TIPE.mengurutkan]: 'Mengurutkan',
  [TIPE.letakKata]: 'Letak kata',
  [TIPE.hubungKata]: 'Hubung kata',
  [TIPE.pilihanGandaKompleks]: 'Pilihan ganda kompleks',
  [TIPE.benarSalahMajemuk]: 'Benar / salah majemuk',
  [TIPE.isianAngka]: 'Isian angka',
  [TIPE.pilihanGambar]: 'Pilihan gambar',
  [TIPE.urutGambar]: 'Urut gambar',
  [TIPE.susunHuruf]: 'Susun huruf',
  [TIPE.isianRumpang]: 'Isian rumpang',
  [TIPE.klasifikasi]: 'Klasifikasi',
  [TIPE.tabelIsian]: 'Tabel isian',
  [TIPE.garisBilangan]: 'Garis bilangan',
}

/** Tipe yang dinilai pasti (soal objektif) — cermin TipeSoal::objektif(). */
export const TIPE_OBJEKTIF = [
  TIPE.pilihanGanda,
  TIPE.benarSalah,
  TIPE.menjodohkan,
  TIPE.mengurutkan,
  TIPE.letakKata,
  TIPE.hubungKata,
  TIPE.pilihanGandaKompleks,
  TIPE.benarSalahMajemuk,
  TIPE.isianAngka,
  TIPE.pilihanGambar,
  TIPE.urutGambar,
  TIPE.susunHuruf,
  TIPE.isianRumpang,
  TIPE.klasifikasi,
  TIPE.tabelIsian,
  TIPE.garisBilangan,
]

/** Tipe bertingkat: dinilai kata kunci, sisanya menunggu koreksi guru. */
export const TIPE_BERTINGKAT = [TIPE.isianSingkat, TIPE.uraian]

/**
 * Tipe yang pertanyaannya bukan `konten.teks` (gambar, atau petunjuk susun
 * huruf), sehingga isi soal boleh kosong di editor.
 */
export const TIPE_TANPA_TEKS = [TIPE.pilihanGambar, TIPE.urutGambar, TIPE.susunHuruf]

/** Isi <select> tipe soal pada editor. */
export const DAFTAR_TIPE = Object.keys(LABEL_TIPE).map((nilai) => ({
  nilai,
  label: LABEL_TIPE[nilai],
  objektif: TIPE_OBJEKTIF.includes(nilai),
}))

/** Batas opsi pilihan ganda (cermin PenanganPilihanGanda). */
export const MIN_OPSI = 2
export const MAKS_OPSI = 6

/** Minimal pasangan menjodohkan / item mengurutkan / kata & posisi letak kata. */
export const MIN_ITEM = 2

/** Batas pilihan ganda kompleks (cermin PenanganPilihanGandaKompleks). */
export const MIN_OPSI_KOMPLEKS = 3
export const MAKS_OPSI_KOMPLEKS = 8

/** Batas pernyataan benar/salah majemuk (cermin PenanganBenarSalahMajemuk). */
export const MIN_PERNYATAAN = 2
export const MAKS_PERNYATAAN = 8

/** Batas gambar pilihan & urut (cermin PenanganPilihanGambar / PenanganUrutGambar). */
export const MIN_GAMBAR = 2
export const MAKS_GAMBAR = 8

/** Batas kata susun huruf & panjang petunjuk (cermin PenanganSusunHuruf). */
export const MIN_HURUF = 2
export const MAKS_HURUF = 20
export const MAKS_PETUNJUK = 500

/** Batas isian rumpang, klasifikasi, tabel isian, garis bilangan. */
export const MAKS_LUBANG = 10
export const MAKS_ITEM_KLASIFIKASI = 12
export const MIN_KOTAK = 2
export const MAKS_KOTAK = 6
export const MAKS_SEL = 40
export const MAKS_RENTANG_GARIS = 1000

/** Batas panjang teks MathML (cermin BantuanKonten::galatMatematika). */
export const MAKS_MATEMATIKA = 2000

/** Ambang kemiripan bawaan isian singkat (cermin PenanganIsianSingkat). */
export const AMBANG_BAWAAN_ISIAN = 0.8

/** Ambang lulus bawaan uraian (cermin PenanganUraian). */
export const AMBANG_BAWAAN_URAIAN = 0.6

/** @param {unknown} nilai @returns {string} */
export function teksAman(nilai) {
  return typeof nilai === 'string' ? nilai : ''
}

/**
 * Peta teks → teks dari data server (mis. kunci.pasangan), tahan data kotor.
 * @param {unknown} nilai
 * @returns {Record<string, string>}
 */
export function rekamanTeks(nilai) {
  if (nilai === null || typeof nilai !== 'object' || Array.isArray(nilai)) return {}

  /** @type {Record<string, string>} */
  const hasil = {}
  for (const [kunci, isi] of Object.entries(/** @type {Record<string, unknown>} */ (nilai))) {
    if (typeof isi === 'string' || typeof isi === 'number') hasil[kunci] = String(isi)
  }
  return hasil
}

/**
 * Daftar item {id, teks} dari konten server.
 * @param {unknown} nilai
 * @returns {{ id: string, teks: string }[]}
 */
export function daftarAman(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((baris) => baris !== null && typeof baris === 'object')
    .map((baris) => {
      const rekaman = /** @type {Record<string, unknown>} */ (baris)
      return { id: teksAman(rekaman.id), teks: teksAman(rekaman.teks) }
    })
}

/**
 * Daftar item bergambar {id, media} dari konten server.
 * @param {unknown} nilai
 * @returns {{ id: string, media: string }[]}
 */
export function daftarMedia(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((baris) => baris !== null && typeof baris === 'object')
    .map((baris) => {
      const rekaman = /** @type {Record<string, unknown>} */ (baris)
      return { id: teksAman(rekaman.id), media: teksAman(rekaman.media) }
    })
}

/**
 * Peta id → boolean dari data server (mis. kunci.jawaban benar/salah majemuk).
 * @param {unknown} nilai
 * @returns {Record<string, boolean>}
 */
export function rekamanBoolean(nilai) {
  if (nilai === null || typeof nilai !== 'object' || Array.isArray(nilai)) return {}

  /** @type {Record<string, boolean>} */
  const hasil = {}
  for (const [kunci, isi] of Object.entries(/** @type {Record<string, unknown>} */ (nilai))) {
    if (typeof isi === 'boolean') hasil[kunci] = isi
  }
  return hasil
}

/**
 * Daftar teks dari nilai array sederhana (mis. kunci.urutan).
 * @param {unknown} nilai
 * @returns {string[]}
 */
export function daftarTeks(nilai) {
  if (!Array.isArray(nilai)) return []
  return nilai.map((satu) => (typeof satu === 'string' || typeof satu === 'number' ? String(satu) : ''))
}

/**
 * Daftar {id, teks} dari bidang `label` (mis. kotak klasifikasi). Tanpa ini,
 * kotak berlabel tampil kosong karena isinya bukan `teks`.
 * @param {unknown} nilai
 * @returns {{ id: string, teks: string }[]}
 */
export function daftarLabel(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((baris) => baris !== null && typeof baris === 'object')
    .map((baris) => {
      const rekaman = /** @type {Record<string, unknown>} */ (baris)
      return { id: teksAman(rekaman.id), teks: teksAman(rekaman.label) }
    })
}

/**
 * Peta id → daftar jawaban diterima (mis. kunci.lubang / kunci.sel yang
 * nilainya berupa array). `rekamanTeks` tidak bisa dipakai untuk ini karena
 * membuang nilai non-teks.
 * @param {unknown} nilai
 * @returns {Record<string, string[]>}
 */
export function rekamanDaftarTeks(nilai) {
  if (nilai === null || typeof nilai !== 'object' || Array.isArray(nilai)) return {}

  /** @type {Record<string, string[]>} */
  const hasil = {}
  for (const [kunci, isi] of Object.entries(/** @type {Record<string, unknown>} */ (nilai))) {
    hasil[kunci] = daftarTeks(Array.isArray(isi) ? isi : [isi]).filter((satu) => satu !== '')
  }
  return hasil
}

/**
 * Nomor penanda `{{n}}` pada teks soal, unik dan terurut menaik.
 * @param {string} teks
 * @returns {number[]}
 */
export function nomorLubangDariTeks(teks) {
  const cocok = teks.match(/\{\{\s*(\d+)\s*\}\}/g) ?? []
  const nomor = cocok.map((satu) => Number(satu.replace(/\D/g, '')))

  return [...new Set(nomor)].sort((a, b) => a - b)
}

/**
 * Pecah teks berpemisah koma menjadi daftar kata bersih.
 * @param {string} teks
 * @returns {string[]}
 */
export function pisahKata(teks) {
  return teks
    .split(',')
    .map((satu) => satu.trim())
    .filter((satu) => satu !== '')
}

/**
 * Baris sinonim uraian (`kata = alias, alias`) menjadi peta untuk kunci
 * `sinonim: { kata: [alias, …] }`.
 * @param {string} teks
 * @returns {Record<string, string[]>}
 */
export function sinonimUraianDariTeks(teks) {
  /** @type {Record<string, string[]>} */
  const peta = {}

  for (const baris of teks.split('\n')) {
    const [kata, alias] = baris.split('=')
    const nama = teksAman(kata).trim()
    if (nama === '') continue

    const daftar = pisahKata(teksAman(alias))
    if (daftar.length > 0) peta[nama] = daftar
  }

  return peta
}

/**
 * Kebalikannya: peta sinonim uraian menjadi baris teks untuk editor.
 * @param {unknown} nilai
 * @returns {string}
 */
export function teksDariSinonimUraian(nilai) {
  if (nilai === null || typeof nilai !== 'object' || Array.isArray(nilai)) return ''

  return Object.entries(/** @type {Record<string, unknown>} */ (nilai))
    .map(([kata, alias]) => `${kata} = ${Array.isArray(alias) ? alias.map(String).join(', ') : ''}`)
    .join('\n')
}

/**
 * Id berikutnya yang belum dipakai pada daftar (mis. 'A', 'B', …).
 * @param {string} prefix
 * @param {{ id: string }[]} daftar
 * @returns {string}
 */
export function idBerikut(prefix, daftar) {
  const dipakai = new Set(daftar.map((satu) => satu.id))
  let nomor = 1
  while (dipakai.has(`${prefix}${nomor}`)) nomor += 1
  return `${prefix}${nomor}`
}

/**
 * @typedef {{ id: string, teks: string }} ItemKonten
 * @typedef {{ id: string, teks: string, posisi: string }} ItemUrut
 * @typedef {{ teks: string, sinonim: string }} BarisIsian
 * @typedef {{ teks: string, bobot: string }} BarisKataKunci
 * @typedef {{
 *   id: number|null,
 *   subject_id: string,
 *   tag_id: string,
 *   tipe: string,
 *   teks: string,
 *   media: string,
 *   matematika: string,
 *   opsi: ItemKonten[],
 *   jawaban: string,
 *   benar: boolean,
 *   kiri: ItemKonten[],
 *   kanan: ItemKonten[],
 *   pasangan: Record<string, string>,
 *   item: ItemUrut[],
 *   jawabanBaku: BarisIsian[],
 *   ambang: string,
 *   angkaPersis: boolean,
 *   negasi: string,
 *   kataKunci: BarisKataKunci[],
 *   ambangLulus: string,
 *   sinonimUraian: string,
 *   kata: ItemKonten[],
 *   posisi: ItemKonten[],
 *   penempatan: Record<string, string>,
 *   sambungan: Record<string, string>,
 *   benarKompleks: string[],
 *   pernyataan: ItemKonten[],
 *   kunciPernyataan: Record<string, boolean>,
 *   satuan: string,
 *   angkaNilai: string,
 *   angkaToleransi: string,
 *   opsiGambar: ({ id: string, media: string })[],
 *   jawabanGambar: string,
 *   itemGambar: ({ id: string, media: string, posisi: string })[],
 *   petunjuk: string,
 *   kataSusun: string,
 *   lubang: Record<string, string>,
 *   itemKlasifikasi: ItemKonten[],
 *   kotak: ItemKonten[],
 *   petaKlasifikasi: Record<string, string>,
 *   kolom: string,
 *   barisTabel: ({ id: string, sel: ({ kode: string, teks: string })[] })[],
 *   kunciSel: Record<string, string>,
 *   garisMin: string,
 *   garisMax: string,
 *   garisLangkah: string,
 *   garisNilai: string,
 *   garisToleransi: string,
 *   pembahasan: string,
 *   skor: string,
 *   aktif: boolean,
 * }} StateSoal
 */

/** Soal server yang bisa dibuka editor (bentuk minimal dari SoalResource). */
/**
 * @typedef {{
 *   id: number,
 *   subject_id: number,
 *   tag_id: number|null,
 *   tipe: string,
 *   konten: Record<string, unknown>,
 *   kunci: Record<string, unknown>,
 *   pembahasan: string|null,
 *   skor: number,
 *   aktif: boolean,
 * }} SoalTersimpan
 */

/** State kosong untuk soal baru (pilihan ganda dua opsi). */
export function stateSoalKosong() {
  return /** @type {StateSoal} */ ({
    id: null,
    subject_id: '',
    tag_id: '',
    tipe: TIPE.pilihanGanda,
    teks: '',
    media: '',
    matematika: '',
    opsi: [
      { id: 'A', teks: '' },
      { id: 'B', teks: '' },
    ],
    jawaban: 'A',
    benar: true,
    kiri: [
      { id: 'K1', teks: '' },
      { id: 'K2', teks: '' },
    ],
    kanan: [
      { id: 'N1', teks: '' },
      { id: 'N2', teks: '' },
    ],
    pasangan: { K1: 'N1', K2: 'N2' },
    item: [
      { id: 'I1', teks: '', posisi: '1' },
      { id: 'I2', teks: '', posisi: '2' },
    ],
    jawabanBaku: [{ teks: '', sinonim: '' }],
    ambang: String(AMBANG_BAWAAN_ISIAN),
    angkaPersis: true,
    negasi: '',
    kataKunci: [{ teks: '', bobot: '' }],
    ambangLulus: String(AMBANG_BAWAAN_URAIAN),
    sinonimUraian: '',
    kata: [
      { id: 'W1', teks: '' },
      { id: 'W2', teks: '' },
    ],
    posisi: [
      { id: 'P1', teks: '' },
      { id: 'P2', teks: '' },
    ],
    penempatan: { W1: 'P1', W2: 'P2' },
    sambungan: { K1: 'N1', K2: 'N2' },
    benarKompleks: [],
    pernyataan: [
      { id: 'P1', teks: '' },
      { id: 'P2', teks: '' },
    ],
    kunciPernyataan: { P1: true, P2: false },
    satuan: '',
    angkaNilai: '',
    angkaToleransi: '0',
    opsiGambar: [
      { id: 'G1', media: '' },
      { id: 'G2', media: '' },
    ],
    jawabanGambar: 'G1',
    itemGambar: [
      { id: 'U1', media: '', posisi: '1' },
      { id: 'U2', media: '', posisi: '2' },
    ],
    petunjuk: '',
    kataSusun: '',
    lubang: { '1': '' },
    itemKlasifikasi: [
      { id: 'I1', teks: '' },
      { id: 'I2', teks: '' },
    ],
    kotak: [
      { id: 'K1', teks: '' },
      { id: 'K2', teks: '' },
    ],
    petaKlasifikasi: {},
    kolom: '',
    barisTabel: [
      {
        id: 'R1',
        sel: [
          { kode: 'r1c1', teks: '' },
          { kode: 'r1c2', teks: '' },
        ],
      },
    ],
    kunciSel: {},
    garisMin: '0',
    garisMax: '10',
    garisLangkah: '1',
    garisNilai: '',
    garisToleransi: '0',
    pembahasan: '',
    skor: '10',
    aktif: true,
  })
}

/**
 * Isi soal (konten) dari state editor. Media/MathML kosong dibuang
 * supaya backend tidak menyimpan bidang kosong.
 * @param {StateSoal} state
 * @returns {Record<string, unknown>}
 */
export function kontenDariState(state) {
  /** @type {Record<string, unknown>} */
  const konten = { teks: state.teks.trim() }

  if (state.media.trim() !== '') konten.media = state.media.trim()
  if (state.matematika.trim() !== '') konten.matematika = state.matematika.trim()

  if (state.tipe === TIPE.pilihanGanda) {
    konten.opsi = state.opsi.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.menjodohkan) {
    konten.kiri = state.kiri.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
    konten.kanan = state.kanan.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.hubungKata) {
    konten.kiri = state.kiri.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
    konten.kanan = state.kanan.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.mengurutkan) {
    konten.item = state.item.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.letakKata) {
    konten.kata = state.kata.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
    konten.posisi = state.posisi.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.pilihanGandaKompleks) {
    konten.opsi = state.opsi.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.benarSalahMajemuk) {
    konten.pernyataan = state.pernyataan.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.isianAngka) {
    if (state.satuan.trim() !== '') konten.satuan = state.satuan.trim()
  }

  if (state.tipe === TIPE.pilihanGambar) {
    konten.opsi = state.opsiGambar.map((satu) => ({ id: satu.id, media: satu.media.trim() }))
  }

  if (state.tipe === TIPE.urutGambar) {
    konten.item = state.itemGambar.map((satu) => ({ id: satu.id, media: satu.media.trim() }))
  }

  if (state.tipe === TIPE.susunHuruf) {
    konten.petunjuk = state.petunjuk.trim()
    // konten susun huruf tidak memakai teks soal: petunjuk sudah menggantikannya.
    delete konten.teks
  }

  if (state.tipe === TIPE.klasifikasi) {
    konten.item = state.itemKlasifikasi.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
    konten.kotak = state.kotak.map((satu) => ({ id: satu.id, label: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.tabelIsian) {
    konten.kolom = pisahKata(state.kolom)
    konten.baris = state.barisTabel.map((baris) => ({
      id: baris.id,
      sel: baris.sel.map((sel) => {
        const teks = sel.teks.trim()
        return teks === '' ? { kode: sel.kode } : { kode: sel.kode, teks }
      }),
    }))
  }

  if (state.tipe === TIPE.garisBilangan) {
    konten.min = Number(state.garisMin)
    konten.max = Number(state.garisMax)
    konten.langkah = Number(state.garisLangkah)
  }

  return konten
}

/**
 * Kunci jawaban dari state editor.
 * @param {StateSoal} state
 * @returns {Record<string, unknown>}
 */
export function kunciDariState(state) {
  if (state.tipe === TIPE.benarSalah) return { benar: state.benar }
  if (state.tipe === TIPE.menjodohkan) return { pasangan: { ...state.pasangan } }
  if (state.tipe === TIPE.mengurutkan) return { urutan: urutanDariItem(state.item) }
  if (state.tipe === TIPE.letakKata) return { penempatan: { ...state.penempatan } }
  if (state.tipe === TIPE.hubungKata) return { sambungan: { ...state.sambungan } }
  if (state.tipe === TIPE.isianSingkat) return kunciIsian(state)
  if (state.tipe === TIPE.uraian) return kunciUraian(state)
  if (state.tipe === TIPE.pilihanGandaKompleks) return { benar: [...state.benarKompleks] }
  if (state.tipe === TIPE.benarSalahMajemuk) return { jawaban: { ...state.kunciPernyataan } }
  if (state.tipe === TIPE.isianAngka) {
    return { nilai: Number(state.angkaNilai), toleransi: Number(state.angkaToleransi || 0) }
  }
  if (state.tipe === TIPE.pilihanGambar) return { benar: state.jawabanGambar }
  if (state.tipe === TIPE.urutGambar) return { urutan: urutanDariItemGambar(state.itemGambar) }
  if (state.tipe === TIPE.susunHuruf) return { kata: state.kataSusun.trim() }
  if (state.tipe === TIPE.isianRumpang) {
    // Penanda yang sudah dihapus dari teks dibuang: server menolak kunci
    // dengan penanda yang tidak ada di teks.
    const nomor = nomorLubangDariTeks(state.teks)
    const dipakai = Object.fromEntries(
      Object.entries(state.lubang).filter(([kode]) => nomor.includes(Number(kode))),
    )
    return { lubang: petaJawabanDariRekaman(dipakai) }
  }
  if (state.tipe === TIPE.klasifikasi) return { peta: { ...state.petaKlasifikasi } }
  if (state.tipe === TIPE.tabelIsian) {
    // Sama seperti isian rumpang: kunci sel yang sudah tidak ada di tabel
    // jangan ikut terkirim.
    const kode = new Set(state.barisTabel.flatMap((baris) => baris.sel.map((sel) => sel.kode)))
    const dipakai = Object.fromEntries(
      Object.entries(state.kunciSel).filter(([kodeSel]) => kode.has(kodeSel)),
    )
    return { sel: petaJawabanDariRekaman(dipakai) }
  }
  if (state.tipe === TIPE.garisBilangan) {
    return { nilai: Number(state.garisNilai), toleransi: Number(state.garisToleransi || 0) }
  }
  return { jawaban: state.jawaban }
}

/**
 * Peta `{kode: "jawaban, alias"}` menjadi `{kode: [jawaban, alias]}`.
 * @param {Record<string, string>} rekaman
 * @returns {Record<string, string[]>}
 */
export function petaJawabanDariRekaman(rekaman) {
  /** @type {Record<string, string[]>} */
  const peta = {}

  for (const [kode, teks] of Object.entries(rekaman)) {
    peta[kode] = pisahKata(teksAman(teks))
  }

  return peta
}

/**
 * Urutan id gambar berdasarkan posisi yang diisi guru (posisi 1 paling awal).
 * @param {{ id: string, posisi: string }[]} item
 * @returns {string[]}
 */
export function urutanDariItemGambar(item) {
  return [...item]
    .sort((a, b) => Number(a.posisi || 0) - Number(b.posisi || 0))
    .map((satu) => satu.id)
}

/**
 * Kunci isian singkat. `sinonim` hanya dikirim bila ada isinya; `angka_persis`
 * hanya dikirim saat dimatikan (bawaan backend true).
 * @param {StateSoal} state
 * @returns {Record<string, unknown>}
 */
export function kunciIsian(state) {
  /** @type {Record<string, unknown>} */
  const kunci = { jawaban_baku: state.jawabanBaku.map((satu) => satu.teks.trim()) }

  const sinonim = state.jawabanBaku.map((satu) => pisahKata(satu.sinonim))
  if (sinonim.some((daftar) => daftar.length > 0)) kunci.sinonim = sinonim

  if (!state.angkaPersis) kunci.angka_persis = false

  const ambang = Number(state.ambang)
  if (Number.isFinite(ambang) && ambang > 0 && ambang <= 1) kunci.ambang = ambang

  const negasi = pisahKata(state.negasi)
  if (negasi.length > 0) kunci.negasi = negasi

  return kunci
}

/**
 * Kunci uraian: kata kunci berbobot opsional, ambang lulus, dan sinonim.
 * @param {StateSoal} state
 * @returns {Record<string, unknown>}
 */
export function kunciUraian(state) {
  const kataKunci = state.kataKunci.map((satu) => {
    const bobot = Number(satu.bobot)
    const pakaiBobot = satu.bobot.trim() !== '' && Number.isFinite(bobot) && bobot > 0
    return pakaiBobot ? { teks: satu.teks.trim(), bobot } : { teks: satu.teks.trim() }
  })

  /** @type {Record<string, unknown>} */
  const kunci = { kata_kunci: kataKunci }

  const ambang = Number(state.ambangLulus)
  if (state.ambangLulus.trim() !== '' && Number.isFinite(ambang) && ambang > 0 && ambang <= 1) {
    kunci.ambang_lulus = ambang
  }

  const sinonim = sinonimUraianDariTeks(state.sinonimUraian)
  if (Object.keys(sinonim).length > 0) kunci.sinonim = sinonim

  return kunci
}

/**
 * Urutan id item berdasarkan posisi yang diisi guru (posisi 1 paling awal).
 * @param {ItemUrut[]} item
 * @returns {string[]}
 */
export function urutanDariItem(item) {
  return [...item]
    .sort((a, b) => Number(a.posisi || 0) - Number(b.posisi || 0))
    .map((satu) => satu.id)
}

/**
 * Buka soal tersimpan menjadi state editor.
 * @param {SoalTersimpan} soal
 * @returns {StateSoal}
 */
export function stateDariSoal(soal) {
  const state = stateSoalKosong()
  const konten = soal.konten ?? {}
  const kunci = soal.kunci ?? {}

  state.id = soal.id
  state.subject_id = String(soal.subject_id)
  state.tag_id = soal.tag_id === null ? '' : String(soal.tag_id)
  state.tipe = soal.tipe
  state.teks = teksAman(konten.teks)
  state.media = teksAman(konten.media)
  state.matematika = teksAman(konten.matematika)
  state.pembahasan = soal.pembahasan ?? ''
  state.skor = String(soal.skor)
  state.aktif = soal.aktif

  if (soal.tipe === TIPE.pilihanGanda) {
    const opsi = daftarAman(konten.opsi)
    if (opsi.length > 0) state.opsi = opsi
    state.jawaban = teksAman(kunci.jawaban) || (state.opsi[0]?.id ?? '')
  }

  if (soal.tipe === TIPE.benarSalah) {
    state.benar = kunci.benar === true
  }

  if (soal.tipe === TIPE.menjodohkan) {
    const kiri = daftarAman(konten.kiri)
    const kanan = daftarAman(konten.kanan)
    if (kiri.length > 0) state.kiri = kiri
    if (kanan.length > 0) state.kanan = kanan
    state.pasangan = rekamanTeks(kunci.pasangan)
  }

  if (soal.tipe === TIPE.mengurutkan) {
    const item = daftarAman(konten.item)
    const urutan = daftarTeks(kunci.urutan)
    if (item.length > 0) {
      state.item = item.map((satu) => {
        const posisi = urutan.indexOf(satu.id)
        return { ...satu, posisi: String(posisi === -1 ? '' : posisi + 1) }
      })
    }
  }

  if (soal.tipe === TIPE.isianSingkat) {
    const baku = daftarTeks(kunci.jawaban_baku)
    const sinonim = Array.isArray(kunci.sinonim) ? kunci.sinonim : []
    if (baku.length > 0) {
      state.jawabanBaku = baku.map((teks, indeks) => ({
        teks,
        sinonim: daftarTeks(sinonim[indeks]).join(', '),
      }))
    }
    state.ambang = kunci.ambang === undefined ? state.ambang : String(kunci.ambang)
    state.angkaPersis = kunci.angka_persis !== false
    state.negasi = daftarTeks(kunci.negasi).join(', ')
  }

  if (soal.tipe === TIPE.uraian) {
    const kataKunci = Array.isArray(kunci.kata_kunci) ? kunci.kata_kunci : []
    const baris = kataKunci
      .filter((satu) => satu !== null && typeof satu === 'object')
      .map((satu) => {
        const rekaman = /** @type {Record<string, unknown>} */ (satu)
        return {
          teks: teksAman(rekaman.teks),
          bobot: rekaman.bobot === undefined || rekaman.bobot === null ? '' : String(rekaman.bobot),
        }
      })
    if (baris.length > 0) state.kataKunci = baris
    state.ambangLulus =
      kunci.ambang_lulus === undefined ? state.ambangLulus : String(kunci.ambang_lulus)
    state.sinonimUraian = teksDariSinonimUraian(kunci.sinonim)
  }

  if (soal.tipe === TIPE.letakKata) {
    const kata = daftarAman(konten.kata)
    const posisi = daftarAman(konten.posisi)
    if (kata.length > 0) state.kata = kata
    if (posisi.length > 0) state.posisi = posisi
    state.penempatan = rekamanTeks(kunci.penempatan)
  }

  if (soal.tipe === TIPE.hubungKata) {
    const kiri = daftarAman(konten.kiri)
    const kanan = daftarAman(konten.kanan)
    if (kiri.length > 0) state.kiri = kiri
    if (kanan.length > 0) state.kanan = kanan
    state.sambungan = rekamanTeks(kunci.sambungan)
  }

  if (soal.tipe === TIPE.pilihanGandaKompleks) {
    const opsi = daftarAman(konten.opsi)
    if (opsi.length > 0) state.opsi = opsi
    state.benarKompleks = daftarTeks(kunci.benar)
  }

  if (soal.tipe === TIPE.benarSalahMajemuk) {
    const pernyataan = daftarAman(konten.pernyataan)
    if (pernyataan.length > 0) state.pernyataan = pernyataan
    state.kunciPernyataan = rekamanBoolean(kunci.jawaban)
  }

  if (soal.tipe === TIPE.isianAngka) {
    state.satuan = teksAman(konten.satuan)
    state.angkaNilai = kunci.nilai === undefined || kunci.nilai === null ? '' : String(kunci.nilai)
    state.angkaToleransi = kunci.toleransi === undefined || kunci.toleransi === null ? '0' : String(kunci.toleransi)
  }

  if (soal.tipe === TIPE.pilihanGambar) {
    const opsi = daftarMedia(konten.opsi)
    if (opsi.length > 0) state.opsiGambar = opsi
    state.jawabanGambar = teksAman(kunci.benar) || (state.opsiGambar[0]?.id ?? '')
  }

  if (soal.tipe === TIPE.urutGambar) {
    const item = daftarMedia(konten.item)
    const urutan = daftarTeks(kunci.urutan)
    if (item.length > 0) {
      state.itemGambar = item.map((satu) => {
        const posisi = urutan.indexOf(satu.id)
        return { ...satu, posisi: String(posisi === -1 ? '' : posisi + 1) }
      })
    }
  }

  if (soal.tipe === TIPE.susunHuruf) {
    state.petunjuk = teksAman(konten.petunjuk)
    state.kataSusun = teksAman(kunci.kata)
  }

  if (soal.tipe === TIPE.isianRumpang) {
    /** @type {Record<string, string>} */
    const lubang = {}
    const sumber = kunci.lubang

    if (sumber !== null && typeof sumber === 'object' && !Array.isArray(sumber)) {
      for (const [kode, daftar] of Object.entries(/** @type {Record<string, unknown>} */ (sumber))) {
        lubang[kode] = daftarTeks(daftar).join(', ')
      }
    }

    if (Object.keys(lubang).length > 0) state.lubang = lubang
  }

  if (soal.tipe === TIPE.klasifikasi) {
    const item = daftarAman(konten.item)
    if (item.length > 0) state.itemKlasifikasi = item

    // Kotak memakai `label` di konten (bukan `teks`), jadi tidak bisa lewat
    // daftarAman: kalau salah baca, label hilang saat soal dibuka lagi.
    const kotak = Array.isArray(konten.kotak)
      ? konten.kotak
          .filter((satu) => satu !== null && typeof satu === 'object')
          .map((satu) => {
            const rekaman = /** @type {Record<string, unknown>} */ (satu)
            return { id: teksAman(rekaman.id), teks: teksAman(rekaman.label) }
          })
      : []

    if (kotak.length > 0) state.kotak = kotak
    state.petaKlasifikasi = rekamanTeks(kunci.peta)
  }

  if (soal.tipe === TIPE.tabelIsian) {
    state.kolom = daftarTeks(konten.kolom).join(', ')

    const baris = Array.isArray(konten.baris) ? konten.baris : []
    /** @type {({ id: string, sel: ({ kode: string, teks: string })[] })[]} */
    const barisTabel = []

    for (const satu of baris) {
      if (satu === null || typeof satu !== 'object') continue
      const rekaman = /** @type {Record<string, unknown>} */ (satu)
      const sel = Array.isArray(rekaman.sel) ? rekaman.sel : []
      barisTabel.push({
        id: teksAman(rekaman.id),
        sel: sel
          .filter((isi) => isi !== null && typeof isi === 'object')
          .map((isi) => {
            const isiRekaman = /** @type {Record<string, unknown>} */ (isi)
            return { kode: teksAman(isiRekaman.kode), teks: teksAman(isiRekaman.teks) }
          }),
      })
    }

    if (barisTabel.length > 0) state.barisTabel = barisTabel

    /** @type {Record<string, string>} */
    const kunciSel = {}
    const sumberSel = kunci.sel

    if (sumberSel !== null && typeof sumberSel === 'object' && !Array.isArray(sumberSel)) {
      for (const [kode, daftar] of Object.entries(/** @type {Record<string, unknown>} */ (sumberSel))) {
        kunciSel[kode] = daftarTeks(daftar).join(', ')
      }
    }

    state.kunciSel = kunciSel
  }

  if (soal.tipe === TIPE.garisBilangan) {
    state.garisMin = konten.min === undefined || konten.min === null ? state.garisMin : String(konten.min)
    state.garisMax = konten.max === undefined || konten.max === null ? state.garisMax : String(konten.max)
    state.garisLangkah =
      konten.langkah === undefined || konten.langkah === null ? state.garisLangkah : String(konten.langkah)
    state.garisNilai = kunci.nilai === undefined || kunci.nilai === null ? '' : String(kunci.nilai)
    state.garisToleransi =
      kunci.toleransi === undefined || kunci.toleransi === null ? '0' : String(kunci.toleransi)
  }

  return state
}

/**
 * @typedef {{
 *   subject_id: number,
 *   tag_id: number|null,
 *   tipe: string,
 *   konten: Record<string, unknown>,
 *   kunci: Record<string, unknown>,
 *   pembahasan: string,
 *   skor: number,
 *   aktif: boolean,
 * }} MuatanSoal
 */

/**
 * Muatan siap kirim ke API /soal.
 * @param {StateSoal} state
 * @returns {MuatanSoal}
 */
export function muatanDariState(state) {
  return {
    subject_id: Number(state.subject_id),
    tag_id: state.tag_id === '' ? null : Number(state.tag_id),
    tipe: state.tipe,
    konten: kontenDariState(state),
    kunci: kunciDariState(state),
    pembahasan: state.pembahasan.trim(),
    skor: Number(state.skor),
    aktif: state.aktif,
  }
}
