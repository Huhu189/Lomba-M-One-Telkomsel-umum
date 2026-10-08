/**
 * API materi berblok (slice 08).
 *
 * Materi = urutan blok (teks, media, kuis). Server yang menegakkan urutan blok
 * wajib dan yang membuat attempt latihan saat blok kuis dibuka — klien hanya
 * menampilkan. Karena itu hampir semua respons divalidasi Zod, termasuk
 * ringkasan progres murid.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'
import { skemaAttempt } from '../attempt/api.js'

/** Satu berkas materi yang sudah selesai diunggah. */
export const skemaUnggahan = z.object({
  kode: z.string(),
  nama_asli: z.string(),
  ekstensi: z.string(),
  mime: z.string(),
  kategori: z.string(),
  kategori_label: z.string(),
  tampil_langsung: z.boolean(),
  ukuran: z.number(),
  ukuran_manusia: z.string(),
  jumlah_potongan: z.number(),
  ukuran_potongan: z.number(),
  hash: z.string().nullable(),
  status: z.string(),
  status_label: z.string(),
  url: z.string().nullable(),
})

/** Sesi unggah yang baru dibuka (klien memakai jumlah_potongan + ukuran_potongan). */
export const skemaSesiUnggahan = skemaUnggahan

/** Satu blok materi seperti dilihat guru (MateriResource). */
export const skemaBlokMateri = z.object({
  block_id: z.number(),
  urutan: z.number(),
  tipe: z.string(),
  tipe_label: z.string(),
  wajib: z.boolean(),
  teks: z.string().nullable().optional(),
  unggahan_kode: z.string().nullable().optional(),
  keterangan: z.string().nullable().optional(),
  quiz_id: z.number().nullable().optional(),
  // Penempatan klip di timeline editor (gaya video editor).
  track: z.number().optional(),
  mulai_detik: z.number().optional(),
  durasi_detik: z.number().optional(),
  kuis_judul: z.string().nullable().optional(),
  jumlah_soal: z.number().nullable().optional(),
})

/** Materi untuk guru. */
export const skemaMateri = z.object({
  id: z.number(),
  judul: z.string(),
  deskripsi: z.string().nullable(),
  status: z.string(),
  status_label: z.string().optional(),
  subject_id: z.number().optional(),
  class_id: z.number().optional(),
  tag_id: z.number().nullable().optional(),
  urutan: z.number().optional(),
  mapel_nama: z.string().nullable().optional(),
  kelas_nama: z.string().nullable().optional(),
  tema_nama: z.string().nullable().optional(),
  publikasi_at: z.string().nullable().optional(),
  jumlah_blok: z.number().optional(),
  blok: z.array(skemaBlokMateri).optional(),
  unggahan: z.array(skemaUnggahan).optional(),
})

/** Materi pada daftar murid (GET /materi-saya). */
export const skemaMateriRingkas = z.object({
  id: z.number(),
  judul: z.string(),
  deskripsi: z.string().nullable(),
  mapel_nama: z.string().nullable().optional(),
  tema_nama: z.string().nullable().optional(),
  jumlah_blok: z.number(),
})

/** Satu baris progres blok milik murid. */
export const skemaProgresBlok = z.object({
  block_id: z.number(),
  urutan: z.number(),
  tipe: z.string(),
  tipe_label: z.string(),
  wajib: z.boolean(),
  status: z.string(),
  status_label: z.string(),
  skor: z.number().optional(),
})

/** Ringkasan progres murid pada satu materi. */
export const skemaRingkasanMateri = z.object({
  materi: z.object({
    id: z.number(),
    judul: z.string(),
    deskripsi: z.string().nullable(),
    mapel_nama: z.string().nullable().optional(),
    tema_nama: z.string().nullable().optional(),
  }),
  blok: z.array(skemaProgresBlok),
  jumlah_blok: z.number(),
  selesai_wajib: z.number(),
  jumlah_wajib: z.number(),
  persen: z.number(),
})

/** Isi blok setelah dibuka murid (teks / media / penunjukan kuis). */
export const skemaIsiBlok = skemaProgresBlok.extend({
  teks: z.string().optional(),
  media: z
    .object({
      kode: z.string(),
      keterangan: z.string().optional(),
      nama: z.string().optional(),
      kategori: z.string().optional(),
      kategori_label: z.string().optional(),
      tampil_langsung: z.boolean().optional(),
      mime: z.string().optional(),
      ukuran: z.number().optional(),
      ukuran_manusia: z.string().optional(),
      url: z.string().optional(),
      tersedia: z.boolean().optional(),
    })
    .optional(),
  kuis: z
    .object({
      id: z.number(),
      judul: z.string(),
      jumlah_soal: z.number(),
    })
    .optional(),
})

/** Hasil membuka satu blok: isi blok + attempt latihan bila blok kuis. */
export const skemaBukaBlok = z.object({
  blok: skemaIsiBlok,
  attempt: skemaAttempt.nullable(),
})

/** Laporan materi untuk guru (skema longgar: bentuknya bisa bertambah). */
export const skemaLaporanMateri = z.object({
  materi: z.object({
    id: z.number(),
    judul: z.string(),
    status: z.string(),
    mapel_nama: z.string().nullable().optional(),
    kelas_nama: z.string().nullable().optional(),
    tema_nama: z.string().nullable().optional(),
  }),
  blok: z.array(
    z.object({
      block_id: z.number(),
      urutan: z.number(),
      tipe: z.string(),
      tipe_label: z.string(),
      wajib: z.boolean(),
      kuis_id: z.number().nullable().optional(),
      kuis_judul: z.string().nullable().optional(),
    }),
  ),
  murid: z.array(
    z.object({
      murid_id: z.number(),
      nama: z.string().nullable(),
      blok_selesai: z.number(),
      jumlah_blok: z.number(),
      selesai_wajib: z.number(),
      jumlah_wajib: z.number(),
      skor_latihan: z.number(),
      skor_latihan_maksimal: z.number(),
      tema: z.array(
        z.object({
          tag_id: z.number(),
          tag_nama: z.string(),
          jumlah_soal: z.number(),
          jumlah_benar: z.number(),
          persen: z.number(),
          tingkat: z.string(),
          tingkat_label: z.string(),
        }),
      ),
      blok: z.array(
        z.object({
          block_id: z.number(),
          urutan: z.number(),
          tipe: z.string(),
          tipe_label: z.string(),
          wajib: z.boolean(),
          status: z.string(),
          status_label: z.string(),
          skor: z.number(),
          attempt_id: z.number().nullable().optional(),
          dikumpulkan_at: z.string().nullable().optional(),
        }),
      ),
    }),
  ),
})

/** Respons potongan yang diterima server. */
export const skemaResponsPotongan = z.object({
  message: z.string(),
  indeks: z.number(),
  ukuran: z.number(),
  hash: z.string(),
})

/**
 * @typedef {z.infer<typeof skemaMateri>} DataMateri
 * @typedef {z.infer<typeof skemaUnggahan>} DataUnggahan
 * @typedef {z.infer<typeof skemaRingkasanMateri>} DataRingkasanMateri
 * @typedef {z.infer<typeof skemaIsiBlok>} DataIsiBlok
 * @typedef {z.infer<typeof skemaLaporanMateri>} DataLaporanMateri
 * @typedef {{
 *   judul: string,
 *   deskripsi?: string,
 *   subject_id: number,
 *   class_id: number,
 *   tag_id?: number|null,
 * }} MuatanMateri
 * @typedef {{
 *   tipe: 'teks'|'media'|'kuis',
 *   wajib: boolean,
 *   isi?: Record<string, unknown>,
 *   quiz_id?: number|null,
 *   track?: number,
 *   mulai_detik?: number,
 *   durasi_detik?: number,
 * }} MuatanBlok
 */

/**
 * Potong isi berkas menjadi gumpalan berukuran tetap (murni, mudah diuji).
 *
 * Server menentukan ukuran potongan (`ukuran_potongan`), jadi klien tidak
 * menebak: jumlah potongan yang dikirim selalu sesuai kontrak server.
 *
 * @param {ArrayBuffer|Uint8Array} isi
 * @param {number} ukuranPotongan
 * @returns {ArrayBuffer[]}
 */
export function potongBerkas(isi, ukuranPotongan) {
  const buffer =
    isi instanceof ArrayBuffer
      ? isi
      : new Uint8Array(/** @type {Uint8Array} */ (isi)).buffer

  const ukuran = Number(ukuranPotongan) > 0 ? Number(ukuranPotongan) : 1024 * 1024
  const potongan = []

  for (let mulai = 0; mulai < buffer.byteLength; mulai += ukuran) {
    potongan.push(buffer.slice(mulai, Math.min(mulai + ukuran, buffer.byteLength)))
  }

  return potongan.length > 0 ? potongan : [new ArrayBuffer(0)]
}

/**
 * Blok yang boleh dibuka berikutnya menurut aturan server (blok wajib dulu).
 * @param {DataRingkasanMateri|undefined|null} ringkasan
 * @returns {z.infer<typeof skemaProgresBlok>|null}
 */
export function blokBerikutnya(ringkasan) {
  const blok = [...(ringkasan?.blok ?? [])].sort((a, b) => a.urutan - b.urutan)
  const wajibTertunda = blok.find((satu) => satu.wajib && satu.status !== 'selesai')

  if (wajibTertunda) return wajibTertunda

  return blok.find((satu) => satu.status !== 'selesai') ?? null
}

/**
 * Apakah satu blok boleh dibuka: semua blok wajib sebelumnya harus selesai.
 * @param {DataRingkasanMateri|undefined|null} ringkasan
 * @param {z.infer<typeof skemaProgresBlok>} blok
 * @returns {boolean}
 */
export function bolehDibuka(ringkasan, blok) {
  return (ringkasan?.blok ?? [])
    .filter((satu) => satu.wajib && satu.urutan < blok.urutan)
    .every((satu) => satu.status === 'selesai')
}

/** Daftar materi (guru: semua materi sekolah; murid: materi terbit kelasnya). */
export async function ambilMateri() {
  const respons = await client.get('/v1/materi')
  return z.array(skemaMateri).parse(respons.data)
}

/** @param {number} id */
export async function ambilMateriDetail(id) {
  const respons = await client.get(`/v1/materi/${id}`)
  return skemaMateri.parse(respons.data)
}

/** @param {MuatanMateri} data */
export async function buatMateri(data) {
  await ambilCsrfCookie()
  const respons = await client.post('/v1/materi', data)
  return skemaMateri.parse(respons.data)
}

/** @param {number} id @param {Partial<MuatanMateri>} data */
export async function ubahMateri(id, data) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/materi/${id}`, data)
  return skemaMateri.parse(respons.data)
}

/** @param {number} id */
export async function hapusMateri(id) {
  await ambilCsrfCookie()
  await client.delete(`/v1/materi/${id}`)
}

/**
 * Ganti seluruh urutan blok materi.
 * @param {number} id
 * @param {MuatanBlok[]} blok
 */
export async function sinkronBlok(id, blok) {
  await ambilCsrfCookie()
  const respons = await client.put(`/v1/materi/${id}/blok`, { blok })
  return skemaMateri.parse(respons.data)
}

/** @param {number} id */
export async function publikasiMateri(id) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/materi/${id}/publikasi`)
  return skemaMateri.parse(respons.data)
}

/**
 * Buka sesi unggah untuk sebuah materi.
 * @param {number} materiId
 * @param {{nama: string, ukuran: number}} data
 */
export async function mulaiUnggahan(materiId, data) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/materi/${materiId}/unggahan`, data)
  return skemaSesiUnggahan.parse(respons.data)
}

/**
 * Kirim satu potongan berkas (multipart: berkas biner tidak dibungkus base64).
 * @param {string} kode
 * @param {number} indeks
 * @param {ArrayBuffer} isi
 */
export async function kirimPotongan(kode, indeks, isi) {
  await ambilCsrfCookie()
  const bentuk = new FormData()
  bentuk.append(
    'potongan',
    new Blob([isi], { type: 'application/octet-stream' }),
    `potongan-${indeks}.bin`,
  )

  const respons = await client.put(`/v1/unggahan/${kode}/potongan/${indeks}`, bentuk)
  return skemaResponsPotongan.parse(respons.data)
}

/** @param {string} kode */
export async function selesaikanUnggahan(kode) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/unggahan/${kode}/selesai`)
  return skemaUnggahan.parse(respons.data)
}

/**
 * Unggah satu berkas secara berpotongan: buka sesi, kirim tiap potongan, gabung
 * di server. Kegagalan di tengah jalan tidak membuang potongan yang sudah
 * diterima — memanggil ulang dengan berkas yang sama akan mengirim ulang.
 *
 * @param {number} materiId
 * @param {File} berkas
 * @param {{onProgres?: (persen: number) => void}} [opsi]
 * @returns {Promise<DataUnggahan>}
 */
export async function unggahBerkas(materiId, berkas, opsi = {}) {
  const sesi = await mulaiUnggahan(materiId, { nama: berkas.name, ukuran: berkas.size })
  const potongan = potongBerkas(await berkas.arrayBuffer(), sesi.ukuran_potongan)

  for (let indeks = 0; indeks < potongan.length; indeks++) {
    await kirimPotongan(sesi.kode, indeks, potongan[indeks])
    opsi.onProgres?.(Math.round(((indeks + 1) / potongan.length) * 100))
  }

  return selesaikanUnggahan(sesi.kode)
}

/** Materi terbit untuk kelas murid. */
export async function materiSaya() {
  const respons = await client.get('/v1/materi-saya')
  return z
    .object({ materi: z.array(skemaMateriRingkas) })
    .parse(respons.data).materi
}

/** @param {number} materiId */
export async function progresMateri(materiId) {
  const respons = await client.get(`/v1/materi/${materiId}/progres`)
  return skemaRingkasanMateri.parse(respons.data)
}

/**
 * Buka satu blok. Blok kuis langsung mengembalikan attempt latihan dari server.
 * @param {number} materiId
 * @param {number} blockId
 */
export async function bukaBlok(materiId, blockId) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/materi/${materiId}/blok/${blockId}/buka`)
  return skemaBukaBlok.parse(respons.data)
}

/**
 * Tandai blok selesai (blok kuis hanya boleh setelah latihannya dikumpulkan).
 * @param {number} materiId
 * @param {number} blockId
 */
export async function selesaikanBlok(materiId, blockId) {
  await ambilCsrfCookie()
  const respons = await client.post(`/v1/materi/${materiId}/blok/${blockId}/selesai`)
  return z.object({ blok: skemaIsiBlok }).parse(respons.data).blok
}

/**
 * Laporan progres + pemahaman tema satu materi (guru).
 * @param {number} materiId
 */
export async function laporanMateri(materiId) {
  const respons = await client.get(`/v1/materi/${materiId}/laporan`)
  return skemaLaporanMateri.parse(respons.data)
}
