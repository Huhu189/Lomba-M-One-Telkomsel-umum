/**
 * Ringkasan setelan sesi untuk **langkah 3 editor kuis** (tinjau sebelum
 * publikasi) + tautan yang dibagikan ke siswa.
 *
 * Kenapa berkas terpisah: guru perlu melihat — sebelum menekan publikasi —
 * *apa yang benar-benar menyala di sesi ini*, karena keputusannya tersebar di
 * pengaturan tiga lapis (kuis → kelas → sekolah). Server sudah menghitung
 * resolusi itu di `GET /v1/pengaturan?kelas_id=&kuis_id=`, lengkap dengan
 * `sumber` tiap nilai; berkas ini hanya meringkasnya jadi bentuk yang bisa
 * dibaca sekilas. Isinya murni (tanpa DOM, tanpa React) supaya bisa diuji
 * Vitest, sedangkan yang merender dan menyalin tautan ada di `HalamanKuis.jsx`.
 *
 * Yang diringkas hanya **boolean**: ambang bilangan bulat (ambang paham, data
 * minimum per tema, batas percobaan) bukan saklar, jadi ditampilkan apa adanya
 * di tempat lain — bukan di ringkasan saklar ini.
 */

/** Kelompok pengaturan yang dianggap "proteksi" (dari `KunciPengaturan::kelompok()`). */
export const KELOMPOK_PROTEKSI = 'Anti-cheat'

/** Saklar induk anti-cheat — bukan proteksi, melainkan pintunya. */
export const KUNCI_INDUK = 'anti_cheat'

/** Saklar izin siswa tamu (mode tamu tanpa akun). */
export const KUNCI_TAMU = 'izinkan_tamu'

/**
 * Saklar boolean non-proteksi yang ikut menentukan suasana sesi, urut sesuai
 * kepentingannya bagi guru saat menekan publikasi.
 */
export const SAKLAR_SESI = [
  ['retry', 'Ulangan ulang (retry)'],
  ['ranking', 'Peringkat tampil'],
  ['mode_tim', 'Mode tim'],
  ['layar_guru', 'Layar guru'],
  ['rekam_diri', 'Rekam diri jawaban'],
]

/** Label sumber nilai, dipakai apa adanya di ringkasan. */
export const LABEL_SUMBER = /** @type {Record<string, string>} */ ({
  bawaan: 'bawaan aplikasi',
  sekolah: 'sekolah',
  kelas: 'kelas',
  kuis: 'kuis ini',
})

/**
 * Satu nilai pengaturan dari resolusi server, atau `null` bila tidak ada / tidak
 * dikenali. Payload datang dari luar, jadi bentuknya tidak dipercaya.
 *
 * @param {unknown} resolusi
 * @param {string} kunci
 * @returns {{ nilai: boolean|number, label: string, sumber: string, kelompok: string }|null}
 */
export function bacaNilai(resolusi, kunci) {
  const pengaturan =
    resolusi !== null && typeof resolusi === 'object'
      ? /** @type {{ pengaturan?: unknown }} */ (resolusi).pengaturan
      : null

  if (pengaturan === null || typeof pengaturan !== 'object') return null

  const satu = /** @type {Record<string, unknown>} */ (pengaturan)[kunci]

  if (satu === null || typeof satu !== 'object') return null

  const nilai = /** @type {{ nilai?: unknown }} */ (satu).nilai
  if (typeof nilai !== 'boolean' && typeof nilai !== 'number') return null

  const label = /** @type {{ label?: unknown }} */ (satu).label
  const sumber = /** @type {{ sumber?: unknown }} */ (satu).sumber
  const kelompok = /** @type {{ kelompok?: unknown }} */ (satu).kelompok

  return {
    nilai,
    label: typeof label === 'string' && label !== '' ? label : kunci,
    sumber: typeof sumber === 'string' && sumber !== '' ? sumber : 'bawaan',
    kelompok: typeof kelompok === 'string' ? kelompok : '',
  }
}

/**
 * Ringkasan setelan sesi dari resolusi pengaturan server.
 *
 * Aturan yang dijaga: **bila saklar induk mati, tidak ada proteksi yang
 * dipasang** walau saklar rincinya menyala (persis seperti `proteksiEfektif`
 * di sisi murid). Ringkasan yang menampilkan "blokir tempel aktif" padahal
 * induknya mati akan membuat guru salah menyimpulkan ulangannya diawasi.
 *
 * @param {unknown} resolusi
 * @returns {{
 *   indukAktif: boolean,
 *   indukSumber: string,
 *   proteksi: Array<{ kunci: string, label: string, sumber: string }>,
 *   proteksiMati: number,
 *   tamu: { aktif: boolean, sumber: string },
 *   aturan: Array<{ kunci: string, label: string, aktif: boolean, sumber: string }>,
 * }}
 */
export function ringkasSetelan(resolusi) {
  const induk = bacaNilai(resolusi, KUNCI_INDUK)
  const indukAktif = induk?.nilai === true

  const pengaturan =
    resolusi !== null && typeof resolusi === 'object'
      ? /** @type {{ pengaturan?: unknown }} */ (resolusi).pengaturan
      : null

  const kunciSemua =
    pengaturan !== null && typeof pengaturan === 'object' ? Object.keys(pengaturan) : []

  /** @type {Array<{ kunci: string, label: string, sumber: string }>} */
  const proteksi = []
  let proteksiMati = 0

  for (const kunci of kunciSemua) {
    if (kunci === KUNCI_INDUK) continue

    const satu = bacaNilai(resolusi, kunci)

    if (satu === null || satu.kelompok !== KELOMPOK_PROTEKSI) continue

    if (satu.nilai === true && indukAktif) {
      proteksi.push({ kunci, label: satu.label, sumber: satu.sumber })
    } else {
      proteksiMati += 1
    }
  }

  const tamu = bacaNilai(resolusi, KUNCI_TAMU)

  const aturan = SAKLAR_SESI.map(([kunci, label]) => {
    const satu = bacaNilai(resolusi, kunci)

    return {
      kunci,
      label,
      aktif: satu?.nilai === true,
      sumber: satu?.sumber ?? 'bawaan',
    }
  })

  return {
    indukAktif,
    indukSumber: induk?.sumber ?? 'bawaan',
    proteksi,
    proteksiMati,
    tamu: { aktif: tamu?.nilai === true, sumber: tamu?.sumber ?? 'bawaan' },
    aturan,
  }
}

/**
 * Tautan yang dibagikan guru ke siswa: halaman detail kuis **di dalam
 * aplikasi**, bukan tautan bertoken.
 *
 * Alamatnya memakai **slug** kuis (mis. `/kuis/unu5k`), bukan id berurutan:
 * tautan yang dibagikan ke grup kelas tidak boleh jadi pintu menebak kuis lain.
 * Angka tetap diterima supaya tautan lama yang sudah tersebar tidak mati.
 *
 * Satu tautan ini bekerja untuk dua jenis pengunjung, dan itu disengaja:
 *
 * 1. **murid yang sudah punya akun** — membuka detail kuis, lalu menekan
 *    "Kerjakan sekarang" saat jadwalnya berjalan;
 * 2. **siswa tamu tanpa akun** — server sudah membuka pintunya lewat
 *    `izinkan_tamu` pada kuis ini (`KuisPolicy::view` memakai izin itu untuk
 *    akun tamu), dan halaman masuk menampilkan formulir tamu begitu ada kuis
 *    terbit yang membukanya.
 *
 * Pengunjung tanpa sesi diarahkan ke halaman masuk dengan penanda `lanjut`,
 * sehingga setelah masuk (lewat akun **atau** lewat pintu tamu) ia kembali ke
 * kuis ini — itulah yang membuat tautannya "kompatibel" dengan mode tamu.
 *
 * @param {unknown} kunci slug kuis (angka lama masih diterima); nilai lain ditolak
 * @param {string} asal contoh: `window.location.origin`
 * @returns {string} string kosong bila kunci tidak masuk akal (pemanggil tidak menampilkan apa pun)
 */
export function tautanSiswa(kunci, asal) {
  const bersih = String(kunci ?? '').trim()

  // Hanya dua bentuk yang diterima: slug baru (harus punya huruf, minimal 4
  // karakter) atau id angka lama. Nilai lain — termasuk "0", "-3", spasi, dan
  // yang berisi garis miring — ditolak sebelum sempat disambung ke alamat,
  // supaya tautan yang dibagikan guru tidak bisa menunjuk jalur lain.
  const angkaLama = /^[1-9][0-9]{0,9}$/.test(bersih)
  const slugBaru = /^[A-Za-z0-9_-]{4,32}$/.test(bersih) && /[A-Za-z]/.test(bersih)

  if (!angkaLama && !slugBaru) return ''
  if (typeof asal !== 'string' || asal.trim() === '') return ''

  return `${asal.trim().replace(/\/+$/, '')}/kuis/${encodeURIComponent(bersih)}`
}

/**
 * Tujuan setelah masuk, dari penanda `lanjut` yang dipasang router.
 *
 * Hanya jalur **internal** yang diterima (diawali `/`, bukan `//` atau `/\`
 * yang dibaca peramban sebagai host lain). Ini pagar redirect terbuka: nilai
 * `lanjut` datang dari alamat yang bisa disunting siapa pun, jadi menerimanya
 * apa adanya berarti aplikasi bisa dipakai mengantar orang ke situs lain.
 *
 * @param {unknown} nilai
 * @returns {string|null}
 */
export function tujuanLanjut(nilai) {
  if (typeof nilai !== 'string') return null
  if (nilai === '' || nilai.length > 300) return null
  if (!nilai.startsWith('/')) return null
  if (nilai.startsWith('//') || nilai.startsWith('/\\')) return null
  if (nilai.includes('\\') || nilai.includes('\n') || nilai.includes('\r')) return null

  return nilai
}

/**
 * Catatan yang wajib terbaca guru di samping tautan — supaya tidak ada
 * "tautan yang tidak jalan" tanpa penjelasan.
 *
 * @param {{ status?: string, tamuAktif?: boolean }} opsi
 * @returns {string[]}
 */
export function catatanTautan({ status = 'draf', tamuAktif = false } = {}) {
  const catatan = []

  if (status !== 'publikasi') {
    catatan.push('Kuis ini masih draf: tautannya baru hidup setelah kamu menekan “Publikasikan kuis”.')
  }

  if (tamuAktif) {
    catatan.push(
      status === 'publikasi'
        ? 'Siswa tamu boleh ikut lewat tautan yang sama — tanpa akun, cukup menulis nama.'
        : 'Izin siswa tamu sudah menyala, tetapi pintu tamu baru terbuka setelah kuis diterbitkan.',
    )
  }

  return catatan
}
