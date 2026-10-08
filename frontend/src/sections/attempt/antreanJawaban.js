/**
 * Antrean jawaban yang menunggu dikirim ke server.
 *
 * Alasan modul ini terpisah (temuan Q-02): pengiriman antrean berjalan
 * asinkron, sementara murid terus mengetik. Tanpa penanda urutan, jawaban lama
 * yang gagal terkirim dikembalikan ke antrean dan menimpa jawaban yang lebih
 * baru — nilai murid turun karena jawaban lama yang dinilai, tanpa pesan apa pun.
 *
 * Aturan: setiap perubahan jawaban satu soal menaikkan nomor urut global.
 * Entri hanya dikembalikan ke antrean bila murid belum mengubah soal itu lagi
 * selama pengiriman berjalan.
 *
 * @typedef {{ nilai: unknown, seq: number }} EntriAntrean
 * @typedef {{ entri: Map<string, EntriAntrean>, urut: number }} AntreanJawaban
 */

/** Antrean kosong untuk satu attempt. @returns {AntreanJawaban} */
export function buatAntrean() {
  return { entri: new Map(), urut: 0 }
}

/**
 * Catat jawaban murid untuk satu soal. Nomor urut selalu naik, jadi entri
 * dengan `seq` lebih besar selalu lebih baru.
 *
 * @param {AntreanJawaban} antrean
 * @param {number} soalId
 * @param {unknown} nilai
 * @returns {number} nomor urut entri ini
 */
export function catat(antrean, soalId, nilai) {
  antrean.urut += 1
  antrean.entri.set(String(soalId), { nilai, seq: antrean.urut })

  return antrean.urut
}

/**
 * Ambil salinan seluruh antrean lalu kosongkan — dipanggil sekali di awal
 * pengiriman, supaya perubahan yang datang setelahnya tidak ikut terhapus.
 *
 * @param {AntreanJawaban} antrean
 * @returns {Array<{ kunci: string, nilai: unknown, seq: number }>}
 */
export function ambilUntukKirim(antrean) {
  const daftar = [...antrean.entri.entries()]
  antrean.entri.clear()

  return daftar.map(([kunci, isi]) => ({ kunci, ...isi }))
}

/**
 * Kembalikan entri yang gagal terkirim ke antrean.
 *
 * @param {AntreanJawaban} antrean
 * @param {string} kunci
 * @param {EntriAntrean} entri entri yang gagal terkirim
 * @returns {boolean} `false` bila entri itu sudah kedaluwarsa (ada yang lebih baru)
 */
export function kembalikan(antrean, kunci, entri) {
  const terbaru = antrean.entri.get(kunci)

  if (terbaru !== undefined && terbaru.seq > entri.seq) {
    return false
  }

  // Hanya `nilai` + `seq` yang disimpan, supaya entri dari `ambilUntukKirim`
  // (yang membawa `kunci`) tidak menumpuk kolom tambahan di antrean.
  antrean.entri.set(kunci, { nilai: entri.nilai, seq: entri.seq })

  return true
}

/**
 * Masih ada jawaban yang menunggu dikirim?
 *
 * @param {AntreanJawaban} antrean
 * @returns {boolean}
 */
export function adaSisa(antrean) {
  return antrean.entri.size > 0
}

/**
 * Satu pengirim tunggal untuk seluruh antrean.
 *
 * Autosave dan "Kumpulkan" memakai instance ini bersama-sama: setiap pekerjaan
 * berbaris di belakang pekerjaan sebelumnya, sehingga pengiriman tidak pernah
 * berjalan bersamaan. Tanpa ini, `kumpulkan` bisa menyelesaikan pengumpulan
 * sementara autosave masih memegang jawaban terakhir di luar antrean.
 *
 * @returns {(kerja: () => Promise<number>) => Promise<number>}
 */
export function buatPengirim() {
  /** @type {Promise<unknown>} */
  let rantai = Promise.resolve()

  return (kerja) => {
    // Dua penangan: pekerjaan tetap dijalankan (bukan dilewati) meski pekerjaan
    // sebelumnya melempar, dan rantai tidak pernah putus karena galat.
    const jalur = rantai.then(() => kerja(), () => kerja())
    rantai = jalur.then(
      () => undefined,
      () => undefined,
    )

    return jalur
  }
}
