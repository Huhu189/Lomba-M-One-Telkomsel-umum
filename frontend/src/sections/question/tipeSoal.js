/**
 * Registry tipe soal sisi klien — cermin App\Sections\Question\Enums\TipeSoal
 * dan RegistryTipeSoal di backend.
 *
 * Empat tipe objektif sudah bisa disimpan (pilihan ganda, benar/salah,
 * menjodohkan, mengurutkan); empat tipe esai tetap tampil di pilihan agar
 * guru tahu urutannya, tetapi ditandai belum tersedia (backend menolaknya).
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

/** Tipe yang didukung penuh sekarang (soal objektif). */
export const TIPE_OBJEKTIF = [
  TIPE.pilihanGanda,
  TIPE.benarSalah,
  TIPE.menjodohkan,
  TIPE.mengurutkan,
]

/** Isi <select> tipe soal pada editor. */
export const DAFTAR_TIPE = Object.keys(LABEL_TIPE).map((nilai) => ({
  nilai,
  label: LABEL_TIPE[nilai],
  objektif: TIPE_OBJEKTIF.includes(nilai),
}))

/** Batas opsi pilihan ganda (cermin PenanganPilihanGanda). */
export const MIN_OPSI = 2
export const MAKS_OPSI = 6

/** Minimal pasangan menjodohkan / item mengurutkan. */
export const MIN_ITEM = 2

/** Batas panjang teks MathML (cermin BantuanKonten::galatMatematika). */
export const MAKS_MATEMATIKA = 2000

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

  if (state.tipe === TIPE.mengurutkan) {
    konten.item = state.item.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
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
  return { jawaban: state.jawaban }
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
