/**
 * Perhitungan murni panel admin sekolah (14 Okt 2026).
 *
 * Beranda admin menjawab pertanyaan yang berbeda dari beranda guru: bukan "kuis
 * apa yang harus saya pantau", melainkan "bagaimana keadaan sekolah ini
 * sekarang". Semua perhitungan di sini murni (tanpa DOM/React) supaya bisa diuji
 * dengan angka tetap, dan supaya halamannya tinggal menampilkan hasilnya.
 *
 * @typedef {import('./api.js').AkunSekolah} AkunSekolah
 * @typedef {import('./api.js').MonitorSekolah} MonitorSekolah
 * @typedef {import('./api.js').KelasSekolah} KelasSekolah
 */

/**
 * Satu baris yang perlu perhatian admin sekolah.
 * @typedef {{ jenis: 'mengerjakan'|'koreksi'|'verifikasi'|'ditangguhkan'|'kejadian', judul: string, ket: string, aksi: string }} ItemPerhatianSekolah
 */

/**
 * Urutkan kelas untuk tampilan: tingkat dulu, lalu nama.
 *
 * Server mengurutkan sama, tetapi dasbor menggabungkan data dari beberapa
 * bagian dan memfilter di klien — tanpa pengurutan ulang di sini, kelas hasil
 * gabungan bisa tampil tidak beraturan.
 *
 * @param {KelasSekolah[]} daftar
 * @returns {KelasSekolah[]}
 */
export function urutKelas(daftar) {
  return [...daftar].sort((a, b) => {
    if (a.tingkat !== b.tingkat) return a.tingkat - b.tingkat
    return a.nama.localeCompare(b.nama, 'id')
  })
}

/**
 * Ringkasan kapasitas kelas — dipakai untuk membaca keadaan data induk sekilas.
 *
 * @param {KelasSekolah[]} daftar
 * @returns {{ jumlahMurid: number, kelasKosong: number, terbesar: KelasSekolah|null }}
 */
export function ringkasKelas(daftar) {
  if (daftar.length === 0) return { jumlahMurid: 0, kelasKosong: 0, terbesar: null }

  let terbesar = daftar[0]

  for (const kelas of daftar) {
    if (kelas.jumlah_murid > terbesar.jumlah_murid) terbesar = kelas
  }

  return {
    jumlahMurid: daftar.reduce((jumlah, kelas) => jumlah + kelas.jumlah_murid, 0),
    kelasKosong: daftar.filter((kelas) => kelas.jumlah_murid === 0).length,
    terbesar,
  }
}

/**
 * Badge status satu akun di tabel kelola akun.
 *
 * Status "aktif" tidak otomatis berarti sehat: akun aktif yang emailnya belum
 * diverifikasi tetap ditolak di semua jalur masuk, jadi ia ditandai peringatan —
 * itu justru keadaan yang paling sering dicari admin di daftar ini.
 *
 * @param {AkunSekolah} akun
 * @returns {{ label: string, jenis: 'sukses'|'peringatan'|'salah'|'lembut' }}
 */
export function statusAkunTampilan(akun) {
  switch (akun.status) {
    case 'aktif':
      return akun.terverifikasi
        ? { label: 'Aktif', jenis: 'sukses' }
        : { label: 'Belum terverifikasi', jenis: 'peringatan' }
    case 'suspended':
      return { label: akun.status_label || 'Ditangguhkan', jenis: 'salah' }
    case 'dihapus':
      return { label: akun.status_label || 'Dihapus', jenis: 'salah' }
    default:
      return { label: akun.status_label || 'Menunggu verifikasi', jenis: 'lembut' }
  }
}

/**
 * Daftar "perlu perhatian" di beranda admin — hanya dari keadaan yang benar-benar
 * ada, bukan contoh. Urutannya: yang sedang bergerak hari ini lebih dulu
 * (mengerjakan → koreksi → verifikasi → penangguhan → sinyal kecurangan).
 *
 * @param {{ murid: MonitorSekolah['murid'], guru: MonitorSekolah['guru'], kuis: MonitorSekolah['kuis'] }} data
 * @returns {ItemPerhatianSekolah[]}
 */
export function perluPerhatianSekolah({ murid, guru, kuis }) {
  /** @type {ItemPerhatianSekolah[]} */
  const daftar = []

  if (murid.mengerjakan > 0) {
    daftar.push({
      jenis: 'mengerjakan',
      judul: `${murid.mengerjakan} murid sedang mengerjakan`,
      ket: 'Ulangan yang sedang berjalan di sekolah ini.',
      aksi: 'Buka monitor',
    })
  }

  if (kuis.koreksi_menunggu > 0) {
    daftar.push({
      jenis: 'koreksi',
      judul: `${kuis.koreksi_menunggu} jawaban menunggu koreksi`,
      ket: 'Soal isian dan uraian yang perlu ditinjau guru.',
      aksi: 'Buka daftar kuis',
    })
  }

  if (murid.belum_verifikasi > 0) {
    daftar.push({
      jenis: 'verifikasi',
      judul: `${murid.belum_verifikasi} akun murid belum terverifikasi`,
      ket: 'Akun itu ditolak di semua jalur masuk sampai emailnya diverifikasi.',
      aksi: 'Kelola akun',
    })
  }

  const ditangguhkan = murid.ditangguhkan + guru.ditangguhkan

  if (ditangguhkan > 0) {
    daftar.push({
      jenis: 'ditangguhkan',
      judul: `${ditangguhkan} akun sedang ditangguhkan`,
      ket: 'Periksa apakah penangguhannya masih perlu berlaku.',
      aksi: 'Kelola akun',
    })
  }

  if (kuis.kejadian_hari_ini > 0) {
    daftar.push({
      jenis: 'kejadian',
      judul: `${kuis.kejadian_hari_ini} sinyal kecurangan hari ini`,
      ket: 'Bahan tinjauan guru, bukan vonis.',
      aksi: 'Buka monitor',
    })
  }

  return daftar
}

/**
 * Peran akun dari sisi admin: guru dan murid diperlakukan berbeda saat
 * mengelola akun (guru punya 2 sesi kelas, murid tidak).
 *
 * @param {AkunSekolah} akun
 * @returns {string}
 */
export function kelasAkun(akun) {
  if (akun.peran === 'murid') return akun.kelas_nama ?? 'Tanpa kelas'
  return 'Guru'
}

/**
 * Waktu lampau berbahasa Indonesia dari ISO server ("baru saja", "5 menit lalu").
 *
 * Dipakai untuk "terakhir aktif" dan jejak audit. Waktu kosong ditampilkan "—"
 * supaya tabel tidak pernah menampilkan "Invalid Date".
 *
 * @param {string|null|undefined} iso
 * @param {Date} [sekarang]
 * @returns {string}
 */
export function waktuLalu(iso, sekarang = new Date()) {
  if (iso === null || iso === undefined || iso === '') return '—'

  const waktu = new Date(iso)
  if (Number.isNaN(waktu.getTime())) return '—'

  const detik = Math.floor((sekarang.getTime() - waktu.getTime()) / 1000)

  if (detik < 0) return 'baru saja'
  if (detik < 60) return 'baru saja'
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`
  if (detik < 86_400) return `${Math.floor(detik / 3600)} jam lalu`
  if (detik < 604_800) return `${Math.floor(detik / 86_400)} hari lalu`

  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(waktu)
}
