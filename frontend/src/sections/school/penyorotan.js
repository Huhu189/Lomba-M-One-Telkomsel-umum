/**
 * Penyorotan kata kunci hasil pencarian murid (A.51).
 *
 * Kotak cari menyaring di SERVER; begitu daftar kembali, guru masih perlu tahu
 * **kenapa** sebuah baris ikut tampil. Menyorot bagian yang cocok menutup
 * celah itu: kata kunci disorot di nama/NIS/email, bukan hanya barisnya
 * ditampilkan begitu saja.
 *
 * Fungsi ini murni (tanpa DOM) supaya bisa diuji langsung: ia mengembalikan
 * potongan-potongan teks beserta penanda cocok/tidak, dan komponen yang
 * merender tinggal memilih elemen `<mark>` — tanpa `dangerouslySetInnerHTML`.
 */

/** Karakter yang perlu di-escape sebelum dipakai di dalam RegExp. */
const KARAKTER_REGEX = /[.*+?^${}()|[\]\\]/g

/**
 * Amankan kata kunci supaya metakarakter regex diperlakukan sebagai huruf biasa.
 *
 * @param {string} teks
 * @returns {string}
 */
function amanRegex(teks) {
  return teks.replace(KARAKTER_REGEX, '\\$&')
}

/**
 * Potong teks menjadi bagian yang cocok dan tidak cocok dengan kata kunci.
 *
 * Kata kunci kosong (atau hanya spasi) berarti tidak ada sorotan — seluruh teks
 * dikembalikan apa adanya. Pencocokan tidak peduli huruf besar/kecil dan
 * memperlakukan metakarakter (mis. `%` yang diketik guru) sebagai huruf biasa.
 *
 * @param {string} teks
 * @param {string} kata
 * @returns {Array<{ teks: string, cocok: boolean }>}
 */
export function potongUntukSorot(teks, kata) {
  const kunci = (kata ?? '').trim()

  if (kunci === '' || teks === '') {
    return [{ teks, cocok: false }]
  }

  const rendah = kunci.toLowerCase()

  return teks
    .split(new RegExp(`(${amanRegex(kunci)})`, 'gi'))
    .filter((satu) => satu !== '')
    .map((satu) => ({ teks: satu, cocok: satu.toLowerCase() === rendah }))
}
