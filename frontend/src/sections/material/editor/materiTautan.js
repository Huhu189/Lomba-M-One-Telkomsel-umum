/**
 * Tautan materi: alamat yang dibagikan guru ke kelasnya (15 Oktober 2026).
 *
 * Kenapa dipisah jadi modul murni: alamatnya dan kalimat catatannya dipakai
 * tombol salin di editor **dan** diuji tanpa DOM (`materiTautan.test.js`).
 * Kalau catatannya ditulis ulang di JSX, kalimat yang diuji dan yang dibaca guru
 * bisa berbeda — persis kesalahan yang dihindari `setelanSesi.js` di bagian kuis.
 *
 * Alamatnya `/materi/<id>` — jalur yang sama dengan daftar materi, tetapi
 * memilih satu materi tertentu. Guru yang membuka tautan ini dibawa ke editornya
 * (lihat `PilihHalamanMateri`), sedangkan murid langsung menempuh materinya.
 */

/**
 * Tautan materi dari id-nya; `''` bila id tidak masuk akal (belum tersimpan).
 * @param {number} id
 * @param {string} [asal] asal aplikasi (mis. `window.location.origin`)
 * @returns {string}
 */
export function tautanMateri(id, asal) {
  if (!Number.isInteger(id) || id <= 0) return ''

  const dasar = String(asal ?? '').replace(/\/+$/, '')

  return `${dasar}/materi/${id}`
}

/**
 * Kalimat yang menjelaskan siapa yang bisa membuka tautan itu.
 * @param {{ status?: string, kelas?: string, kelasBebas?: boolean }} [keadaan]
 *   `kelasBebas` = materi tanpa kelas, jadi terbuka untuk seluruh sekolah
 *   (15 Oktober 2026) — bukan "kelasnya belum diketahui".
 * @returns {string[]}
 */
export function catatanMateri({ status = 'draf', kelas = '', kelasBebas = false } = {}) {
  const catatan = []

  if (status !== 'publikasi') {
    catatan.push(
      'Materi ini belum terbit — murid baru bisa membukanya setelah Bapak/Ibu menekan “Terbitkan”.',
    )
  }

  if (kelasBebas) {
    catatan.push(
      'Materi ini tidak dibatasi kelas, jadi semua murid di sekolah ini (dan guru) bisa membukanya setelah masuk dengan akunnya.',
    )
  } else {
    catatan.push(
      kelas === ''
        ? 'Tautan ini untuk murid yang sudah masuk dengan akunnya dan tergabung di kelas materi ini.'
        : `Yang bisa membukanya: murid kelas ${kelas} (dan guru di sekolah ini) setelah masuk dengan akunnya.`,
    )
  }

  catatan.push('Murid tidak perlu akun baru — tautannya dibuka di aplikasi yang sama, lalu materi ada di berandanya.')

  return catatan
}
