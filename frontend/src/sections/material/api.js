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
import {
  skemaKonfigurasiTema,
  skemaPerjalanan,
  skemaTemaKatalog,
  skemaTemaMateri,
} from './perjalanan.js'

/** Satu berkas materi yang sudah selesai diunggah. */
export const skemaUnggahan = z.object({
  kode: z.string(),
  nama_asli: z.string(),
  ekstensi: z.string(),
  mime: z.string(),
  kategori: z.string(),
  kategori_label: z.string(),
  tampil_langsung: z.boolean(),
  // 'semat' | 'dokumen' | 'unduh' — lihat sections/material/sajianBerkas.js.
  sajian: z.string().optional(),
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
  // Sumber kedua klip media: tautan https yang diselipkan guru (YouTube/Drive/
  // berkas langsung) — lihat sections/material/tautanMedia.js.
  tautan: z.string().nullable().optional(),
  keterangan: z.string().nullable().optional(),
  quiz_id: z.number().nullable().optional(),
  // Penempatan klip di timeline editor (gaya video editor).
  track: z.number().optional(),
  mulai_detik: z.number().optional(),
  durasi_detik: z.number().optional(),
  // Media: fit/fokus_x/fokus_y/zoom. Kuis: mode/tata.
  tampilan: z.record(z.string(), z.union([z.string(), z.number()])).nullable().optional(),
  // Nama pos perjalanan yang diganti guru (kosong = bawaan tema).
  fase: z.string().nullable().optional(),
  // Penjelasan opsional setelah kuis (blok kuis saja): teks + kode media.
  penjelasan: z
    .object({
      teks: z.string(),
      unggahan_kode: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
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
  // Tema perjalanan: pilihan guru + konfigurasi lengkap (nama pos & tingkat).
  tema: skemaTemaMateri.nullable().optional(),
  perjalanan: skemaKonfigurasiTema.optional(),
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
  // Penempatan timeline + pengaturan tampilan (media: fit/fokus/zoom; kuis: mode/tata).
  mulai_detik: z.number().optional(),
  durasi_detik: z.number().optional(),
  tampilan: z.record(z.string(), z.union([z.string(), z.number()])).nullable().optional(),
  // Kuis yang tayang di dalam video: id blok video tuannya.
  host_id: z.number().nullable().optional(),
  // Penjelasan guru yang tampil SESUDAH kuis selesai (blok kuis, opsional).
  penjelasan: z
    .object({
      teks: z.string(),
      media: z
        .object({
          kode: z.string(),
          nama: z.string().optional(),
          kategori: z.string().optional(),
          kategori_label: z.string().optional(),
          tampil_langsung: z.boolean().optional(),
          sajian: z.string().optional(),
          mime: z.string().optional(),
          ukuran_manusia: z.string().optional(),
          url: z.string().optional(),
          tersedia: z.boolean().optional(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  // Pertimbangan server (aturan urutan berbasis timeline); klien hanya menampilkan.
  boleh_dibuka: z.boolean().optional(),
})

/** Satu baris ringkasan soal sesudah kuis sisipan (kunci sudah berupa rangkuman teks). */
export const skemaBarisRingkasan = z.object({
  question_id: z.number(),
  nomor: z.number(),
  tipe: z.string(),
  tipe_label: z.string(),
  teks: z.string(),
  terjawab: z.boolean(),
  benar: z.boolean().nullable(),
  skor: z.number(),
  skor_maksimal: z.number(),
  jawaban_benar: z.string().nullable(),
  pembahasan: z.string().nullable(),
})

/** Kartu ingat (flashcard) dari soal kuis sisipan. */
export const skemaKartuIngat = z.object({
  question_id: z.number(),
  nomor: z.number(),
  depan: z.string(),
  belakang: z.string().nullable(),
  catatan: z.string().nullable(),
  benar: z.boolean().nullable(),
})

/** Papan peringkat LATIHAN (terpisah dari ranking resmi ulangan). */
export const skemaPapanLatihan = z.object({
  skor_maksimal: z.number(),
  peserta: z.number(),
  teratas: z.array(
    z.object({ peringkat: z.number(), nama: z.string(), skor: z.number(), saya: z.boolean() }),
  ),
  saya: z
    .object({ peringkat: z.number(), nama: z.string(), skor: z.number(), saya: z.boolean() })
    .nullable()
    .optional(),
})

/** Layar sesudah kuis sisipan: bagian yang dikirim mengikuti saklar guru. */
export const skemaRingkasanKuis = z.object({
  opsi: z.object({ ringkasan: z.boolean(), kartu: z.boolean(), papan: z.boolean() }),
  soal: z.array(skemaBarisRingkasan).optional(),
  kartu: z.array(skemaKartuIngat).optional(),
  papan: skemaPapanLatihan.optional(),
})

/** Katalog tema perjalanan dari server (GET /materi/tema). */
export const skemaKatalogTema = z.object({
  tema: z.array(skemaTemaKatalog),
  bawaan: z.string(),
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
  // Peta perjalanan (tema + pos yang sudah dilewati) untuk layar murid.
  perjalanan: skemaPerjalanan,
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
      sajian: z.string().optional(),
      mime: z.string().nullable().optional(),
      ukuran: z.number().nullable().optional(),
      ukuran_manusia: z.string().nullable().optional(),
      url: z.string().optional(),
      // 'unggahan' (berkas milik materi) atau 'tautan' (alamat luar).
      sumber: z.string().optional(),
      jenis: z.string().optional(),
      // Alamat bingkai resmi (youtube-nocookie/Drive) yang dihitung SERVER; null
      // untuk berkas unggahan dan berkas tautan langsung.
      sematan: z.string().nullable().optional(),
      tersedia: z.boolean().optional(),
      tampilan: z.record(z.string(), z.union([z.string(), z.number()])).nullable().optional(),
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
  // Peta perjalanan kelas: nama pos sesungguhnya (termasuk yang diganti guru).
  perjalanan: z.object({
    kode: z.string(),
    nama: z.string(),
    // `true` = materi tanpa peta (daftar bagian biasa).
    tanpa: z.boolean(),
    adegan: z.string(),
    satuan: z.string(),
    video_kode: z.string().nullable(),
    langkah: z.array(
      z.object({
        block_id: z.number(),
        nomor: z.number(),
        nama: z.string(),
        ikon: z.string(),
        warna: z.string(),
        bawaan: z.string().optional(),
        wajib: z.boolean(),
      }),
    ),
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
      perjalanan: z.object({
        posisi: z.number(),
        selesai: z.number(),
        total: z.number(),
        persen: z.number(),
        tuntas: z.boolean(),
        tingkat_nomor: z.number(),
        tingkat_nama: z.string(),
        puncak: z.boolean(),
        langkah_aktif: z.string().nullable(),
      }),
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
 * Hasil membuang berkas pustaka: berapa rujukan yang ikut dibersihkan server.
 *
 * Angka-angka ini yang membuat guru tahu dampaknya (klip media hilang, media
 * penjelasan dilepas, latar tema kembali ke animasi bawaan) — bukan cuma
 * "berhasil" tanpa penjelasan.
 */
export const skemaHasilBuangBerkas = z.object({
  message: z.string().optional(),
  klip: z.number(),
  penjelasan: z.number(),
  tema: z.number(),
})

/**
 * @typedef {z.infer<typeof skemaMateri>} DataMateri
 * @typedef {z.infer<typeof skemaUnggahan>} DataUnggahan
 * @typedef {z.infer<typeof skemaHasilBuangBerkas>} DataHasilBuangBerkas
 * @typedef {z.infer<typeof skemaRingkasanMateri>} DataRingkasanMateri
 * @typedef {z.infer<typeof skemaIsiBlok>} DataIsiBlok
 * @typedef {z.infer<typeof skemaLaporanMateri>} DataLaporanMateri
 * @typedef {z.infer<typeof skemaKatalogTema>} DataKatalogTema
 * @typedef {{
 *   judul: string,
 *   deskripsi?: string,
 *   subject_id: number,
 *   class_id: number,
 *   tag_id?: number|null,
 * }} MuatanMateri
 * @typedef {{
 *   kode?: string,
 *   nama?: string,
 *   video_kode?: string|null,
 * }} MuatanTema
 * @typedef {{
 *   tipe: 'teks'|'media'|'kuis',
 *   wajib: boolean,
 *   isi?: Record<string, unknown>, // kuis: `{penjelasan: {teks, unggahan_kode}}`
 *   fase?: string,
 *   quiz_id?: number|null,
 *   track?: number,
 *   mulai_detik?: number,
 *   durasi_detik?: number,
 *   tampilan?: Record<string, string|number>,
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
  // Urutan tayang = timeline; kuis yang tayang di dalam video bukan "bagian"
  // tersendiri (diputar dari pemutar videonya).
  const blok = [...(ringkasan?.blok ?? [])]
    .filter((satu) => satu.host_id == null)
    .sort((a, b) => (a.mulai_detik ?? 0) - (b.mulai_detik ?? 0) || a.urutan - b.urutan)
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
  // Server sudah menghitung dengan aturan urutan timeline; pakai bila ada.
  if (typeof blok.boleh_dibuka === 'boolean') return blok.boleh_dibuka

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
 * @param {MuatanTema} [tema] tema perjalanan (nama ganti + video latar)
 */
export async function sinkronBlok(id, blok, tema) {
  await ambilCsrfCookie()

  /** @type {Record<string, unknown>} */
  const muatan = { blok }

  if (tema) muatan.tema = tema

  const respons = await client.put(`/v1/materi/${id}/blok`, muatan)
  return skemaMateri.parse(respons.data)
}

/**
 * Katalog template tema perjalanan (untuk panel Template di editor).
 *
 * Diambil dari server supaya nama fase/tingkat hanya punya satu sumber
 * kebenaran; editor tidak menyalin daftarnya sendiri.
 */
export async function ambilTemaMateri() {
  const respons = await client.get('/v1/materi/tema')
  return skemaKatalogTema.parse(respons.data)
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
 * Buang satu berkas dari pustaka materi.
 *
 * Server sekaligus membersihkan rujukan berkas itu (klip media, media
 * penjelasan, video latar tema), dan jumlahnya dibalas supaya editor bisa
 * melaporkan apa yang berubah kepada guru.
 *
 * @param {string} kode
 * @returns {Promise<import('zod').infer<typeof skemaHasilBuangBerkas>>}
 */
export async function hapusUnggahan(kode) {
  await ambilCsrfCookie()
  const respons = await client.delete(`/v1/unggahan/${kode}`)
  return skemaHasilBuangBerkas.parse(respons.data)
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
 * Ringkasan soal, kartu ingat, dan papan latihan sesudah kuis sisipan
 * dikumpulkan. Server menolak (422) sebelum dikumpulkan dan 404 bila guru tidak
 * membukanya.
 *
 * @param {number} materiId
 * @param {number} blockId
 * @returns {Promise<z.infer<typeof skemaRingkasanKuis>>}
 */
export async function ambilRingkasanKuis(materiId, blockId) {
  const respons = await client.get(`/v1/materi/${materiId}/blok/${blockId}/ringkasan-kuis`)
  return skemaRingkasanKuis.parse(respons.data)
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
