/**
 * Peta halaman → pemuat malas (`MalasHalaman`), satu tempat untuk semuanya.
 *
 * Sebelum ini `App.jsx` mengimpor SEMUA halaman secara statis, jadi Vite
 * mengeluarkan satu berkas JS besar yang harus diunduh siapa pun yang membuka
 * aplikasi — termasuk halaman guru yang tidak akan pernah dibuka murid (editor
 * materi, monitor ulangan, koreksi manual) dan sebaliknya. Anak SD yang membuka
 * halaman ulangan di ponsel kelas ikut mengunduh alat-alat guru itu.
 *
 * Sekarang tiap halaman jadi berkasnya sendiri yang baru diunduh saat rutenya
 * dibuka (`MalasHalaman` menampilkan `MemuatHalaman` selama menunggu).
 *
 * Yang mengunduh bukan `React.lazy` melainkan pembungkus `MalasHalaman`: hasil
 * impor `lazy` tersimpan untuk selamanya, jadi satu kegagalan unduh (koneksi
 * putus tepat saat murid menekan menu) membuat rutenya menolak selamanya dan
 * galatnya menutup SELURUH aplikasi — termasuk ulangan yang sedang dikerjakan.
 * Pembungkus milik kita membatasi kegagalan itu ke halaman bersangkutan dan
 * menyediakan tombol "Coba lagi" yang benar-benar mengunduh ulang. Pemisahan
 * bundelnya sama saja: semuanya tetap impor dinamis, satu berkas per halaman.
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
import { malasHalaman } from './shared/ui/MalasHalaman.jsx'
import { RUTE } from './routes.js'

/**
 * Pemuat modul tiap halaman.
 *
 * Hanya di sini jalur impornya ditulis, jadi halaman malas di bawah dan
 * pramuat tautan menu tidak mungkin menunjuk modul yang berbeda.
 */
const muat = {
  // Auth (slice 01).
  daftar: () => import('./sections/auth/halaman/HalamanDaftar.jsx'),
  lupaSandi: () => import('./sections/auth/halaman/HalamanLupaSandi.jsx'),
  masukTamu: () => import('./sections/auth/halaman/HalamanMasukTamu.jsx'),
  aturUlangSandi: () => import('./sections/auth/halaman/HalamanAturUlangSandi.jsx'),
  buatSandi: () => import('./sections/auth/halaman/HalamanBuatSandi.jsx'),
  verifikasiEmail: () => import('./sections/auth/halaman/HalamanVerifikasiEmail.jsx'),
  perluVerifikasi: () => import('./sections/auth/halaman/HalamanPerluVerifikasi.jsx'),

  // Data induk & akun (slice 02).
  akun: () => import('./sections/settings/halaman/HalamanAkun.jsx'),
  // Panel admin sekolah (14 Okt 2026) — hanya peran admin.
  adminAkun: () => import('./sections/admin/halaman/HalamanAkunSekolah.jsx'),
  kelas: () => import('./sections/school/halaman/HalamanKelas.jsx'),
  mapel: () => import('./sections/school/halaman/HalamanMapel.jsx'),
  murid: () => import('./sections/school/halaman/HalamanMurid.jsx'),
  imporMurid: () => import('./sections/school/halaman/HalamanImporMurid.jsx'),

  // Bank soal, tag, dan kuis (slice 03).
  bankSoal: () => import('./sections/question/halaman/HalamanBankSoal.jsx'),
  tag: () => import('./sections/question/halaman/HalamanTag.jsx'),
  kuis: () => import('./sections/quiz/halaman/PilihHalamanKuis.jsx'),
  kuisDetail: () => import('./sections/quiz/halaman/HalamanKuisDetail.jsx'),

  // Pengerjaan & hasil ulangan (slice 04).
  kerjakan: () => import('./sections/attempt/halaman/HalamanKerjakan.jsx'),
  hasil: () => import('./sections/attempt/halaman/HalamanHasil.jsx'),
  tim: () => import('./sections/attempt/halaman/HalamanTim.jsx'),

  // Peringkat, laporan, lencana, progres, koreksi (slice 05–06).
  peringkat: () => import('./sections/report/halaman/HalamanPeringkat.jsx'),
  laporan: () => import('./sections/report/halaman/HalamanLaporan.jsx'),
  badge: () => import('./sections/report/halaman/HalamanBadge.jsx'),
  progresTema: () => import('./sections/report/halaman/HalamanProgresTema.jsx'),
  koreksi: () => import('./sections/scoring/halaman/HalamanKoreksi.jsx'),

  // Anti-cheat & layar kelas (slice 07, 10).
  monitor: () => import('./sections/cheat/halaman/HalamanMonitor.jsx'),
  layar: () => import('./sections/presence/halaman/HalamanLayar.jsx'),

  // Materi & avatar (slice 08).
  materi: () => import('./sections/material/halaman/PilihHalamanMateri.jsx'),
  editorMateri: () => import('./sections/material/editor/EditorMateri.jsx'),
  avatar: () => import('./sections/avatar/halaman/PilihHalamanAvatar.jsx'),
}

// Halaman auth.
export const HalamanDaftar = malasHalaman(muat.daftar)
export const HalamanLupaSandi = malasHalaman(muat.lupaSandi)
export const HalamanMasukTamu = malasHalaman(muat.masukTamu)
export const HalamanAturUlangSandi = malasHalaman(muat.aturUlangSandi)
export const HalamanBuatSandi = malasHalaman(muat.buatSandi)
export const HalamanVerifikasiEmail = malasHalaman(muat.verifikasiEmail)
export const HalamanPerluVerifikasi = malasHalaman(muat.perluVerifikasi)

// Data induk & akun.
export const HalamanAkun = malasHalaman(muat.akun)
export const HalamanAkunSekolah = malasHalaman(muat.adminAkun)
export const HalamanKelas = malasHalaman(muat.kelas)
export const HalamanMapel = malasHalaman(muat.mapel)
export const HalamanMurid = malasHalaman(muat.murid)
export const HalamanImporMurid = malasHalaman(muat.imporMurid)

// Bank soal, tag, dan kuis.
export const HalamanBankSoal = malasHalaman(muat.bankSoal)
export const HalamanTag = malasHalaman(muat.tag)
export const PilihHalamanKuis = malasHalaman(muat.kuis)
export const HalamanKuisDetail = malasHalaman(muat.kuisDetail)

// Pengerjaan & hasil ulangan.
export const HalamanKerjakan = malasHalaman(muat.kerjakan)
export const HalamanHasil = malasHalaman(muat.hasil)
export const HalamanTim = malasHalaman(muat.tim)

// Peringkat, laporan, lencana, progres, koreksi.
export const HalamanPeringkat = malasHalaman(muat.peringkat)
export const HalamanLaporan = malasHalaman(muat.laporan)
export const HalamanBadge = malasHalaman(muat.badge)
export const HalamanProgresTema = malasHalaman(muat.progresTema)
export const HalamanKoreksi = malasHalaman(muat.koreksi)

// Anti-cheat & layar kelas.
export const HalamanMonitor = malasHalaman(muat.monitor)
export const HalamanLayar = malasHalaman(muat.layar)

// Materi & avatar.
export const PilihHalamanMateri = malasHalaman(muat.materi)
export const EditorMateri = malasHalaman(muat.editorMateri)
export const PilihHalamanAvatar = malasHalaman(muat.avatar)

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
  [RUTE.adminAkun]: muat.adminAkun,
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
