/**
 * Helper murni pemutar materi murid: kuis yang disisipkan di dalam video.
 * Server tetap penentu boleh-tidaknya (urutan, penutupan video); modul ini
 * hanya memutuskan KAPAN kuis muncul saat video berjalan.
 */

/** @typedef {import('./api.js').DataRingkasanMateri['blok'][number]} BlokProgres */

/** Toleransi (detik) karena `timeupdate` datang kira-kira 4x per detik. */
const TOLERANSI = 0.05

/**
 * Kuis yang tayang di dalam video `hostId`, urut titik mulai.
 * @param {import('./api.js').DataRingkasanMateri|null|undefined} ringkasan
 * @param {number} hostId
 * @returns {BlokProgres[]}
 */
export function sisipanUntuk(ringkasan, hostId) {
  return (ringkasan?.blok ?? [])
    .filter((satu) => satu.host_id === hostId)
    .sort((a, b) => (a.mulai_detik ?? 0) - (b.mulai_detik ?? 0) || a.urutan - b.urutan)
}

/**
 * Kuis berikutnya yang harus muncul pada posisi video `detik`: yang titik
 * mulainya sudah terlewati, belum selesai, dan belum ditutup/dilewati.
 * Bila murid melompat jauh, yang paling awal yang muncul lebih dulu.
 *
 * @param {BlokProgres[]} sisipan
 * @param {number} detik gunakan Infinity saat video selesai
 * @param {Set<number>} tertutup block_id yang sudah dijawab/dilewati di sesi ini
 * @returns {BlokProgres|null}
 */
export function kuisJatuhTempo(sisipan, detik, tertutup) {
  return (
    sisipan.find(
      (satu) =>
        satu.status !== 'selesai' &&
        !tertutup.has(satu.block_id) &&
        (satu.mulai_detik ?? 0) <= detik + TOLERANSI,
    ) ?? null
  )
}

/**
 * Berapa kuis wajib di dalam video yang belum selesai.
 * @param {BlokProgres[]} sisipan
 * @param {Set<number>} [tertutup]
 * @returns {number}
 */
export function sisaWajib(sisipan, tertutup = new Set()) {
  return sisipan.filter(
    (satu) => satu.wajib && satu.status !== 'selesai' && !tertutup.has(satu.block_id),
  ).length
}
