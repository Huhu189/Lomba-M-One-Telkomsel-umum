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
}

/** Tipe yang dinilai pasti (soal objektif) — cermin TipeSoal::objektif(). */
export const TIPE_OBJEKTIF = [
  TIPE.pilihanGanda,
  TIPE.benarSalah,
  TIPE.menjodohkan,
  TIPE.mengurutkan,
  TIPE.letakKata,
  TIPE.hubungKata,
]

/** Tipe bertingkat: dinilai kata kunci, sisanya menunggu koreksi guru. */
export const TIPE_BERTINGKAT = [TIPE.isianSingkat, TIPE.uraian]

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
 * Daftar teks dari nilai array sederhana (mis. kunci.urutan).
 * @param {unknown} nilai
 * @returns {string[]}
 */
export function daftarTeks(nilai) {
  if (!Array.isArray(nilai)) return []
  return nilai.map((satu) => (typeof satu === 'string' || typeof satu === 'number' ? String(satu) : ''))
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
  return { jawaban: state.jawaban }
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
