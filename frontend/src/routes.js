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
  // Halaman akun sendiri (nama, kata sandi, tampilan). Setelan per ulangan
  // TIDAK di sini lagi — ia menyatu dengan kuisnya (lihat `kuisDetail`).
  pengaturan: '/pengaturan',
  // Bank soal, tag, dan kuis (slice 03).
  bankSoal: '/bank-soal',
  tag: '/tag',
  kuis: '/kuis',
  // Alamat kuis memakai SLUG acak, bukan id berurutan (lihat Kuis::slugBaru di
  // backend). Dengan `/kuis/191`, siapa pun yang sudah masuk bisa menyisir id
  // dan menebak kuis mana yang ada. Server tetap menerima id sebagai cadangan
  // supaya tautan lama hidup, jadi rute di bawah menerima keduanya.
  kuisDetail: '/kuis/:slug',
  // Pengerjaan & hasil ulangan (slice 04).
  // `/kerjakan/:kuisId` sengaja TETAP id numerik: salinan soal luring di
  // perangkat dikunci dengan `quiz_id` angka, dan halaman itu tidak pernah
  // dibagikan ke siapa pun — hanya dibuka dari sesi murid sendiri.
  kerjakanKuis: '/kerjakan/:kuisId',
  hasilAttempt: '/hasil/:attemptId',
  // Peringkat, laporan tema, badge, dan progres (slice 05).
  peringkatKuis: '/peringkat/:slug',
  laporanKuis: '/kuis/:slug/laporan',
  // Koreksi manual guru (slice 06).
  koreksiKuis: '/kuis/:slug/koreksi',
  // Monitor Ulangan guru (slice 07).
  monitorKuis: '/kuis/:slug/monitor',
  // Tim kuis mode kelompok (slice 09-C) — guru menyusun, murid melihat timnya.
  timKuis: '/kuis/:slug/tim',
  // Layar kelas (slice 10) — guru mengendalikan, perangkat murid mengikuti.
  layarKuis: '/kuis/:slug/layar',
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
 * Kunci kuis dari parameter rute, atau `''` bila tidak masuk akal.
 *
 * Halaman kuis dipanggil dengan slug ("unu5k") — angka masih diterima karena
 * server menyediakan cadangan id untuk tautan lama. Nilai lain (mis. berisi
 * garis miring atau spasi) ditolak sebelum sempat masuk ke alamat API.
 *
 * @param {unknown} nilai
 * @returns {string}
 */
export function kunciKuisSah(nilai) {
  return typeof nilai === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(nilai) ? nilai : ''
}

/**
 * Tautan detail kuis dari slug (angka lama tetap jalan).
 * @param {string|number} kunci
 * @returns {string}
 */
export function ruteKuisDetail(kunci) {
  return `/kuis/${encodeURIComponent(String(kunci))}`
}

/**
 * Tautan layar pengerjaan ulangan dari **id numerik** kuis.
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
 * Tautan halaman peringkat dari slug kuis.
 * @param {string|number} kunci
 * @returns {string}
 */
export function rutePeringkat(kunci) {
  return `/peringkat/${encodeURIComponent(String(kunci))}`
}

/**
 * Tautan laporan per tema (guru) dari slug kuis.
 * @param {string|number} kunci
 * @returns {string}
 */
export function ruteLaporanKuis(kunci) {
  return `/kuis/${encodeURIComponent(String(kunci))}/laporan`
}

/**
 * Tautan antrean koreksi manual (guru) dari slug kuis.
 * @param {string|number} kunci
 * @returns {string}
 */
export function ruteKoreksiKuis(kunci) {
  return `/kuis/${encodeURIComponent(String(kunci))}/koreksi`
}

/**
 * Tautan Monitor Ulangan (guru) dari slug kuis.
 * @param {string|number} kunci
 * @returns {string}
 */
export function ruteMonitorKuis(kunci) {
  return `/kuis/${encodeURIComponent(String(kunci))}/monitor`
}

/**
 * Tautan kelola tim (guru) dari slug kuis.
 * @param {string|number} kunci
 * @returns {string}
 */
export function ruteTimKuis(kunci) {
  return `/kuis/${encodeURIComponent(String(kunci))}/tim`
}

/**
 * Tautan layar kelas (guru) dari slug kuis.
 * @param {string|number} kunci
 * @returns {string}
 */
export function ruteLayarKuis(kunci) {
  return `/kuis/${encodeURIComponent(String(kunci))}/layar`
}

/**
 * Tautan editor materi (guru) dari id materi.
 * @param {number} id
 * @returns {string}
 */
export function ruteMateriEditor(id) {
  return `/materi/${id}/editor`
}
