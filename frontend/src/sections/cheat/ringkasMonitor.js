/**
 * Perhitungan murni untuk Live Monitor (papan desain 7).
 *
 * Dihitung dari snapshot yang benar-benar dikirim server — bukan angka contoh.
 * "Belum mulai" tidak ada di sini karena monitor hanya memuat attempt yang
 * sudah dibuka; menampilkannya akan berarti angka karangan.
 */

/**
 * @typedef {{
 *   status: string,
 *   online: boolean,
 *   kecurangan?: { belum_ditinjau?: number },
 * }} BarisMonitor
 */

/**
 * Lima atau empat angka ringkas di atas tabel murid.
 * @param {BarisMonitor[]} murid
 * @returns {Array<{ label: string, nilai: string }>}
 */
export function ringkasMonitor(murid) {
  let mengerjakan = 0
  let selesai = 0
  let tidakAktif = 0
  let perluDitinjau = 0

  for (const baris of murid) {
    if (baris.status === 'berjalan') {
      if (baris.online) mengerjakan += 1
      else tidakAktif += 1
    } else {
      selesai += 1
    }
    perluDitinjau += baris.kecurangan?.belum_ditinjau ?? 0
  }

  return [
    { label: 'Mengerjakan', nilai: String(mengerjakan) },
    { label: 'Selesai', nilai: String(selesai) },
    { label: 'Tidak aktif', nilai: String(tidakAktif) },
    { label: 'Perlu ditinjau', nilai: String(perluDitinjau) },
  ]
}

/**
 * "Terakhir aktif" dalam bahasa manusia. `null` berarti murid belum pernah
 * mengirim denyut sejak monitor dibuka.
 * @param {number|null|undefined} detik
 * @returns {string}
 */
export function formatDetikTerakhir(detik) {
  if (detik === null || detik === undefined) return '—'
  if (detik < 5) return 'baru saja'
  if (detik < 60) return `${Math.round(detik)} dtk lalu`
  if (detik < 3600) return `${Math.round(detik / 60)} mnt lalu`

  const jam = Math.floor(detik / 3600)
  return `${jam} jam lalu`
}
