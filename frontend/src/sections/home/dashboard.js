/**
 * Perhitungan murni beranda berbasis tugas (papan desain 2 "Beranda guru").
 *
 * Beranda lama hanya menampilkan peran, status akun, dan kalimat "akan muncul
 * di sini" (temuan 04). Yang benar-benar dibutuhkan guru adalah: apa yang perlu
 * perhatian sekarang, angka ringkas, dan jadwal kuis. Semua perhitungan di sini
 * murni (tanpa DOM/React) supaya bisa diuji dengan tanggal tetap.
 */

/**
 * @typedef {{
 *   id: number,
 *   judul: string,
 *   status: string,
 *   sedang_berjalan: boolean,
 *   mulai_at: string|null,
 *   kelas_nama?: string,
 *   jumlah_soal?: number,
 * }} KuisRingkas
 *
 * @typedef {{ jenis: 'monitor'|'koreksi'|'avatar', judul: string, ket: string, aksi: string }} ItemPerhatian
 */

/**
 * Apakah sebuah ISO jatuh pada hari yang sama (waktu lokal) dengan acuan.
 * @param {string|null} iso
 * @param {Date} acuan
 * @returns {boolean}
 */
export function diHariIni(iso, acuan) {
  if (iso === null) return false
  const waktu = new Date(iso)
  if (Number.isNaN(waktu.getTime())) return false
  return (
    waktu.getFullYear() === acuan.getFullYear() &&
    waktu.getMonth() === acuan.getMonth() &&
    waktu.getDate() === acuan.getDate()
  )
}

/**
 * Apakah sebuah ISO jatuh pada minggu yang sama (Senin–Minggu, waktu lokal).
 * @param {string|null} iso
 * @param {Date} acuan
 * @returns {boolean}
 */
export function diMingguIni(iso, acuan) {
  if (iso === null) return false
  const waktu = new Date(iso)
  if (Number.isNaN(waktu.getTime())) return false

  const geserKeSenin = (acuan.getDay() + 6) % 7
  const senin = new Date(acuan.getFullYear(), acuan.getMonth(), acuan.getDate() - geserKeSenin)
  const seninDepan = new Date(senin.getFullYear(), senin.getMonth(), senin.getDate() + 7)

  return waktu.getTime() >= senin.getTime() && waktu.getTime() < seninDepan.getTime()
}

/**
 * Urutan tampil: yang sedang berjalan paling atas, lalu menurut waktu mulai,
 * dan yang belum punya jadwal (draf) paling bawah. Tipe masukan dipertahankan
 * supaya pemanggil tetap memegang tipe kuis lengkapnya.
 * @template {{ sedang_berjalan: boolean, mulai_at: string|null }} T
 * @param {T[]} daftar
 * @returns {T[]}
 */
export function urutTampil(daftar) {
  return [...daftar].sort((a, b) => {
    if (a.sedang_berjalan !== b.sedang_berjalan) return a.sedang_berjalan ? -1 : 1
    if (a.mulai_at === null) return b.mulai_at === null ? 0 : 1
    if (b.mulai_at === null) return -1
    return new Date(a.mulai_at).getTime() - new Date(b.mulai_at).getTime()
  })
}

/**
 * Jadwal untuk tab "Hari ini" dan "Minggu ini". Draf selalu ikut karena guru
 * perlu melanjutkannya, dan kuis hari ini juga muncul di minggu ini.
 * @template {{ status: string, sedang_berjalan: boolean, mulai_at: string|null }} T
 * @param {T[]} kuis
 * @param {Date} [acuan]
 * @returns {{ hari: T[], minggu: T[] }}
 */
export function bagiJadwal(kuis, acuan = new Date()) {
  // Hanya draf yang perlu dilanjutkan; kuis yang sudah diarsipkan tidak lagi
  // masuk jadwal (guru bisa membukanya dari halaman Kuis).
  const draf = kuis.filter((satu) => satu.status === 'draf')
  const hari = kuis.filter(
    (satu) => satu.status === 'publikasi' && (satu.sedang_berjalan || diHariIni(satu.mulai_at, acuan)),
  )
  const minggu = kuis.filter((satu) => satu.status === 'publikasi' && diMingguIni(satu.mulai_at, acuan))

  return {
    hari: urutTampil([...hari, ...draf]),
    minggu: urutTampil([...minggu, ...draf]),
  }
}

/**
 * Empat angka ringkas di beranda guru.
 * @param {{
 *   kuis: KuisRingkas[],
 *   jumlahMurid: number,
 *   jumlahKelas: number,
 *   menungguKoreksi: number,
 * }} data
 * @param {Date} [acuan]
 * @returns {Array<{ label: string, nilai: string, ket: string }>}
 */
export function angkaBeranda({ kuis, jumlahMurid, jumlahKelas, menungguKoreksi }, acuan = new Date()) {
  const aktif = kuis.filter(
    (satu) => satu.status === 'publikasi' && (satu.sedang_berjalan || diHariIni(satu.mulai_at, acuan)),
  ).length

  return [
    { label: 'Kuis hari ini', nilai: String(aktif), ket: 'Berlangsung & terjadwal' },
    { label: 'Menunggu koreksi', nilai: String(menungguKoreksi), ket: 'Jawaban uraian' },
    { label: 'Murid', nilai: String(jumlahMurid), ket: `Di ${jumlahKelas} kelas` },
    { label: 'Kuis tersimpan', nilai: String(kuis.length), ket: 'Termasuk draf & arsip' },
  ]
}

/**
 * Daftar "Perlu perhatian" — hanya dari keadaan yang benar-benar ada, bukan
 * contoh. Urutannya: yang sedang berlangsung, koreksi, lalu laporan avatar.
 * @param {{
 *   kuisBerjalan: KuisRingkas | null,
 *   koreksi: { judul: string, jumlah: number } | null,
 *   laporanAvatar: number,
 * }} data
 * @returns {ItemPerhatian[]}
 */
export function perluPerhatian({ kuisBerjalan, koreksi, laporanAvatar }) {
  /** @type {ItemPerhatian[]} */
  const daftar = []

  if (kuisBerjalan !== null) {
    daftar.push({
      jenis: 'monitor',
      judul: `${kuisBerjalan.judul} sedang berlangsung`,
      ket: `Kelas ${kuisBerjalan.kelas_nama ?? '—'} · ${kuisBerjalan.jumlah_soal ?? 0} soal`,
      aksi: 'Buka monitor',
    })
  }

  if (koreksi !== null && koreksi.jumlah > 0) {
    daftar.push({
      jenis: 'koreksi',
      judul: `${koreksi.jumlah} jawaban menunggu koreksi`,
      ket: `Dari ${koreksi.judul}`,
      aksi: 'Mulai koreksi',
    })
  }

  if (laporanAvatar > 0) {
    daftar.push({
      jenis: 'avatar',
      judul: `${laporanAvatar} laporan avatar belum ditinjau`,
      ket: 'Dilaporkan oleh teman sekelas.',
      aksi: 'Tinjau',
    })
  }

  return daftar
}
