/**
 * Peta halaman → pemuat malas (`React.lazy`), satu tempat untuk semuanya.
 *
 * Sebelum ini `App.jsx` mengimpor SEMUA halaman secara statis, jadi Vite
 * mengeluarkan satu berkas JS besar yang harus diunduh siapa pun yang membuka
 * aplikasi — termasuk halaman guru yang tidak akan pernah dibuka murid (editor
 * materi, monitor ulangan, koreksi manual) dan sebaliknya. Anak SD yang membuka
 * halaman ulangan di ponsel kelas ikut mengunduh alat-alat guru itu.
 *
 * Sekarang tiap halaman jadi berkasnya sendiri yang baru diunduh saat rutenya
 * dibuka (`Suspense` menampilkan `MemuatHalaman` selama menunggu).
 *
 * Yang tetap statis sengaja hanya kerangka aplikasi dan tiga halaman pertama
 * yang paling sering dilihat: `Beranda` (mendaratnya semua orang, termasuk
 * tamu), `HalamanMasuk` (pintu masuk hampir semua pengguna), dan
 * `HalamanTidakDitemukan` (404 harus muncul tanpa menunggu apa pun).
 *
 * Peta `pramuat` dipakai `KerangkaUmum` untuk mulai mengunduh modul halaman
 * begitu tautan menunya disorot atau difokus — jadi bundel awalnya kecil TAPI
 * perpindahan menu tetap terasa seketika.
 */
import { lazy } from 'react'
import { RUTE } from './routes.js'

/**
 * Pemuat modul tiap halaman.
 *
 * Hanya di sini jalur impornya ditulis, jadi `lazy` di bawah dan pramuat
 * tautan menu tidak mungkin menunjuk modul yang berbeda.
 */
const muat = {
  // Auth (slice 01).
  daftar: () => import('./sections/auth/HalamanDaftar.jsx'),
  lupaSandi: () => import('./sections/auth/HalamanLupaSandi.jsx'),
  aturUlangSandi: () => import('./sections/auth/HalamanAturUlangSandi.jsx'),
  verifikasiEmail: () => import('./sections/auth/HalamanVerifikasiEmail.jsx'),
  perluVerifikasi: () => import('./sections/auth/HalamanPerluVerifikasi.jsx'),

  // Data induk & akun (slice 02).
  akun: () => import('./sections/settings/HalamanAkun.jsx'),
  kelas: () => import('./sections/school/HalamanKelas.jsx'),
  mapel: () => import('./sections/school/HalamanMapel.jsx'),
  murid: () => import('./sections/school/HalamanMurid.jsx'),
  imporMurid: () => import('./sections/school/HalamanImporMurid.jsx'),

  // Bank soal, tag, dan kuis (slice 03).
  bankSoal: () => import('./sections/question/HalamanBankSoal.jsx'),
  tag: () => import('./sections/question/HalamanTag.jsx'),
  kuis: () => import('./sections/quiz/PilihHalamanKuis.jsx'),
  kuisDetail: () => import('./sections/quiz/HalamanKuisDetail.jsx'),

  // Pengerjaan & hasil ulangan (slice 04).
  kerjakan: () => import('./sections/attempt/HalamanKerjakan.jsx'),
  hasil: () => import('./sections/attempt/HalamanHasil.jsx'),
  tim: () => import('./sections/attempt/HalamanTim.jsx'),

  // Peringkat, laporan, lencana, progres, koreksi (slice 05–06).
  peringkat: () => import('./sections/report/HalamanPeringkat.jsx'),
  laporan: () => import('./sections/report/HalamanLaporan.jsx'),
  badge: () => import('./sections/report/HalamanBadge.jsx'),
  progresTema: () => import('./sections/report/HalamanProgresTema.jsx'),
  koreksi: () => import('./sections/scoring/HalamanKoreksi.jsx'),

  // Anti-cheat & layar kelas (slice 07, 10).
  monitor: () => import('./sections/cheat/HalamanMonitor.jsx'),
  layar: () => import('./sections/presence/HalamanLayar.jsx'),

  // Materi & avatar (slice 08).
  materi: () => import('./sections/material/PilihHalamanMateri.jsx'),
  editorMateri: () => import('./sections/material/EditorMateri.jsx'),
  avatar: () => import('./sections/avatar/PilihHalamanAvatar.jsx'),
}

// Halaman auth.
export const HalamanDaftar = lazy(muat.daftar)
export const HalamanLupaSandi = lazy(muat.lupaSandi)
export const HalamanAturUlangSandi = lazy(muat.aturUlangSandi)
export const HalamanVerifikasiEmail = lazy(muat.verifikasiEmail)
export const HalamanPerluVerifikasi = lazy(muat.perluVerifikasi)

// Data induk & akun.
export const HalamanAkun = lazy(muat.akun)
export const HalamanKelas = lazy(muat.kelas)
export const HalamanMapel = lazy(muat.mapel)
export const HalamanMurid = lazy(muat.murid)
export const HalamanImporMurid = lazy(muat.imporMurid)

// Bank soal, tag, dan kuis.
export const HalamanBankSoal = lazy(muat.bankSoal)
export const HalamanTag = lazy(muat.tag)
export const PilihHalamanKuis = lazy(muat.kuis)
export const HalamanKuisDetail = lazy(muat.kuisDetail)

// Pengerjaan & hasil ulangan.
export const HalamanKerjakan = lazy(muat.kerjakan)
export const HalamanHasil = lazy(muat.hasil)
export const HalamanTim = lazy(muat.tim)

// Peringkat, laporan, lencana, progres, koreksi.
export const HalamanPeringkat = lazy(muat.peringkat)
export const HalamanLaporan = lazy(muat.laporan)
export const HalamanBadge = lazy(muat.badge)
export const HalamanProgresTema = lazy(muat.progresTema)
export const HalamanKoreksi = lazy(muat.koreksi)

// Anti-cheat & layar kelas.
export const HalamanMonitor = lazy(muat.monitor)
export const HalamanLayar = lazy(muat.layar)

// Materi & avatar.
export const PilihHalamanMateri = lazy(muat.materi)
export const EditorMateri = lazy(muat.editorMateri)
export const PilihHalamanAvatar = lazy(muat.avatar)

/**
 * Jalur rute tetap → pemuat modulnya.
 *
 * Hanya jalur tanpa parameter yang ada di sini: tautan menu (`/kelas`,
 * `/bank-soal`, …) memang tetap. Rute berparameter (`/kuis/:slug`) tidak bisa
 * dipramuat dari jalurnya karena isinya baru diketahui saat diklik.
 *
 * @type {Record<string, () => Promise<unknown>>}
 */
const pramuat = {
  [RUTE.imporMurid]: muat.imporMurid,
  [RUTE.pengaturan]: muat.akun,
  [RUTE.kelas]: muat.kelas,
  [RUTE.mapel]: muat.mapel,
  [RUTE.murid]: muat.murid,
  [RUTE.bankSoal]: muat.bankSoal,
  [RUTE.tag]: muat.tag,
  [RUTE.kuis]: muat.kuis,
  [RUTE.materi]: muat.materi,
  [RUTE.avatar]: muat.avatar,
  [RUTE.badge]: muat.badge,
  [RUTE.progresTema]: muat.progresTema,
}

/**
 * Pemuat modul halaman untuk `jalur`, atau `null` bila jalur itu bukan halaman
 * tetap (rute berparameter, 404, atau jalur asing).
 *
 * Sengaja hanya MENGEMBALIKAN pemuatnya: pemanggil yang memutuskan kapan
 * mengunduh, dan tes bisa memeriksa peta ini tanpa benar-benar mengeksekusi
 * impor modul halaman.
 *
 * @param {string} jalur
 * @returns {(() => Promise<unknown>)|null}
 */
export function pemuatHalaman(jalur) {
  return pramuat[jalur] ?? null
}

/**
 * Mulai unduh modul halaman `jalur` lebih awal (dipanggil saat tautan menu
 * disorot atau difokus). Vite menyimpan modul yang sudah diunduh, jadi
 * `lazy`-nya nanti tidak mengunduh dua kali.
 *
 * Kegagalan di sini sengaja didiamkan: pramuat hanyalah percepatan. Kalau
 * modulnya memang tidak bisa diunduh, navigasi ke halaman itu sendirilah yang
 * akan menampilkan galatnya (`BatasGalatUlangan`/batas galat aplikasi) — di
 * sini `catch` hanya menjaga hal itu tidak muncul sebagai unhandled rejection
 * di konsol.
 *
 * @param {string} jalur
 * @returns {void}
 */
export function pramuatHalaman(jalur) {
  const pemuat = pemuatHalaman(jalur)
  if (!pemuat) return
  pemuat().catch(() => {})
}
