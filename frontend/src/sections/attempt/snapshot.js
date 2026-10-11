/**
 * Salinan attempt di perangkat (sistem luring).
 *
 * Kenapa perlu: saat luring, `POST /kuis/{id}/mulai` tidak bisa dijawab server.
 * Tanpa salinan, murid yang berpindah halaman di dalam aplikasi (daftar ulangan
 * → kerjakan lagi) menemukan layar galat padahal jawaban dan riwayatnya masih
 * ada di perangkat. Salinan ini hanya memuat payload yang MEMANG sudah tampil di
 * layar murid (soal tanpa kunci jawaban + jawaban yang sudah dikirim server),
 * dan dihapus begitu hasil final diterima.
 *
 * Aturan repo: salinan lokal tidak boleh memuat kunci jawaban — payload attempt
 * dari server memang tidak pernah memuatnya (K-02), jadi yang disimpan di sini
 * sama isinya dengan yang ada di layar.
 */
import { z } from 'zod'
import { skemaAttempt } from './api.js'

/** Kunci localStorage salinan attempt. */
export const KUNCI_SNAPSHOT = 'ulangan-snapshot-attempt-v1'

/** Jumlah kuis yang salinannya disimpan (yang paling lama dibuang). */
export const BATAS_SNAPSHOT = 5

/** Umur salinan (ms) — 24 jam; ulangan tidak berjalan lebih dari sehari. */
export const UMUR_SNAPSHOT_MS = 24 * 60 * 60 * 1000

/**
 * @typedef {{ disimpanAt: number, attempt: import('zod').infer<typeof skemaAttempt> }} Snapshot
 */

/** Bentuk satu salinan yang tersimpan di perangkat (dipakai untuk validasi). */
export const skemaSnapshot = z.object({ disimpanAt: z.number(), attempt: skemaAttempt })

/**
 * Geser `server_now` salinan sesuai umur salinan.
 *
 * Saat dibaca ulang, layar menghitung offset jam dari `server_now` terhadap jam
 * perangkat SEKARANG. Tanpa penyesuaian ini, sisa waktu seolah membeku sejak
 * salinan dibuat — murid yang memuat ulang setelah 30 menit luring akan melihat
 * waktu mundur dari 30 menit lalu. Penyesuaian memakai jam dinding perangkat
 * karena jam monotonik tidak bertahan melewati muat ulang; karenanya penilaian
 * akhir tetap ditentukan server (aturan repo: timer klien hanya tampilan).
 *
 * @param {import('zod').infer<typeof skemaAttempt>} attempt
 * @param {number} disimpanAt
 * @param {number} sekarangMs
 * @returns {import('zod').infer<typeof skemaAttempt>}
 */
export function sesuaikanServerNow(attempt, disimpanAt, sekarangMs) {
  const ms = Date.parse(attempt.server_now)

  if (!Number.isFinite(ms)) return attempt

  const bertambah = Math.max(0, sekarangMs - disimpanAt)

  return { ...attempt, server_now: new Date(ms + bertambah).toISOString() }
}

/**
 * Ambil salinan yang bentuknya dikenal dari isi penyimpanan mentah, buang yang
 * kedaluwarsa, lalu sisakan yang paling baru.
 *
 * Isinya diperlakukan sebagai data luar (Zod), bukan sebagai tipe yang sudah
 * tepercaya: satu entri rusak cukup dibuang sendiri, bukan menjatuhkan sisanya.
 *
 * @param {unknown} mentah isi JSON dari localStorage (belum divalidasi)
 * @param {number} sekarangMs
 * @param {{ batas?: number, umurMs?: number }} [opsi]
 * @returns {Record<string, Snapshot>}
 */
export function rapikanSnapshot(mentah, sekarangMs, opsi = {}) {
  const { batas = BATAS_SNAPSHOT, umurMs = UMUR_SNAPSHOT_MS } = opsi

  if (mentah === null || typeof mentah !== 'object' || Array.isArray(mentah)) return {}

  /** @type {Array<[string, Snapshot]>} */
  const hidup = []

  for (const [kunci, satu] of Object.entries(/** @type {Record<string, unknown>} */ (mentah))) {
    const hasil = skemaSnapshot.safeParse(satu)

    if (!hasil.success) continue
    if (sekarangMs - hasil.data.disimpanAt > umurMs) continue

    hidup.push([kunci, hasil.data])
  }

  hidup.sort((a, b) => a[1].disimpanAt - b[1].disimpanAt)

  /** @type {Record<string, Snapshot>} */
  const rapi = {}

  for (const [kunci, satu] of hidup.slice(-batas)) {
    rapi[kunci] = satu
  }

  return rapi
}

/**
 * Baca seluruh isi salinan dari localStorage (dipulihkan aman bila rusak).
 * @param {number} [sekarangMs]
 * @returns {Record<string, Snapshot>}
 */
export function bacaSemua(sekarangMs = Date.now()) {
  try {
    const mentah = window.localStorage.getItem(KUNCI_SNAPSHOT)

    if (mentah === null) return {}

    return rapikanSnapshot(JSON.parse(mentah), sekarangMs)
  } catch {
    return {}
  }
}

/**
 * Tulis ulang seluruh isi salinan.
 * @param {Record<string, Snapshot>} isi
 * @returns {boolean}
 */
function tulisSemua(isi) {
  try {
    if (Object.keys(isi).length === 0) {
      window.localStorage.removeItem(KUNCI_SNAPSHOT)

      return true
    }

    window.localStorage.setItem(KUNCI_SNAPSHOT, JSON.stringify(isi))

    return true
  } catch {
    // Penyimpanan penuh/diblokir: ulangan daring tetap jalan tanpanya.
    return false
  }
}

/**
 * Simpan salinan satu attempt (payload yang baru diterima server).
 * @param {import('zod').infer<typeof skemaAttempt>} attempt
 * @param {{ sekarangMs?: number }} [opsi]
 * @returns {boolean}
 */
export function simpanSnapshot(attempt, opsi = {}) {
  const sekarangMs = opsi.sekarangMs ?? Date.now()
  const isi = bacaSemua(sekarangMs)

  isi[String(attempt.quiz_id)] = { disimpanAt: sekarangMs, attempt }

  return tulisSemua(rapikanSnapshot(isi, sekarangMs))
}

/**
 * Ambil salinan attempt sebuah kuis (waktu server disesuaikan umur salinan).
 * @param {number} kuisId
 * @param {{ sekarangMs?: number }} [opsi]
 * @returns {import('zod').infer<typeof skemaAttempt> | null}
 */
export function ambilSnapshot(kuisId, opsi = {}) {
  const sekarangMs = opsi.sekarangMs ?? Date.now()
  const satu = bacaSemua(sekarangMs)[String(kuisId)]

  if (satu === undefined) return null

  return sesuaikanServerNow(satu.attempt, satu.disimpanAt, sekarangMs)
}

/**
 * Hapus salinan satu kuis — dipanggil setelah hasil final diterima.
 * @param {number} kuisId
 * @returns {boolean}
 */
export function bersihkanSnapshot(kuisId) {
  const isi = bacaSemua()

  delete isi[String(kuisId)]

  return tulisSemua(isi)
}

/**
 * Hapus seluruh salinan — dipakai saat keluar/sesi berakhir (S-14).
 * @returns {boolean}
 */
export function bersihkanSemuaSnapshot() {
  return tulisSemua({})
}
