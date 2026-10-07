/**
 * Fungsi tampilan murni untuk laporan slice 05 — dipisah dari komponen supaya
 * bisa diuji tanpa DOM (Vitest environment node).
 */

/** Tingkat pemahaman yang dikenali server. */
export const TINGKAT = {
  paham: 'paham',
  mulaiPaham: 'mulai_paham',
  belumPaham: 'belum_paham',
  dataMinimum: 'data_belum_cukup',
}

/**
 * Label + kelas lencana status untuk satu tingkat pemahaman.
 * @param {string} tingkat
 * @returns {{ label: string, kelas: string }}
 */
export function tingkatTampilan(tingkat) {
  switch (tingkat) {
    case TINGKAT.paham:
      return { label: 'Paham', kelas: 'badge-status sukses' }
    case TINGKAT.mulaiPaham:
      return { label: 'Mulai paham', kelas: 'badge-status peringatan' }
    case TINGKAT.belumPaham:
      return { label: 'Belum paham', kelas: 'badge-status salah' }
    default:
      return { label: 'Data belum cukup', kelas: 'badge-status lembut' }
  }
}

/**
 * Kelas CSS lencana badge per mapel (emas / perak / perunggu / bawaan).
 * @param {{ kode: string } | undefined} lencana
 * @returns {string}
 */
export function kelasLencana(lencana) {
  switch (lencana?.kode) {
    case 'emas':
      return 'lencana lencana-emas'
    case 'perak':
      return 'lencana lencana-perak'
    case 'perunggu':
      return 'lencana lencana-perunggu'
    default:
      return 'lencana lencana-pendukung'
  }
}

/**
 * Hitung jumlah tema per tingkat (untuk ringkasan di kepala halaman).
 * @param {Array<{ tingkat: string }>} tema
 * @returns {Record<string, number>}
 */
export function ringkasTingkat(tema) {
  const ringkasan = {
    [TINGKAT.paham]: 0,
    [TINGKAT.mulaiPaham]: 0,
    [TINGKAT.belumPaham]: 0,
    [TINGKAT.dataMinimum]: 0,
  }

  for (const satu of tema ?? []) {
    if (ringkasan[satu.tingkat] === undefined) ringkasan[satu.tingkat] = 0
    ringkasan[satu.tingkat] += 1
  }

  return ringkasan
}

/**
 * Urutkan peringkat mengikuti aturan server (dipakai saat menyusun ulang dari
 * data yang sudah ada): skor menurun, waktu selesai lebih cepat, lalu nama.
 * @template {{ skor: number, dikumpulkan_at: string|null, nama: string }} T
 * @param {T[]} daftar
 * @returns {T[]}
 */
export function urutkanPeringkat(daftar) {
  const waktu = (/** @type {{ dikumpulkan_at: string|null }} */ baris) =>
    baris.dikumpulkan_at === null ? Number.POSITIVE_INFINITY : Date.parse(baris.dikumpulkan_at)

  return [...(daftar ?? [])].sort((a, b) => {
    if (b.skor !== a.skor) return b.skor - a.skor
    if (waktu(a) !== waktu(b)) return waktu(a) - waktu(b)

    return a.nama.localeCompare(b.nama, 'id')
  })
}

/**
 * Peringkat pertama milik seorang murid (atau null).
 * @param {Array<{ murid_id: number|null }>} daftar
 * @param {number} muridId
 * @returns {{ murid_id: number|null }|null}
 */
export function milikMurid(daftar, muridId) {
  return (daftar ?? []).find((baris) => baris.murid_id === muridId) ?? null
}

/**
 * Apakah satu baris peringkat milik pemohon?
 *
 * Pada mode tim yang dibandingkan adalah tim, bukan murid — jadi murid yang
 * bergantian memakai satu akun tetap melihat barisnya tersorot (slice 09-C).
 *
 * @param {import('./api.js').DataBarisPeringkat} baris
 * @param {import('./api.js').DataBarisPeringkat|null|undefined} saya
 * @param {boolean} modeTim
 * @returns {boolean}
 */
export function barisMilikSaya(baris, saya, modeTim) {
  if (saya === null || saya === undefined) return false

  if (modeTim) {
    return baris.tim_id !== null && saya.tim_id !== null && baris.tim_id === saya.tim_id
  }

  return baris.murid_id !== null && baris.murid_id === saya.murid_id
}
