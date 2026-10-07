/**
 * API lampiran jawaban (slice 09).
 *
 * Sama seperti materi (slice 08): berkas dikirim berpotongan ber-hash supaya
 * sinyal yang putus di tengah jalan tidak membuang seluruh unggahan, dan server
 * yang memutuskan bentuk akhir berkasnya (gambar kanvas → PNG, berkas asing →
 * karantina `.upload`).
 *
 * Dua batas di bawah dicerminkan dari `config/jawaban.php` supaya anak tidak
 * menunggu unggahan selesai hanya untuk ditolak; server tetap memeriksa ulang.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'
import { potongBerkas } from '../material/api.js'

/** Batas satu berkas lampiran (byte) — cerminan `config/jawaban.php`. */
export const UKURAN_MAKS_LAMPIRAN = 10 * 1024 * 1024

/** Jumlah lampiran maksimal per soal per attempt. */
export const MAKS_LAMPIRAN_PER_SOAL = 3

/** Batas durasi rekaman diri (detik). */
export const DURASI_REKAM_MAKS = 60

/** Pilihan jenis lampiran yang dikenali server. */
export const JENIS_LAMPIRAN = ['gambar', 'rekam', 'berkas']

/** Satu lampiran jawaban (bentuk server). */
export const skemaLampiran = z.object({
  id: z.number(),
  kode: z.string(),
  question_id: z.number(),
  jenis: z.string(),
  jenis_label: z.string(),
  nama_asli: z.string().nullable(),
  ekstensi: z.string(),
  mime: z.string(),
  kategori: z.string(),
  kategori_label: z.string(),
  tampil_langsung: z.boolean(),
  ukuran: z.number(),
  ukuran_manusia: z.string(),
  durasi_detik: z.number().nullable(),
  jumlah_potongan: z.number(),
  ukuran_potongan: z.number(),
  hash: z.string().nullable(),
  status: z.string(),
  status_label: z.string(),
  url: z.string().nullable(),
})

/** Respons satu potongan yang diterima server. */
export const skemaResponsPotonganLampiran = z.object({
  message: z.string(),
  indeks: z.number(),
  ukuran: z.number(),
  hash: z.string(),
})

/** @typedef {z.infer<typeof skemaLampiran>} DataLampiran */

/**
 * Jenis lampiran menurut tipe berkas kiriman.
 *
 * Foto dari kamera perangkat diperlakukan sebagai gambar (server tetap
 * mengencode ulang ke PNG); sisanya berkas biasa.
 *
 * @param {{type?: string}|File|null|undefined} berkas
 * @returns {'gambar'|'berkas'}
 */
export function jenisLampiranUntukBerkas(berkas) {
  const tipe = String(berkas?.type ?? '')
  return tipe.startsWith('image/') ? 'gambar' : 'berkas'
}

/**
 * Tolak berkas terlalu besar/kosong sebelum diunggah.
 *
 * @param {File|{size: number}|null|undefined} berkas
 * @param {number} [ukuranMaks]
 * @returns {string|null} pesan galat, atau null bila lolos
 */
export function periksaBerkasLampiran(berkas, ukuranMaks = UKURAN_MAKS_LAMPIRAN) {
  if (!berkas || typeof berkas.size !== 'number') return 'Pilih berkas dulu.'
  if (berkas.size <= 0) return 'Berkas kosong.'
  if (berkas.size > ukuranMaks) {
    return `Berkas terlalu besar (batas ${Math.round(ukuranMaks / (1024 * 1024))} MiB).`
  }

  return null
}

/**
 * Masih boleh mengunggah? Deadline dihitung server; klien hanya menyembunyikan
 * tombolnya lebih awal supaya anak tidak mengunggah berkas besar sia-sia.
 *
 * @param {number} sisaDetik
 * @returns {boolean}
 */
export function bolehUnggahLampiran(sisaDetik) {
  return Number(sisaDetik) > 0
}

/**
 * Sisa kuota lampiran satu soal.
 *
 * @param {DataLampiran[]} lampiran
 * @param {number} soalId
 * @param {number} [maks]
 * @returns {number}
 */
export function sisaKuotaLampiran(lampiran, soalId, maks = MAKS_LAMPIRAN_PER_SOAL) {
  const dipakai = (lampiran ?? []).filter((satu) => Number(satu.question_id) === Number(soalId)).length
  return Math.max(0, maks - dipakai)
}

/**
 * Buang sesi unggah yang belum selesai dari daftar tampilan (sesi mati tidak
 * pernah ditampilkan sebagai lampiran).
 *
 * @param {DataLampiran[]} lampiran
 * @returns {DataLampiran[]}
 */
export function hanyaLampiranSelesai(lampiran) {
  return (lampiran ?? []).filter((satu) => satu.status === 'selesai')
}

/**
 * Lampiran satu attempt (murid: miliknya; guru: untuk menilai).
 * @param {number} attemptId
 */
export async function daftarLampiran(attemptId) {
  const respons = await client.get(`/v1/attempt/${attemptId}/lampiran`)
  return z.array(skemaLampiran).parse(respons.data)
}

/**
 * Buka sesi unggah untuk satu soal.
 * @param {number} attemptId
 * @param {{question_id: number, jenis: string, nama?: string, ukuran: number, durasi_detik?: number}} muatan
 */
export async function mulaiLampiran(attemptId, muatan) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/attempt/${attemptId}/lampiran`, muatan)
  return skemaLampiran.parse(respons.data)
}

/**
 * Kirim satu potongan (multipart: berkas biner tidak dibungkus base64).
 * @param {string} kode
 * @param {number} indeks
 * @param {ArrayBuffer} isi
 */
export async function kirimPotonganLampiran(kode, indeks, isi) {
  await ambilCsrfCookie()

  const bentuk = new FormData()
  bentuk.append('potongan', new Blob([isi], { type: 'application/octet-stream' }), `potongan-${indeks}.bin`)
  bentuk.append('hash', await hashSha256(isi))

  const respons = await client.put(`/v1/lampiran/${kode}/potongan/${indeks}`, bentuk)
  return skemaResponsPotonganLampiran.parse(respons.data)
}

/** @param {string} kode */
export async function selesaikanLampiran(kode) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/lampiran/${kode}/selesai`)
  return skemaLampiran.parse(respons.data)
}

/** @param {string} kode */
export async function hapusLampiran(kode) {
  await ambilCsrfCookie()
  await client.delete(`/v1/lampiran/${kode}`)
}

/**
 * Unggah satu berkas lampiran lengkap: buka sesi → kirim tiap potongan → gabung.
 *
 * @param {number} attemptId
 * @param {{question_id: number, jenis: string, nama?: string, durasi_detik?: number}} muatan
 * @param {Blob} isi
 * @param {{onProgres?: (persen: number) => void}} [opsi]
 * @returns {Promise<DataLampiran>}
 */
export async function unggahLampiran(attemptId, muatan, isi, opsi = {}) {
  const sesi = await mulaiLampiran(attemptId, {
    ...muatan,
    nama: muatan.nama ?? 'lampiran',
    ukuran: isi.size,
  })

  const potongan = potongBerkas(await isi.arrayBuffer(), sesi.ukuran_potongan)

  for (let indeks = 0; indeks < potongan.length; indeks++) {
    await kirimPotonganLampiran(sesi.kode, indeks, potongan[indeks])
    opsi.onProgres?.(Math.round(((indeks + 1) / potongan.length) * 100))
  }

  return selesaikanLampiran(sesi.kode)
}

/**
 * Hash sha256 hex dari isi berkas (server memverifikasi hash tiap potongan).
 *
 * @param {ArrayBuffer} isi
 * @returns {Promise<string>}
 */
export async function hashSha256(isi) {
  const sidik = await crypto.subtle.digest('SHA-256', isi)

  return Array.from(new Uint8Array(sidik))
    .map((bita) => bita.toString(16).padStart(2, '0'))
    .join('')
}
