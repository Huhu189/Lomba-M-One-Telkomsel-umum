/**
 * Hitung mundur ulangan.
 *
 * Aturan repo (chunk security): timer klien hanya TAMPILAN. Sisa waktu dihitung
 * dari `deadline_at` + offset jam server yang dikirim server, sehingga jam klien
 * yang digeser tidak menambah waktu pengerjaan.
 *
 * Offset dihitung sekali per respons (`offsetAttemptMs`), bukan tiap detak —
 * kalau tidak, koreksi jam saling meniadakan dengan jam klien yang berjalan dan
 * hitung mundur membeku (Q-01 dari audit 8 Oktober 2026).
 */

/**
 * Selisih jam server terhadap jam klien (milidetik; positif = klien tertinggal).
 *
 * PENTING: hitung SEKALI per respons — pakai waktu saat data tiba (mis.
 * `dataUpdatedAt` dari react-query) — lalu pakai hasilnya sebagai offset TETAP.
 * Bila dihitung ulang dengan jam klien yang sedang berjalan, `sekarangMs` akan
 * saling meniadakan dengan offset sehingga hitung mundur membeku (bug Q-01).
 * @param {string} serverNowIso
 * @param {number} sekarangMs
 * @returns {number}
 */
export function geserJamMs(serverNowIso, sekarangMs) {
  const jamServer = Date.parse(serverNowIso)

  return Number.isFinite(jamServer) ? jamServer - sekarangMs : 0
}

/**
 * Offset jam dari payload attempt, dihitung sekali saat respons diterima.
 * @param {{ server_now: string }} attempt
 * @param {number} sekarangMs saat respons tiba (jam klien)
 * @returns {number}
 */
export function offsetAttemptMs(attempt, sekarangMs) {
  return geserJamMs(attempt.server_now, sekarangMs)
}

/**
 * Sisa detik menurut jam server (tidak pernah negatif).
 * @param {{ deadlineIso: string, offsetMs: number, sekarangMs: number }} arg
 * @returns {number}
 */
export function sisaDetik({ deadlineIso, offsetMs, sekarangMs }) {
  const deadline = Date.parse(deadlineIso)

  if (!Number.isFinite(deadline)) return 0

  const sisaMs = deadline - (sekarangMs + offsetMs)

  return Math.max(0, Math.round(sisaMs / 1000))
}

/**
 * Sisa detik dari payload attempt.
 * @param {{ deadline_at: string, server_now: string }} attempt
 * @param {number} sekarangMs
 * @param {number} offsetMs offset tetap dari respons (lihat geserJamMs)
 * @returns {number}
 */
export function sisaDetikAttempt(attempt, sekarangMs, offsetMs) {
  return sisaDetik({
    deadlineIso: attempt.deadline_at,
    offsetMs,
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
