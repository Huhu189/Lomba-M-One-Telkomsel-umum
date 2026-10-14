/**
 * Pilihan teknik koreksi per jenis soal (cermin `Enums\TeknikKoreksi` +
 * `TipeSoal::teknikKoreksiTersedia()` di backend, 14 Oktober 2026).
 *
 * Pemilik produk: guru memilih cara mengoreksi untuk **setiap** jenis soal,
 * tetapi pilihannya tidak boleh menjanjikan yang mesin tidak bisa kerjakan.
 * Karena itu tabel di bawah ini kembar dengan PHP-nya, dan dijaga dua tes:
 * `teknikKoreksi.test.js` (di sini) serta Pest yang memeriksa tabel enum di
 * server. Kalau salah satu berubah, ubah keduanya.
 *
 * Hasil pilihannya ikut ke `kunci` soal (bukan `konten`), jadi tidak pernah
 * sampai ke perangkat murid.
 */
/**
 * Nilai tipe soal yang punya baris sendiri. Ditulis sebagai teks (bukan impor
 * `TIPE`) supaya berkas ini tidak saling mengimpor dengan `tipeSoal.js` —
 * `tipeSoal.js` yang memakai fungsi di sini.
 */
const TIPE_TUGAS_UNGGAH = 'tugas_unggah'
const TIPE_ISIAN_SINGKAT = 'isian_singkat'
const TIPE_URAIAN = 'uraian'

/** Nilai teknik — harus sama persis dengan enum backend. */
export const TEKNIK = {
  otomatis: 'otomatis',
  otomatisTeks: 'otomatis_teks',
  manual: 'manual',
}

/** Semua nilai teknik yang dikenal klien (dipakai memeriksa nilai asing). */
export const TEKNIK_DIKENAL = Object.values(TEKNIK)

/** Label pendek untuk tombol pilihan. */
export const LABEL_TEKNIK = {
  [TEKNIK.otomatis]: 'Otomatis',
  [TEKNIK.otomatisTeks]: 'Otomatis (teks)',
  [TEKNIK.manual]: 'Manual (guru)',
}

/** Satu kalimat tentang akibat pilihannya (dipakai sebagai bantuan di editor). */
export const KETERANGAN_TEKNIK = {
  [TEKNIK.otomatis]:
    'Dinilai mesin memakai kunci pasti. Tidak ada jawaban yang perlu ditinjau.',
  [TEKNIK.otomatisTeks]:
    'Dinilai mesin dengan toleransi ejaan/sinonim dan ambang, jadi salah ketik ringan masih dimaklumi. Jawaban yang ragu masuk antrean koreksi guru.',
  [TEKNIK.manual]:
    'Mesin tidak menilai sama sekali. Semua jawaban murid masuk antrean koreksi guru.',
}

/**
 * Tabel kembar dengan `TipeSoal::teknikKoreksiTersedia()`; urutan pertama
 * adalah bawaannya.
 * @type {Record<string, string[]>}
 */
const TABEL = {
  [TIPE_TUGAS_UNGGAH]: [TEKNIK.manual],
  [TIPE_ISIAN_SINGKAT]: [TEKNIK.otomatisTeks, TEKNIK.manual],
  [TIPE_URAIAN]: [TEKNIK.otomatisTeks, TEKNIK.manual],
}

/** Teknik bawaan untuk jenis yang tidak punya baris khusus di tabel. */
const BAWAAN = [TEKNIK.otomatis, TEKNIK.manual]

/**
 * Teknik yang boleh dipilih untuk satu jenis soal (pilihan pertama = bawaan).
 * @param {string} tipe
 * @returns {string[]}
 */
export function teknikKoreksiUntuk(tipe) {
  return TABEL[tipe] ?? BAWAAN
}

/**
 * Teknik bawaan jenis soal — dipakai saat guru tidak pernah memilih apa pun.
 * @param {string} tipe
 * @returns {string}
 */
export function teknikKoreksiBawaan(tipe) {
  return teknikKoreksiUntuk(tipe)[0]
}

/**
 * Apakah pilihan guru sah untuk jenis soal ini?
 *
 * Dipakai validasi editor **dan** pesan galat: kalau guru menyimpan soal
 * pilihan ganda dengan teknik "otomatis teks", editor tidak menebak-nebak —
 * ia menyuruh memilih ulang, sama seperti server (`RegistryTipeSoal::validasi`).
 *
 * @param {string} tipe
 * @param {unknown} nilai
 * @returns {boolean}
 */
export function teknikKoreksiSah(tipe, nilai) {
  return typeof nilai === 'string' && teknikKoreksiUntuk(tipe).includes(nilai)
}

/**
 * Teknik koreksi dari state editor: pilihan guru bila sah, kalau tidak bawaan.
 *
 * @param {{ tipe: string, teknikKoreksi?: string }} state
 * @returns {string}
 */
export function teknikKoreksiDariState(state) {
  return teknikKoreksiSah(state.tipe, state.teknikKoreksi)
    ? /** @type {string} */ (state.teknikKoreksi)
    : teknikKoreksiBawaan(state.tipe)
}

/**
 * Rincian pilihan untuk editor: nilai, label, keterangan, dan mana bawaannya.
 *
 * @param {string} tipe
 * @returns {Array<{ nilai: string, label: string, keterangan: string, bawaan: boolean }>}
 */
export function pilihanTeknikKoreksi(tipe) {
  const bawaan = teknikKoreksiBawaan(tipe)

  return teknikKoreksiUntuk(tipe).map((nilai) => ({
    nilai,
    label: LABEL_TEKNIK[nilai] ?? nilai,
    keterangan: KETERANGAN_TEKNIK[nilai] ?? '',
    bawaan: nilai === bawaan,
  }))
}

/**
 * Apakah jenis soal ini hanya punya satu teknik? Kalau ya, editor menampilkan
 * pilihannya sebagai keterangan terkunci, bukan tombol palsu yang tidak bisa
 * diganti.
 *
 * @param {string} tipe
 * @returns {boolean}
 */
export function teknikTerkunci(tipe) {
  return teknikKoreksiUntuk(tipe).length === 1
}
