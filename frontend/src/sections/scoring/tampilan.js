/**
 * Pembantu tampilan antrean koreksi guru (slice 06).
 *
 * Jawaban bertingkat bisa berbentuk apa saja (teks, angka, peta id→nilai),
 * jadi keduanya diubah ke kalimat pendek supaya guru bisa menilai cepat.
 */

/**
 * Jawaban murid menjadi teks yang enak dibaca.
 * @param {unknown} jawaban
 * @returns {string}
 */
export function jawabanTeks(jawaban) {
  if (jawaban === null || jawaban === undefined) return '(belum dijawab)'
  if (typeof jawaban === 'boolean') return jawaban ? 'Benar' : 'Salah'
  if (typeof jawaban === 'number') return String(jawaban)
  if (typeof jawaban === 'string') return jawaban.trim() === '' ? '(kosong)' : jawaban
  if (Array.isArray(jawaban)) return jawaban.map((satu) => jawabanTeks(satu)).join(', ')

  return Object.entries(jawaban)
    .map(([kunci, isi]) => `${kunci} → ${jawabanTeks(isi)}`)
    .join(', ')
}

/**
 * Kunci jawaban menjadi ringkasan satu baris.
 * @param {unknown} kunci
 * @returns {string}
 */
export function ringkasKunci(kunci) {
  if (kunci === null || typeof kunci !== 'object' || Array.isArray(kunci)) return '—'

  const daftar = Object.entries(kunci).map(([nama, isi]) => `${nama}: ${jawabanTeks(isi)}`)

  return daftar.length === 0 ? '—' : daftar.join(' · ')
}

/**
 * Kelas lencana status penilaian (perlu ditinjau vs gagal).
 * @param {string} status
 * @returns {string}
 */
export function kelasStatus(status) {
  if (status === 'perlu_tinjau') return 'badge-status peringatan'
  if (status === 'gagal') return 'badge-status salah'

  return 'badge-status lembut'
}
