/**
 * Hitung mundur ulangan.
 *
 * Aturan repo (chunk security): timer klien hanya TAMPILAN. Sisa waktu dihitung
 * dari `deadline_at` + `server_now` yang dikirim server, sehingga jam klien yang
 * digeser tidak menambah waktu pengerjaan.
 */

/**
 * Selisih jam server terhadap jam klien (milidetik; positif = klien tertinggal).
 * @param {string} serverNowIso
 * @param {number} sekarangMs
 * @returns {number}
 */
export function geserJamMs(serverNowIso, sekarangMs) {
  const jamServer = Date.parse(serverNowIso)

  return Number.isFinite(jamServer) ? jamServer - sekarangMs : 0
}

/**
 * Sisa detik menurut jam server (tidak pernah negatif).
 * @param {{ deadlineIso: string, serverNowIso: string, sekarangMs: number }} arg
 * @returns {number}
 */
export function sisaDetik({ deadlineIso, serverNowIso, sekarangMs }) {
  const deadline = Date.parse(deadlineIso)

  if (!Number.isFinite(deadline)) return 0

  const sisaMs = deadline - (sekarangMs + geserJamMs(serverNowIso, sekarangMs))

  return Math.max(0, Math.round(sisaMs / 1000))
}

/**
 * Sisa detik dari payload attempt.
 * @param {{ deadline_at: string, server_now: string }} attempt
 * @param {number} sekarangMs
 * @returns {number}
 */
export function sisaDetikAttempt(attempt, sekarangMs) {
  return sisaDetik({
    deadlineIso: attempt.deadline_at,
    serverNowIso: attempt.server_now,
    sekarangMs,
  })
}

/**
 * Format sisa detik menjadi "MM:SS" atau "H:MM:SS".
 * @param {number} detik
 * @returns {string}
 */
export function formatSisa(detik) {
  const aman = Math.max(0, Math.floor(detik))
  const jam = Math.floor(aman / 3600)
  const menit = Math.floor((aman % 3600) / 60)
  const sisa = aman % 60
  /** @param {number} angka */
  const duaDigit = (angka) => String(angka).padStart(2, '0')

  return jam > 0 ? `${jam}:${duaDigit(menit)}:${duaDigit(sisa)}` : `${duaDigit(menit)}:${duaDigit(sisa)}`
}

/**
 * Peringatan waktu (untuk mewarnai timer) — ambang 5 menit dan 1 menit.
 * @param {number} detik
 * @returns {'aman'|'peringatan'|'kritis'}
 */
export function tingkatWaktu(detik) {
  if (detik <= 60) return 'kritis'
  if (detik <= 300) return 'peringatan'

  return 'aman'
}
