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
 *
 * Saat LURING server tidak bisa ditanyai lagi, jadi penjagaannya pindah ke
 * `sekarangTerkunci`: waktu "sekarang" dihitung dari jam MONOTONIK (yang tidak
 * bisa dimundurkan murid) sejak respons terakhir, bukan dari jam dinding yang
 * bisa diubah lewat setelan Windows.
 */

/**
 * Toleransi selisih jam dinding vs jam monotonik sebelum dianggap digeser (ms).
 *
 * 5 detik cukup longgar untuk koreksi NTP/pergeseran kecil dan cukup ketat untuk
 * menangkap jam yang sengaja dimundurkan murid.
 */
export const TOLERANSI_GESER_JAM_MS = 5000

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
 * Waktu "sekarang" yang tidak bisa ditambah dengan menggeser jam perangkat.
 *
 * Dipakai saat luring (dan saat jam perangkat terlihat diubah): alih-alih
 * mempercayai jam dinding, waktu berjalan dari acuan respons server terakhir
 * (`acuanMs` = jam klien saat respons tiba) ditambah selisih jam MONOTONIK.
 * Jam monotonik hanya naik dan tidak terpengaruh setelan waktu sistem, jadi
 * memundurkan jam Windows tidak menambah sisa waktu pengerjaan.
 *
 * @param {{ acuanMs: number, acuanMonotonMs: number, sekarangMs: number, monotonMs: number,
 *   toleransiMs?: number }} arg
 * @returns {{ ms: number, tergeser: boolean, geserMs: number }}
 *   `ms` = perkiraan jam klien yang aman (domain jam klien, siap dipakai
 *   `sisaDetikAttempt`); `tergeser` = jam dinding berbeda dari jam monotonik
 *   lebih dari toleransi; `geserMs` = besar selisihnya (positif = jam maju).
 */
export function sekarangTerkunci(arg) {
  const { acuanMs, acuanMonotonMs, sekarangMs, monotonMs, toleransiMs = TOLERANSI_GESER_JAM_MS } = arg

  const lariMs = Math.max(0, monotonMs - acuanMonotonMs)
  const geserMs = sekarangMs - acuanMs - lariMs

  return {
    ms: acuanMs + lariMs,
    tergeser: Math.abs(geserMs) > toleransiMs,
    geserMs,
  }
}

/**
 * Jam klien sekarang: jam dinding + jam monotonik.
 *
 * Dipakai berpasangan oleh `sekarangTerkunci` supaya bisa dibandingkan: jam
 * dinding bisa diubah murid lewat setelan sistem, jam monotonik tidak.
 * @returns {{ dinding: number, monoton: number }}
 */
export function jamKlien() {
  return {
    dinding: Date.now(),
    monoton: typeof performance !== 'undefined' ? performance.now() : Date.now(),
  }
}

/**
 * Sisa detik + keadaan jam untuk layar pengerjaan.
 *
 * Satu tempat ini dipakai detak tiap detik maupun perhitungan saat menggambar,
 * supaya keduanya tidak pernah berbeda pendapat soal sisa waktu.
 *
 * @param {{ attempt: { deadline_at: string, server_now: string } | null, offsetMs: number,
 *   acuan: { ms: number, monoton: number } | null,
 *   kini: { dinding: number, monoton: number } }} arg
 * @returns {{ sisa: number, ms: number, tergeser: boolean, geserMs: number }}
 *   `ms` = perkiraan jam klien yang aman (domain jam klien).
 */
export function hitungSisaAman(arg) {
  const { attempt, offsetMs, acuan, kini } = arg

  if (attempt === null) {
    return { sisa: 0, ms: kini.dinding, tergeser: false, geserMs: 0 }
  }

  const jam =
    acuan === null
      ? { ms: kini.dinding, tergeser: false, geserMs: 0 }
      : sekarangTerkunci({
          acuanMs: acuan.ms,
          acuanMonotonMs: acuan.monoton,
          sekarangMs: kini.dinding,
          monotonMs: kini.monoton,
        })

  return {
    sisa: sisaDetikAttempt(attempt, jam.ms, offsetMs),
    ms: jam.ms,
    tergeser: jam.tergeser,
    geserMs: jam.geserMs,
  }
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
