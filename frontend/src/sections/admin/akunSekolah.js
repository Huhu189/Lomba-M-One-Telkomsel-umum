/**
 * Aturan murni panel kelola akun sekolah (14 Okt 2026).
 *
 * Dipisah dari komponennya supaya aturan yang menentukan "boleh simpan atau
 * belum" bisa diuji tanpa DOM — dan supaya tombol simpan tidak pernah aktif
 * untuk muatan yang pasti ditolak server (alasan terlalu pendek, sandi kurang
 * dari 10 karakter, konfirmasi tidak cocok, atau token belum diminta).
 *
 * @typedef {'email'|'sandi'|'status'} JenisAksiAkun
 */

/** Alasan minimal (karakter) — sama dengan AkunSekolahService::ALASAN_MIN. */
export const ALASAN_MIN = 10

/** Panjang minimal sandi baru — sama dengan aturan sandi aplikasi. */
export const SANDI_MIN = 10

/**
 * Judul panel untuk tiap aksi.
 * @param {JenisAksiAkun} jenis
 * @returns {string}
 */
export function judulAksi(jenis) {
  switch (jenis) {
    case 'email':
      return 'Ubah email akun'
    case 'sandi':
      return 'Setel ulang kata sandi'
    case 'status':
      return 'Ubah status akun'
  }
}

/**
 * Kalimat penjelas untuk tiap aksi — admin harus tahu akibatnya sebelum menekan
 * simpan, terutama untuk penangguhan yang mengakhiri sesi seketika.
 * @param {JenisAksiAkun} jenis
 * @returns {string}
 */
export function catatanAksi(jenis) {
  switch (jenis) {
    case 'email':
      return 'Email baru langsung dianggap terverifikasi karena admin sekolah yang menetapkannya. Pemilik akun memakai email ini untuk masuk dan memulihkan akun.'
    case 'sandi':
      return 'Seluruh sesi akun ini diakhiri dan sandi lama tidak berlaku lagi. Sampaikan sandi baru langsung ke pemiliknya — sandi tidak pernah ditampilkan lagi setelah disimpan.'
    case 'status':
      return 'Akun yang ditangguhkan langsung ditolak di semua jalur masuk dan sesinya diakhiri saat itu juga.'
  }
}

/**
 * Apakah teks ini berbentuk email yang masuk akal?
 *
 * Pemeriksaan penuh tetap di server (`email:rfc`); ini hanya pagar agar tombol
 * simpan tidak mengirim muatan yang jelas salah dan admin tidak menunggu
 * perjalanan bolak-balik untuk tahu ada salah ketik.
 *
 * @param {string} email
 * @returns {boolean}
 */
export function emailWajar(email) {
  const bersih = email.trim()
  if (bersih === '' || bersih.includes(' ')) return false

  const bagian = bersih.split('@')
  if (bagian.length !== 2) return false

  const [nama, domain] = bagian
  return nama !== '' && domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.')
}

/**
 * @param {string} sandi
 * @returns {boolean}
 */
export function sandiCukup(sandi) {
  return sandi.length >= SANDI_MIN
}

/**
 * @param {string} alasan
 * @returns {boolean}
 */
export function alasanCukup(alasan) {
  return alasan.trim().length >= ALASAN_MIN
}

/**
 * Apakah isian formulir sudah boleh dipakai untuk **minta token**?
 *
 * Dipisah dari `bolehSimpanAkun` karena meminta token memakai alasan yang sama
 * (token terikat alasan & sasaran) tetapi belum butuh token itu sendiri.
 *
 * @param {{
 *   jenis: JenisAksiAkun,
 *   alasan: string,
 *   email?: string,
 *   sandi?: string,
 *   konfirmasi?: string,
 *   status?: string,
 * }} isian
 * @returns {boolean}
 */
export function bolehMintaToken({ jenis, alasan, email = '', sandi = '', konfirmasi = '', status = '' }) {
  if (!alasanCukup(alasan)) return false

  switch (jenis) {
    case 'email':
      return emailWajar(email)
    case 'sandi':
      return sandiCukup(sandi) && sandi === konfirmasi
    case 'status':
      return status === 'aktif' || status === 'suspended'
  }
}

/**
 * Apakah perubahan boleh dikirim? Butuh dua syarat: isian sah DAN token
 * konfirmasi sudah diminta (server akan menolak tanpa token).
 *
 * @param {{
 *   jenis: JenisAksiAkun,
 *   alasan: string,
 *   email?: string,
 *   sandi?: string,
 *   konfirmasi?: string,
 *   status?: string,
 *   token: string,
 * }} isian
 * @returns {boolean}
 */
export function bolehSimpanAkun(isian) {
  if (isian.token.trim() === '') return false
  return bolehMintaToken(isian)
}

/**
 * Status tujuan tiap tombol aksi di baris akun, supaya tombol yang sama bisa
 * berarti "tangguhkan" atau "aktifkan" tanpa halaman menyimpan daftar terpisah.
 * @param {string} status
 * @returns {{ status: 'aktif'|'suspended', label: string }}
 */
export function aksiStatusBerikut(status) {
  return status === 'suspended'
    ? { status: 'aktif', label: 'Aktifkan kembali' }
    : { status: 'suspended', label: 'Tangguhkan akun' }
}
