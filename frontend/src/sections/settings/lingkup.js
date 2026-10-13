/**
 * Pilihan lingkup pengaturan, sebagai logika murni (diuji Vitest).
 *
 * Halaman pengaturan diskalakan **per ulangan** (satu kuis), bukan per akun.
 * Alasannya praktis: yang diatur guru saat menyiapkan ulangan adalah aturan
 * ulangan itu sendiri — proteksi, waktu, percobaan ulang, aturan penilaian —
 * dan nilainya memang tersimpan di lapis kuis.
 *
 * Aturan sekolah/kelas tetap berlaku sebagai lapis di atasnya dan tetap bisa
 * **mengunci** sebuah pengaturan (server yang memutuskan); halaman ini hanya
 * menampilkan akibatnya ("dikunci sekolah"), tidak lagi menjadi tempat
 * menyetelnya. Keputusan siapa yang boleh menyentuh lapis mana tetap di server
 * (K-05).
 */

/**
 * @typedef {'kuis'} JenisLingkup
 * @typedef {{ nilai: string, label: string }} PilihanLingkup
 * @typedef {{ lingkup: JenisLingkup, lingkupId: number, kuisId: number }} LingkupTerpilih
 */

/** @param {number} id */
export function nilaiLingkupKuis(id) {
  return `kuis:${id}`
}

/**
 * Terjemahkan nilai `<select>` menjadi parameter API.
 *
 * Nilai yang tidak dikenali (atau id bukan bilangan positif) menghasilkan `null`
 * — pemanggil menampilkannya sebagai "belum memilih lingkup", bukan menebak.
 *
 * @param {string} nilai
 * @returns {LingkupTerpilih|null}
 */
export function bacaLingkup(nilai) {
  const [jenis, angka] = String(nilai).split(':')
  const id = Number(angka)

  if (jenis !== 'kuis' || !Number.isInteger(id) || id <= 0) return null

  return { lingkup: 'kuis', lingkupId: id, kuisId: id }
}

/**
 * Daftar pilihan lingkup: satu baris per ulangan milik guru (daftar kuis guru
 * memang sudah disaring server).
 *
 * @param {{ daftarKuis?: Array<{ id: number, judul: string }> }} opsi
 * @returns {PilihanLingkup[]}
 */
export function pilihanLingkup({ daftarKuis = [] }) {
  return daftarKuis.map((kuis) => ({
    nilai: nilaiLingkupKuis(Number(kuis.id)),
    label: `Ulangan: ${kuis.judul}`,
  }))
}

/**
 * Lingkup awal yang dipilih: ulangan pertama (kosong bila belum punya kuis —
 * halaman akan menampilkan petunjuk).
 *
 * @param {PilihanLingkup[]} pilihan
 */
export function lingkupAwal(pilihan) {
  return pilihan[0]?.nilai ?? ''
}
