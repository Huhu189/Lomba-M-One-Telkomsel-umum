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
  // Pengerjaan & hasil ulangan (slice 04).
  kerjakanKuis: '/kerjakan/:kuisId',
  hasilAttempt: '/hasil/:attemptId',
}

/**
 * Tautan detail kuis dari id.
 * @param {number} id
 * @returns {string}
 */
export function ruteKuisDetail(id) {
  return `/kuis/${id}`
}

/**
 * Tautan layar pengerjaan ulangan dari id kuis.
 * @param {number} id
 * @returns {string}
 */
export function ruteKerjakanKuis(id) {
  return `/kerjakan/${id}`
}

/**
 * Tautan halaman hasil dari id attempt.
 * @param {number} id
 * @returns {string}
 */
export function ruteHasil(id) {
  return `/hasil/${id}`
}
