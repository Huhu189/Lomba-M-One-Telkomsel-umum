/**
 * API laporan (slice 05): peringkat, laporan per tema (guru), badge per mapel,
 * dan progres tema murid. Semua respons divalidasi Zod; sesi murni cookie.
 */
import { z } from 'zod'
import { client } from '../../shared/api/client.js'

/**
 * URL unduh nilai kuis sebagai CSV (slice 10). Sesi cookie, jadi cukup dipakai
 * sebagai tautan biasa — tidak ada token di URL.
 *
 * @param {string|number} kuisId slug kuis (angka lama masih diterima server)
 * @returns {string}
 */
export function urlEksporNilai(kuisId) {
  return `/api/v1/kuis/${kuisId}/ekspor-nilai`
}

/**
 * Satu baris peringkat (hanya dari skor asli).
 *
 * Pada mode tim (slice 09-C) yang diurutkan adalah tim: `murid_id` null dan
 * `tim_nama` + `anggota` terisi. Pada mode individu kebalikannya.
 *
 * Perhatikan pembagian dua angka (14 Oktober 2026): `skor`/`persen` adalah
 * angka yang MEMANG DITAMPILKAN ke pemohonnya, sedangkan jejak bonus
 * (`bonus`, `skor_tampil`, `peringkat_asli`, `berbantuan`) hanya dikirim ke
 * guru. Bagi murid, papan peringkat memang cuma punya satu kebenaran: angka
 * yang dilihatnya. Karena itu kunci-kunci jejak bonus bersifat opsional di
 * skema ini — ketiadaannya di respons murid adalah bagian dari janji itu.
 */
export const skemaPeringkat = z.object({
  peringkat: z.number(),
  attempt_id: z.number(),
  murid_id: z.number().nullable(),
  tim_id: z.number().nullable(),
  tim_nama: z.string().nullable(),
  anggota: z.array(z.string()),
  nama: z.string(),
  skor: z.number(),
  skor_maksimal: z.number(),
  persen: z.number(),
  jumlah_benar: z.number(),
  jumlah_soal: z.number(),
  dikumpulkan_at: z.string().nullable(),
  // Jejak bonus: ada hanya bila pemohonnya guru.
  peringkat_asli: z.number().optional(),
  bonus: z.number().optional(),
  skor_tampil: z.number().optional(),
  persen_tampil: z.number().optional(),
  berbantuan: z.boolean().optional(),
})

/**
 * Baris milik pemohon sendiri (murid), dikirim walau nomor peringkatnya tidak
 * dibuka: skornya tetap miliknya, dan `di_luar_terbuka` menjelaskan mengapa
 * nomornya kosong — bukan layar tanpa jawaban.
 */
export const skemaDetailSaya = z.object({
  nama: z.string(),
  skor: z.number(),
  skor_maksimal: z.number(),
  persen: z.number(),
  peringkat: z.number().nullable(),
  di_luar_terbuka: z.boolean(),
  bonus: z.number().optional(),
  skor_tampil: z.number().optional(),
  persen_tampil: z.number().optional(),
  berbantuan: z.boolean().optional(),
})

/** Peringkat satu kuis + aturan keterlihatan & bonus yang sedang berlaku. */
export const skemaResponPeringkat = z.object({
  kuis_id: z.number(),
  judul_kuis: z.string(),
  mode_tim: z.boolean(),
  tampil: z.boolean(),
  guru: z.boolean(),
  total: z.number(),
  top: z.number(),
  // Aturan yang dipakai server saat menyusun respons ini — dibaca apa adanya
  // supaya halaman menjelaskan aturannya, bukan menebak.
  terbuka_persen: z.number(),
  terbuka_jumlah: z.number(),
  bonus_aktif: z.boolean(),
  bonus_bawah_persen: z.number(),
  bonus_maks_persen: z.number(),
  peringkat: z.array(skemaPeringkat),
  peringkat_saya: skemaPeringkat.nullable(),
  detail_saya: skemaDetailSaya.nullable(),
})

/** Pemahaman satu tema (tag). */
export const skemaTema = z.object({
  tag_id: z.number(),
  tag_nama: z.string(),
  jumlah_soal: z.number(),
  jumlah_benar: z.number(),
  persen: z.number(),
  tingkat: z.string(),
  tingkat_label: z.string(),
})

/** Lencana badge per mapel. */
export const skemaLencana = z.object({
  kode: z.string(),
  label: z.string(),
  level: z.number(),
})

/** Badge satu mapel. */
export const skemaBadgeMapel = z.object({
  mapel_id: z.number().nullable(),
  mapel_nama: z.string(),
  jumlah_ulangan: z.number(),
  rata_rata: z.number(),
  lencana: skemaLencana,
})

/** Kumpulan badge murid. */
export const skemaBadge = z.object({
  murid_id: z.number(),
  nama: z.string(),
  jumlah_lencana: z.number(),
  badge: z.array(skemaBadgeMapel),
})

/** Satu murid pada laporan guru. */
export const skemaBarisLaporan = z.object({
  murid_id: z.number(),
  nama: z.string(),
  jumlah_tema: z.number(),
  tema: z.array(skemaTema),
  ringkasan: z.record(z.string(), z.number()),
})

/** Laporan pemahaman per tema untuk satu kuis (guru). */
export const skemaLaporan = z.object({
  kuis_id: z.number(),
  judul_kuis: z.string(),
  mapel_nama: z.string().nullable(),
  kelas_nama: z.string().nullable(),
  ambang: z.object({
    ambang_paham: z.number(),
    ambang_mulai_paham: z.number(),
    data_minimum: z.number(),
  }),
  murid: z.array(skemaBarisLaporan),
})

/** Soal rekomendasi remedial (tanpa kunci). */
export const skemaSoalRemedial = z.object({
  id: z.number(),
  tipe: z.string(),
  tipe_label: z.string(),
  skor: z.number(),
  tag_id: z.number(),
  tag_nama: z.string().nullable(),
  teks: z.string(),
})

/** Progres tema + badge + remedial murid. */
export const skemaProgres = z.object({
  murid_id: z.number(),
  nama: z.string(),
  ambang: z.object({
    ambang_paham: z.number(),
    ambang_mulai_paham: z.number(),
    data_minimum: z.number(),
  }),
  tema: z.array(skemaTema),
  badge: skemaBadge,
  remedial: z.object({
    diaktifkan: z.boolean(),
    tema_lemah: z.array(skemaTema),
    soal: z.array(skemaSoalRemedial),
  }),
})

/**
 * @typedef {z.infer<typeof skemaResponPeringkat>} DataPeringkat
 * @typedef {z.infer<typeof skemaPeringkat>} DataBarisPeringkat
 * @typedef {z.infer<typeof skemaDetailSaya>} DataDetailSaya
 * @typedef {z.infer<typeof skemaLaporan>} DataLaporan
 * @typedef {z.infer<typeof skemaBarisLaporan>} DataBarisLaporan
 * @typedef {z.infer<typeof skemaTema>} DataTema
 * @typedef {z.infer<typeof skemaBadge>} DataBadge
 * @typedef {z.infer<typeof skemaBadgeMapel>} DataBadgeMapel
 * @typedef {z.infer<typeof skemaProgres>} DataProgres
 */

/**
 * @param {string|number} kuisId slug kuis (angka lama masih diterima server)
 * @param {number} [top]
 * @returns {Promise<DataPeringkat>}
 */
export async function ambilPeringkat(kuisId, top) {
  const respons = await client.get(`/v1/kuis/${kuisId}/ranking`, {
    params: top ? { top } : {},
  })
  return skemaResponPeringkat.parse(respons.data)
}

/**
 * @param {string|number} kuisId slug kuis (angka lama masih diterima server)
 * @returns {Promise<DataLaporan>}
 */
export async function ambilLaporanKuis(kuisId) {
  const respons = await client.get(`/v1/kuis/${kuisId}/laporan`)
  return skemaLaporan.parse(respons.data)
}

/** Satu baris hasil siswa tamu (mode tamu tanpa login). */
export const skemaTamuKuis = z.object({
  attempt_id: z.number(),
  murid_id: z.number(),
  nama: z.string(),
  jenis: z.string(),
  attempt_no: z.number(),
  asli: z.boolean(),
  status: z.string(),
  skor: z.number(),
  skor_maksimal: z.number(),
  persen: z.number(),
  jumlah_benar: z.number(),
  jumlah_soal: z.number(),
  mulai_at: z.string().nullable(),
  dikumpulkan_at: z.string().nullable(),
})

/** Hasil siswa tamu satu kuis + penanda apakah pintu tamunya masih terbuka. */
export const skemaLaporanTamu = z.object({
  kuis_id: z.number(),
  judul_kuis: z.string(),
  izin_tamu: z.boolean(),
  jumlah: z.number(),
  tamu: z.array(skemaTamuKuis),
})

/**
 * Hasil siswa tamu pada satu kuis (guru pemilik kuis). Laporan kelas biasa
 * tidak memuat tamu — mereka di luar kelas dan di luar ranking kelas.
 *
 * @param {string|number} kuisId slug kuis (angka lama masih diterima server)
 * @returns {Promise<z.infer<typeof skemaLaporanTamu>>}
 */
export async function ambilLaporanTamu(kuisId) {
  const respons = await client.get(`/v1/kuis/${kuisId}/tamu`)
  return skemaLaporanTamu.parse(respons.data)
}

/**
 * @returns {Promise<DataBadge>}
 */
export async function ambilBadgeSaya() {
  const respons = await client.get('/v1/badge/saya')
  return skemaBadge.parse(respons.data)
}

/**
 * @returns {Promise<DataProgres>}
 */
export async function ambilProgresSaya() {
  const respons = await client.get('/v1/progres/saya')
  return skemaProgres.parse(respons.data)
}
