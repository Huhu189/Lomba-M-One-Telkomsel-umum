/**
 * Layar guru → perangkat murid (slice 10).
 *
 * Guru menyiapkan satu keadaan layar per kuis (kosong / pengumuman / sorot soal /
 * instruksi setelah ulangan); perangkat murid mengikuti keadaan itu lewat SSE
 * dan jatuh ke polling bila SSE tidak tersedia. Semua respons divalidasi Zod
 * supaya bentuk data server tidak diam-diam berubah.
 *
 * Catatan penting: **kunci jawaban tidak pernah ada di payload ini** — mode
 * "sorot soal" hanya membawa konten soal, tanpa kunci/pembahasan (dijaga di
 * server, dan schema di sini pun tidak memiliki kolomnya sehingga bocoran
 * sekecil apa pun akan membuat parse gagal, bukan diam-diam terpakai).
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'

/** Satu soal yang sedang disorot guru (tanpa kunci jawaban). */
export const skemaSoalLayar = z.object({
  id: z.number(),
  nomor: z.number(),
  tipe: z.string(),
  tipe_label: z.string(),
  konten: z.record(z.string(), z.unknown()),
  skor: z.number(),
})

/** Pilihan soal di layar guru (id + nomor + cuplikan teks). */
export const skemaPilihanSoal = z.object({
  id: z.number(),
  nomor: z.number(),
  ringkas: z.string(),
})

/** Satu mode layar beserta labelnya (dikirim server, jadi tidak ada salinan ganda). */
export const skemaModeLayar = z.object({
  nilai: z.string(),
  label: z.string(),
})

/** Keadaan layar satu kuis. */
export const skemaLayar = z.object({
  kuis_id: z.number(),
  aktif: z.boolean(),
  mode: z.string(),
  mode_label: z.string(),
  judul: z.string().nullable(),
  isi: z.string().nullable(),
  soal: skemaSoalLayar.nullable(),
  versi: z.number(),
  diperbarui_at: z.string().nullable(),
  // Hanya pada jawaban untuk guru (bahan pengendali layar).
  diubah_oleh: z.number().nullable().optional(),
  kelas_nama: z.string().nullable().optional(),
  judul_kuis: z.string().optional(),
  maks_judul: z.number().optional(),
  maks_isi: z.number().optional(),
  daftar_soal: z.array(skemaPilihanSoal).optional(),
  daftar_mode: z.array(skemaModeLayar).optional(),
})

/** Respons penerbitan tiket SSE (bentuknya sama seperti tiket Live Monitor). */
export const skemaTiketSse = z.object({
  tiket: z.string(),
  expires_at: z.string(),
  ttl_detik: z.number(),
})

/**
 * @typedef {z.infer<typeof skemaLayar>} DataLayar
 * @typedef {z.infer<typeof skemaPilihanSoal>} DataPilihanSoal
 */

/** Mode yang wajib menyertakan soal yang disorot (cermin `ModeLayar::butuhSoal`). */
export const MODE_SOAL = 'soal'

/** Mode yang wajib punya judul/isi (cermin `ModeLayar::butuhTulisan`). */
const MODE_TULISAN = ['pengumuman', 'hasil']

/**
 * @param {number} kuisId
 * @returns {Promise<DataLayar>}
 */
export async function ambilLayar(kuisId) {
  const respons = await client.get(`/v1/kuis/${kuisId}/layar`)
  return skemaLayar.parse(respons.data)
}

/**
 * @param {number} kuisId
 * @param {{ mode: string, judul?: string|null, isi?: string|null, question_id?: number|null }} data
 * @returns {Promise<DataLayar>}
 */
export async function simpanLayar(kuisId, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/kuis/${kuisId}/layar`, data)
  return skemaLayar.parse(respons.data)
}

/**
 * Tiket sekali pakai untuk mengikuti kanal kuis (jalur murid — guru memakai
 * tiket Live Monitor lewat `sections/cheat/api.js`).
 * @param {number} kuisId
 * @returns {Promise<z.infer<typeof skemaTiketSse>>}
 */
export async function terbitkanTiketLayar(kuisId) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/kuis/${kuisId}/sse-tiket-murid`)
  return skemaTiketSse.parse(respons.data)
}

/**
 * Ringkasan satu baris keadaan layar — dipakai di lencana halaman guru supaya
 * guru tahu layar sedang menampilkan apa tanpa membaca ulang seluruh form.
 *
 * @param {DataLayar} data
 * @returns {string}
 */
export function ringkasLayar(data) {
  if (!data.aktif) return 'Layar guru dimatikan di pengaturan'

  if (data.mode === MODE_SOAL) {
    return data.soal === null ? 'Sorotan soal (belum dipilih)' : `Sorotan soal nomor ${data.soal.nomor}`
  }

  if (data.mode === 'pengumuman' || data.mode === 'hasil') {
    const judul = data.judul ?? data.isi ?? ''

    return judul === '' ? data.mode_label : `${data.mode_label}: ${judul}`
  }

  return data.mode_label
}

/**
 * Mode ini butuh judul/isi?
 * @param {string} mode
 * @returns {boolean}
 */
export function butuhTulisan(mode) {
  return MODE_TULISAN.includes(mode)
}

/**
 * Mode ini butuh soal yang disorot?
 * @param {string} mode
 * @returns {boolean}
 */
export function butuhSoal(mode) {
  return mode === MODE_SOAL
}

/**
 * Boleh menyimpan form dengan mode terpilih?
 *
 * Dipakai untuk menonaktifkan tombol simpan lebih awal (dengan penjelasan di
 * layar), bukan membiarkan guru menekan tombol lalu ditolak server.
 *
 * @param {{ mode: string, judul: string, isi: string, soalId: number|null }} form
 * @returns {boolean}
 */
export function bolehSimpan(form) {
  if (butuhSoal(form.mode)) return form.soalId !== null

  if (butuhTulisan(form.mode)) return form.judul.trim() !== '' || form.isi.trim() !== ''

  return true
}
