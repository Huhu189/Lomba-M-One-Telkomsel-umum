/**
 * Judul & deskripsi per halaman (SEO + judul tab).
 *
 * Aplikasi ini SPA: tanpa ini seluruh halaman memakai judul yang sama
 * ("Ulangan Sekolah") dan deskripsi kosong — mesin pencari hanya melihat satu
 * dokumen untuk puluhan halaman, dan buku jendela peramban tidak membantu
 * pengguna membedakan tab.
 *
 * Aturan yang dipakai:
 * - **Halaman publik** (beranda, masuk, daftar, lupa sandi) boleh diindeks —
 *   itulah halaman yang menjelaskan aplikasinya kepada orang luar.
 * - **Halaman aplikasi** (butuh sesi: kuis, materi, bank soal, laporan, panel
 *   admin, dst.) diarahkan `noindex, follow`: isinya data sekolah per pengguna,
 *   tidak ada gunanya di indeks dan tidak boleh bocor isinya ke cuplikan
 *   pencarian. Larangan menautkan tetap `follow` supaya tautan di dalamnya tidak
 *   "mati" bagi perayap.
 *
 * Murni (tanpa efek samping) supaya bisa diuji tanpa DOM; yang menyentuh
 * dokumen hanya `pasangMeta`.
 */
import { RUTE } from '../../routes.js'

/** Judul & deskripsi cadangan (halaman yang tidak dikenal). */
export const META_BAWAAN = {
  judul: 'Ulangan Sekolah',
  deskripsi:
    'Aplikasi ulangan dan materi sekolah: guru menyusun soal, murid mengerjakan dari tautan kelas, ' +
    'dan nilainya terkumpul otomatis.',
  robotika: 'noindex, follow',
}

/**
 * Halaman publik yang memang pantas diindeks: kunci = jalur persis, nilai =
 * judul + deskripsi untuk mesin pencari dan manusia.
 */
export const META_PUBLIK = {
  [RUTE.beranda]: {
    judul: 'Ulangan Sekolah — Ulangan & materi kelas dalam satu aplikasi',
    deskripsi:
      'Buat ulangan, koreksi otomatis, dan materi berjalan untuk kelasmu. Murid bisa ikut lewat ' +
      'tautan kelas — dengan akun sekolah atau sebagai siswa tamu tanpa akun.',
    robotika: 'index, follow',
  },
  [RUTE.masuk]: {
    judul: 'Masuk — Ulangan Sekolah',
    deskripsi:
      'Masuk dengan akun sekolah atau lewat Google. Murid yang membuka tautan ulangan bisa ikut ' +
      'sebagai siswa tamu tanpa akun.',
    robotika: 'index, follow',
  },
  [RUTE.masukTamu]: {
    judul: 'Masuk sebagai siswa tamu — Ulangan Sekolah',
    deskripsi: 'Ikut ulangan dari tautan gurumu cukup dengan menulis nama, tanpa akun dan tanpa kata sandi.',
    robotika: 'noindex, follow',
  },
  [RUTE.daftar]: {
    judul: 'Daftar sebagai murid — Ulangan Sekolah',
    deskripsi: 'Buat akun murid untuk mengerjakan ulangan dan membuka materi kelasmu.',
    robotika: 'index, follow',
  },
  [RUTE.lupaSandi]: {
    judul: 'Lupa kata sandi — Ulangan Sekolah',
    deskripsi: 'Minta tautan atur ulang kata sandi untuk akun sekolahmu.',
    robotika: 'noindex, follow',
  },
}

/**
 * Awalan jalur aplikasi beserta judulnya. Urutan penting: awalan yang lebih
 * panjang diperiksa lebih dulu (mis. `/kuis/x/koreksi` sebelum `/kuis`).
 */
export const META_APLIKASI = [
  ['/kuis/', 'laporan', 'Laporan kuis'],
  ['/kuis/', 'koreksi', 'Koreksi jawaban'],
  ['/kuis/', 'monitor', 'Monitor ulangan'],
  ['/kuis/', 'tim', 'Tim kuis'],
  ['/kuis/', 'layar', 'Layar kelas'],
]

/** Awalan jalur sederhana → judul bagian. */
const AWALAN = [
  [RUTE.kerjakanKuis.split('/:')[0], 'Mengerjakan ulangan'],
  [RUTE.hasilAttempt.split('/:')[0], 'Hasil ulangan'],
  [RUTE.peringkatKuis.split('/:')[0], 'Peringkat'],
  [RUTE.kuisDetail.split('/:')[0], 'Kuis'],
  [RUTE.materiEditor.split('/:')[0], 'Materi'],
  ['/bank-soal', 'Bank soal'],
  ['/murid', 'Data murid'],
  ['/kelas', 'Kelas'],
  ['/mapel', 'Mata pelajaran'],
  ['/tag', 'Tag soal'],
  ['/pengaturan', 'Akun & setelan'],
  ['/admin/akun', 'Kelola akun sekolah'],
  ['/admin/', 'Panel admin sekolah'],
  ['/avatar', 'Avatar'],
  ['/badge', 'Lencana'],
  ['/progres-tema', 'Progres tema'],
  ['/perlu-verifikasi', 'Verifikasi email'],
  ['/verifikasi-email', 'Verifikasi email'],
  ['/atur-ulang-sandi', 'Atur ulang kata sandi'],
  ['/buat-sandi', 'Buat kata sandi'],
]

/**
 * Judul, deskripsi, dan arahan robot untuk satu jalur.
 *
 * Judul selalu berakhiran nama aplikasi supaya tab peramban tetap terbaca saat
 * dipersempit, dan `?query` diabaikan (`/kuis/abc?tab=soal` = halaman yang sama).
 *
 * @param {string} jalur contoh: `/kuis/abc123/laporan`
 * @returns {{ judul: string, deskripsi: string, robotika: string }}
 */
export function metaUntukJalur(jalur) {
  const bersih = (jalur.split('?')[0] || '/').replace(/\/+$/, '') || '/'

  const publik = META_PUBLIK[bersih]
  if (publik) return publik

  for (const [awalan, penanda, judul] of META_APLIKASI) {
    if (bersih.startsWith(awalan) && bersih.includes(`/${penanda}`)) {
      return { judul: `${judul} — Ulangan Sekolah`, deskripsi: META_BAWAAN.deskripsi, robotika: 'noindex, follow' }
    }
  }

  for (const [awalan, judul] of AWALAN) {
    if (awalan !== '/' && (bersih === awalan || bersih.startsWith(`${awalan}/`))) {
      return { judul: `${judul} — Ulangan Sekolah`, deskripsi: META_BAWAAN.deskripsi, robotika: 'noindex, follow' }
    }
  }

  return META_BAWAAN
}

/**
 * Terapkan meta satu jalur ke dokumen: judul tab + `<meta name="description">`
 * + `<meta name="robots">`. Elemen meta dibuat sekali bila belum ada, jadi
 * halaman pertama pun mendapatkannya walau `index.html` tidak memuatnya.
 *
 * @param {string} jalur
 * @param {Document} [dokumen] dipakai uji; bawaan `document` peramban
 */
export function pasangMeta(jalur, dokumen = document) {
  const { judul, deskripsi, robotika } = metaUntukJalur(jalur)

  dokumen.title = judul

  /**
   * @param {string} nama nama meta (mis. `description`)
   * @param {string} isi isi meta yang dipasang/diganti
   */
  const atur = (nama, isi) => {
    let el = dokumen.head?.querySelector(`meta[name="${nama}"]`)
    if (!el) {
      el = dokumen.createElement('meta')
      el.setAttribute('name', nama)
      dokumen.head?.appendChild(el)
    }
    el.setAttribute('content', isi)
  }

  atur('description', deskripsi)
  atur('robots', robotika)
}
