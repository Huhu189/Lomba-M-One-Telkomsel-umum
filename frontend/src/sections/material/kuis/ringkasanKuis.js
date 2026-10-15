/**
 * Helper murni layar sesudah kuis sisipan: saklar dari guru, bintang, urutan
 * kartu ingat, dan rekap kartu. Tidak menyentuh jaringan atau DOM supaya mudah
 * diuji; kunci jawaban sendiri hanya datang dari server (ringkasan-kuis).
 */

/**
 * Saklar layar sesudah kuis, dibaca dari `tampilan` blok kuis. Server menyimpan
 * 0/1; `true` juga diterima. Bawaan semuanya mati.
 *
 * @param {Record<string, string|number|boolean>|null|undefined} tampilan
 * @returns {{ ringkasan: boolean, kartu: boolean, papan: boolean }}
 */
export function saklarSesudahKuis(tampilan) {
  const nyala = (/** @type {unknown} */ nilai) => nilai === 1 || nilai === true || nilai === '1'

  return {
    ringkasan: nyala(tampilan?.ringkasan),
    kartu: nyala(tampilan?.kartu),
    papan: nyala(tampilan?.papan),
  }
}

/** Apakah ada satu pun layar tambahan yang dibuka guru. */
export function adaLayarTambahan(/** @type {ReturnType<typeof saklarSesudahKuis>} */ saklar) {
  return saklar.ringkasan || saklar.kartu || saklar.papan
}

/**
 * Persentase skor (0–100, dibulatkan). Skor maksimal 0/kosong dibaca 0 supaya
 * tidak pernah menghasilkan NaN di layar.
 *
 * @param {number|null|undefined} skor
 * @param {number|null|undefined} maksimal
 */
export function persenSkor(skor, maksimal) {
  if (!maksimal || maksimal <= 0 || skor === null || skor === undefined) return 0

  return Math.max(0, Math.min(100, Math.round((skor / maksimal) * 100)))
}

/**
 * Jumlah bintang 0–3. Ambangnya sengaja ramah untuk anak SD: bintang pertama
 * untuk yang sudah mencoba dan benar sebagian, jadi tidak ada layar kosong.
 *
 * @param {number} persen
 * @returns {0|1|2|3}
 */
export function bintangDariPersen(persen) {
  if (persen >= 85) return 3
  if (persen >= 60) return 2
  if (persen > 0) return 1
  return 0
}

/**
 * Kalimat penyemangat sesuai capaian — tanpa membandingkan dengan murid lain.
 * @param {number} persen
 */
export function pesanCapaian(persen) {
  if (persen >= 85) return 'Hebat! Kamu sudah paham bagian ini.'
  if (persen >= 60) return 'Bagus! Sedikit lagi, lihat ringkasannya ya.'
  if (persen > 0) return 'Ayo coba lagi — ringkasan dan kartu bisa membantumu.'
  return 'Tidak apa-apa. Baca ringkasannya, lalu coba lagi pelan-pelan.'
}

/**
 * @typedef {{
 *   question_id: number,
 *   nomor: number,
 *   depan: string,
 *   belakang: string|null,
 *   catatan: string|null,
 *   benar: boolean|null,
 * }} KartuIngat
 */

/**
 * Urutan kartu: yang tadi salah/belum dijawab lebih dulu, lalu yang benar;
 * di tiap kelompok tetap mengikuti nomor soal. Tidak mengubah larik asal.
 *
 * @param {KartuIngat[]} kartu
 * @returns {KartuIngat[]}
 */
export function urutKartu(kartu) {
  const bobot = (/** @type {KartuIngat} */ satu) => (satu.benar === true ? 1 : 0)

  return [...kartu].sort((a, b) => bobot(a) - bobot(b) || a.nomor - b.nomor)
}

/**
 * Rekap penilaian diri murid pada deck kartu.
 *
 * @param {KartuIngat[]} kartu
 * @param {Record<number, 'ingat'|'belum'>} penilaian question_id → pilihan murid
 */
export function rekapKartu(kartu, penilaian) {
  let ingat = 0
  let belum = 0

  for (const satu of kartu) {
    const nilai = penilaian[satu.question_id]
    if (nilai === 'ingat') ingat += 1
    else if (nilai === 'belum') belum += 1
  }

  return { ingat, belum, tersisa: kartu.length - ingat - belum, selesai: ingat + belum === kartu.length && kartu.length > 0 }
}

/**
 * Kartu yang masih perlu diulang: yang dinilai "belum ingat".
 *
 * @param {KartuIngat[]} kartu
 * @param {Record<number, 'ingat'|'belum'>} penilaian
 * @returns {KartuIngat[]}
 */
export function kartuUlang(kartu, penilaian) {
  return kartu.filter((satu) => penilaian[satu.question_id] === 'belum')
}

/**
 * Label status satu soal pada ringkasan. Tidak hanya warna: selalu ada teks.
 *
 * @param {{ terjawab: boolean, benar: boolean|null }} soal
 * @returns {{ kunci: 'benar'|'salah'|'kosong'|'tinjau', label: string }}
 */
export function statusRingkasan(soal) {
  if (!soal.terjawab) return { kunci: 'kosong', label: 'Belum dijawab' }
  if (soal.benar === true) return { kunci: 'benar', label: 'Benar' }
  if (soal.benar === false) return { kunci: 'salah', label: 'Perlu diulang' }
  return { kunci: 'tinjau', label: 'Menunggu dinilai guru' }
}
