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
  // Peringkat, laporan tema, badge, dan progres (slice 05).
  peringkatKuis: '/peringkat/:kuisId',
  laporanKuis: '/kuis/:id/laporan',
  // Koreksi manual guru (slice 06).
  koreksiKuis: '/kuis/:id/koreksi',
  // Live Monitor guru (slice 07).
  monitorKuis: '/kuis/:id/monitor',
  // Tim kuis mode kelompok (slice 09-C) — guru menyusun, murid melihat timnya.
  timKuis: '/kuis/:id/tim',
  // Layar kelas (slice 10) — guru mengendalikan, perangkat murid mengikuti.
  layarKuis: '/kuis/:id/layar',
  // Materi berblok (slice 08) — guru menyusun, murid menempuh.
  materi: '/materi',
  // Editor materi guru (gaya video editor) — dibuka setelah materi dibuat.
  materiEditor: '/materi/:id/editor',
  // Avatar murid + moderasi (slice 08) — murid memasang, guru meninjau laporan.
  avatar: '/avatar',
  badge: '/badge',
  progresTema: '/progres-tema',
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

/**
 * Tautan halaman peringkat dari id kuis.
 * @param {number} id
 * @returns {string}
 */
export function rutePeringkat(id) {
  return `/peringkat/${id}`
}

/**
 * Tautan laporan per tema (guru) dari id kuis.
 * @param {number} id
 * @returns {string}
 */
export function ruteLaporanKuis(id) {
  return `/kuis/${id}/laporan`
}

/**
 * Tautan antrean koreksi manual (guru) dari id kuis.
 * @param {number} id
 * @returns {string}
 */
export function ruteKoreksiKuis(id) {
  return `/kuis/${id}/koreksi`
}

/**
 * Tautan Live Monitor (guru) dari id kuis.
 * @param {number} id
 * @returns {string}
 */
export function ruteMonitorKuis(id) {
  return `/kuis/${id}/monitor`
}

/**
 * Tautan kelola tim (guru) dari id kuis.
 * @param {number} id
 * @returns {string}
 */
export function ruteTimKuis(id) {
  return `/kuis/${id}/tim`
}

/**
 * Tautan layar kelas (guru) dari id kuis.
 * @param {number} id
 * @returns {string}
 */
export function ruteLayarKuis(id) {
  return `/kuis/${id}/layar`
}

/**
 * Tautan editor materi (guru) dari id materi.
 * @param {number} id
 * @returns {string}
 */
export function ruteMateriEditor(id) {
  return `/materi/${id}/editor`
}
