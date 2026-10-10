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
 * Langkah koreksi yang sedang berjalan (papan 8: stepper "skor & alasan → token
 * konfirmasi → tersimpan").
 *
 * Angkanya murni turunan dari keadaan form: belum ada token berarti guru masih
 * di langkah 1, token sudah terbit berarti langkah 2, dan setelah tersimpan
 * langkah 3 yang ditandai. Dipakai supaya penunjuk langkah tidak pernah berbeda
 * pendapat dengan tombol yang aktif.
 *
 * @param {{ tersimpan?: boolean, punyaToken?: boolean }} keadaan
 * @returns {1|2|3} nomor langkah (1-based)
 */
export function langkahKoreksi(keadaan) {
  if (keadaan.tersimpan === true) return 3

  return keadaan.punyaToken === true ? 2 : 1
}

/**
 * Kunci unik satu baris antrean koreksi (attempt + soal).
 *
 * Dipakai untuk memilih baris di antrean **berdasarkan identitasnya**, bukan
 * nomor urut baris: setelah satu koreksi tersimpan, baris itu hilang dari
 * antrean dan nomor urut baris lain bergeser — pilihan guru tidak boleh ikut
 * bergeser karena itu.
 *
 * @param {{ attempt_id: number, question_id: number }} item
 * @returns {string}
 */
export function kunciKoreksi(item) {
  return `${item.attempt_id}-${item.question_id}`
}

/**
 * Baris antrean yang sedang dibuka: yang cocok dengan `kunci`, atau baris
 * pertama bila kunci itu sudah tidak ada lagi di antrean (mis. barisnya baru
 * selesai dikoreksi).
 *
 * @template {{ attempt_id: number, question_id: number }} T
 * @param {T[]} daftar
 * @param {string|null} kunci
 * @returns {{ item: T|null, indeks: number }}
 */
export function pilihItemKoreksi(daftar, kunci) {
  if (!Array.isArray(daftar) || daftar.length === 0) return { item: null, indeks: -1 }

  const indeks = daftar.findIndex((satu) => kunciKoreksi(satu) === kunci)

  return indeks >= 0 ? { item: daftar[indeks], indeks } : { item: daftar[0], indeks: 0 }
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
