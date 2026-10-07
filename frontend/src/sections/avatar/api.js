/**
 * API avatar & moderasi (slice 08).
 *
 * Dua hal yang sengaja ada di sisi klien:
 *
 * 1. **Penolakan awal gambar yang bukan JPEG/PNG/WebP** (termasuk SVG) dari magic
 *    bytes, supaya anak tidak menunggu unggahan selesai hanya untuk ditolak.
 *    Server tetap penentu akhir: ia mengulang pemeriksaan yang sama dari isi
 *    berkas, dan hasilnya yang berlaku.
 * 2. **Avatar bawaan berupa inisial nama**, dipakai saat murid belum pernah
 *    mengunggah (atau setelah avatarnya dihapus guru) — tidak perlu berkas gambar
 *    bawaan, dan tetap terbaca di layar kecil.
 */
import { z } from 'zod'
import { client, ambilCsrfCookie } from '../../shared/api/client.js'

/** Ukuran maksimal berkas avatar (byte) — cerminan `config/avatar.php`. */
export const UKURAN_MAKS = 2 * 1024 * 1024

/** Pilihan alasan laporan — cerminan `App\Sections\Avatar\Enums\AlasanLaporan`. */
export const ALASAN_LAPORAN = [
  { nilai: 'tidak_pantas', label: 'Gambar tidak pantas' },
  { nilai: 'bullying', label: 'Menyinggung teman' },
  { nilai: 'spam', label: 'Bukan foto asli / spam' },
  { nilai: 'lainnya', label: 'Alasan lain' },
]

/** Satu laporan avatar (bentuk guru). */
export const skemaLaporanAvatar = z.object({
  id: z.number(),
  alasan: z.string(),
  alasan_label: z.string(),
  keterangan: z.string().nullable(),
  status: z.string(),
  status_label: z.string(),
  pelapor_nama: z.string().nullable().optional(),
  dibuat_at: z.string().nullable().optional(),
})

/** Satu avatar seperti yang boleh dilihat pemanggil. */
export const skemaAvatar = z.object({
  id: z.number(),
  student_id: z.number(),
  nama_murid: z.string().nullable().optional(),
  kelas_nama: z.string().nullable().optional(),
  status: z.string(),
  status_label: z.string(),
  terlihat: z.boolean(),
  milik_saya: z.boolean(),
  url: z.string().nullable(),
  mime: z.string().optional(),
  lebar: z.number().optional(),
  tinggi: z.number().optional(),
  ukuran: z.number().optional(),
  ukuran_manusia: z.string().optional(),
  jumlah_laporan: z.number(),
  disembunyikan_at: z.string().nullable().optional(),
  dibuat_at: z.string().nullable().optional(),
  boleh_lapor: z.boolean().optional(),
  laporan: z.array(skemaLaporanAvatar).optional(),
})

/** Avatar sendiri + penanda apakah masih memakai avatar bawaan. */
export const skemaAvatarSaya = z.object({
  avatar: skemaAvatar.nullable(),
  bawaan: z.boolean(),
})

/** Daftar avatar sekelas (murid) atau seluruh sekolah (guru). */
export const skemaDaftarAvatar = z.object({
  avatar: z.array(skemaAvatar),
  murid_id: z.number().optional(),
})

/** Hasil mengirim laporan. */
export const skemaHasilLapor = z.object({
  message: z.string(),
  laporan: skemaLaporanAvatar,
  jumlah_laporan: z.number(),
  disembunyikan: z.boolean(),
})

/** @typedef {z.infer<typeof skemaAvatar>} DataAvatar */
/** @typedef {z.infer<typeof skemaLaporanAvatar>} DataLaporanAvatar */

/**
 * Jenis gambar menurut magic bytes — cerminan pemeriksaan server.
 *
 * SVG/XML/HTML tidak pernah lolos: berkas itu bisa memuat skrip, jadi klien pun
 * menolaknya lebih awal alih-alih mengirimnya ke server.
 *
 * @param {Uint8Array} isi
 * @returns {'jpeg'|'png'|'webp'|null}
 */
export function jenisGambarDariMagicBytes(isi) {
  const awal = isi.slice(0, 12)

  if (awal[0] === 0xff && awal[1] === 0xd8 && awal[2] === 0xff) return 'jpeg'
  if (awal[0] === 0x89 && awal[1] === 0x50 && awal[2] === 0x4e && awal[3] === 0x47) return 'png'

  const riff = String.fromCharCode(...awal.slice(0, 4))
  const webp = String.fromCharCode(...awal.slice(8, 12))

  if (awal.length >= 12 && riff === 'RIFF' && webp === 'WEBP') return 'webp'

  return null
}

/**
 * Inisial nama untuk avatar bawaan (maks 2 huruf).
 * @param {string|null|undefined} nama
 * @returns {string}
 */
export function inisialNama(nama) {
  const bagian = String(nama ?? '')
    .trim()
    .split(/\s+/)
    .filter((satu) => satu.length > 0)

  if (bagian.length === 0) return '?'

  const huruf = bagian
    .slice(0, 2)
    .map((satu) => /** @type {string} */ (satu[0]))
    .join('')

  return huruf.toUpperCase()
}

/**
 * Boleh tidaknya sebuah avatar ditampilkan ke pemakai lain.
 * @param {DataAvatar} avatar
 * @returns {boolean}
 */
export function terlihatUntukTeman(avatar) {
  return avatar.terlihat && !avatar.milik_saya
}

/**
 * Tolak berkas terlalu besar sebelum diunggah (server tetap memeriksa ulang).
 * @param {File|{size: number}|null|undefined} berkas
 * @returns {string|null} pesan galat, atau null bila lolos
 */
export function periksaBerkasAvatar(berkas) {
  if (!berkas || typeof berkas.size !== 'number') return 'Pilih berkas gambar dulu.'
  if (berkas.size <= 0) return 'Berkas gambar kosong.'
  if (berkas.size > UKURAN_MAKS) return 'Gambar terlalu besar (maksimal 2 MiB).'

  return null
}

/** Avatar sendiri (atau penanda `bawaan: true`). */
export async function avatarSaya() {
  const respons = await client.get('/v1/avatar/saya')
  return skemaAvatarSaya.parse(respons.data)
}

/** Daftar avatar sekelas (murid) atau seluruh sekolah (guru). */
export async function daftarAvatar() {
  const respons = await client.get('/v1/avatar')
  return skemaDaftarAvatar.parse(respons.data)
}

/**
 * Unggah (atau ganti) avatar sendiri. Berkas dikirim multipart — server yang
 * mengencode ulang ke ukuran tetap.
 * @param {File} berkas
 */
export async function unggahAvatar(berkas) {
  await ambilCsrfCookie()

  const bentuk = new FormData()
  bentuk.append('berkas', berkas)

  const respons = await client.post('/v1/avatar', bentuk)
  return skemaAvatar.parse(respons.data)
}

/** Kembalikan ke avatar bawaan. */
export async function kembalikanAvatarBawaan() {
  await ambilCsrfCookie()
  const respons = await client.delete('/v1/avatar')
  return z.object({ message: z.string(), bawaan: z.boolean() }).parse(respons.data)
}

/**
 * Laporkan avatar teman.
 * @param {number} avatarId
 * @param {string} alasan
 * @param {string} [keterangan]
 */
export async function laporAvatar(avatarId, alasan, keterangan = '') {
  await ambilCsrfCookie()

  const respons = await client.post(`/v1/avatar/${avatarId}/lapor`, {
    alasan,
    keterangan: keterangan.trim() === '' ? undefined : keterangan.trim(),
  })

  return skemaHasilLapor.parse(respons.data)
}

/** Antrean tinjau guru: avatar yang disembunyikan karena laporan. */
export async function antreanModerasi() {
  const respons = await client.get('/v1/avatar/moderasi')
  return z.array(skemaAvatar).parse(respons.data)
}

/**
 * Guru memulihkan avatar (kembali tampil untuk semua).
 * @param {number} avatarId
 * @param {string} [catatan]
 */
export async function pulihkanAvatar(avatarId, catatan = '') {
  await ambilCsrfCookie()

  const respons = await client.post(`/v1/avatar/${avatarId}/pulihkan`, {
    catatan: catatan.trim() === '' ? undefined : catatan.trim(),
  })

  return skemaAvatar.parse(respons.data)
}

/**
 * Guru menghapus avatar (berkas dibuang, keputusan dicatat di audit).
 * @param {number} avatarId
 * @param {string} [catatan]
 */
export async function hapusAvatarModerasi(avatarId, catatan = '') {
  await ambilCsrfCookie()

  const respons = await client.post(`/v1/avatar/${avatarId}/hapus`, {
    catatan: catatan.trim() === '' ? undefined : catatan.trim(),
  })

  return z.object({ message: z.string() }).parse(respons.data)
}
