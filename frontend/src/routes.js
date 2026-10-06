/**
 * Peta rute aplikasi (chunk structure: satu sumber kebenaran path).
 */
export const RUTE = {
  beranda: '/',
  masuk: '/masuk',
  daftar: '/daftar',
  lupaSandi: '/lupa-sandi',
  aturUlangSandi: '/atur-ulang-sandi',
  verifikasiEmail: '/verifikasi-email',
  perluVerifikasi: '/perlu-verifikasi',
  // Data induk & pengaturan (slice 02).
  kelas: '/kelas',
  mapel: '/mapel',
  murid: '/murid',
  imporMurid: '/murid/impor',
  pengaturan: '/pengaturan',
  // Bank soal, tag, dan kuis (slice 03).
  bankSoal: '/bank-soal',
  tag: '/tag',
  kuis: '/kuis',
  kuisDetail: '/kuis/:id',
}

/**
 * Tautan detail kuis dari id.
 * @param {number} id
 * @returns {string}
 */
export function ruteKuisDetail(id) {
  return `/kuis/${id}`
}
