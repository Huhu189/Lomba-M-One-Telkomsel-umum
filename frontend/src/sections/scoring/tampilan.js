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
 * Ringkasan saran AI untuk satu baris antrean koreksi (slice 09-B).
 *
 * Saran AI tidak pernah menggantikan nilai: yang ditampilkan cuma angka usulan,
 * dan guru tetap harus menyimpan koreksinya sendiri.
 *
 * @param {{ saran_ai: number|null, skor_maksimal: number, ai_status: string|null }} item
 * @returns {string|null} teks saran, atau null bila belum ada saran
 */
export function saranAiTeks(item) {
  if (typeof item.saran_ai === 'number') {
    return `Saran AI: ${item.saran_ai} dari maksimal ${item.skor_maksimal} (silakan dicek dulu)`
  }

  if (item.ai_status === 'gagal') {
    return 'AI gagal menilai soal ini — nilai manual dari guru.'
  }

  return null
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
