/**
 * Cara sebuah berkas materi/lampiran disajikan (cermin `KategoriBerkas` di
 * server, 14 Oktober 2026).
 *
 * Empat golongan, dan bedanya penting bagi guru SD:
 *
 * - `semat` — benar-benar tampil di dalam halaman (gambar, video, suara, PDF).
 * - `dokumen` — Word/PowerPoint/Excel. Peramban desktop **tidak bisa** merender
 *   berkas ini, jadi tombol "Unduh" akan menyesatkan; yang benar tombol "Buka
 *   dokumen" yang membukanya di tab/aplikasi dokumen dengan nama & tipe aslinya.
 * - `unduh` — arsip & berkas tak dikenal: memang harus diunduh (`.upload`).
 * - `tautan` — alamat luar yang hanya bisa dibuka (bukan berkas milik server).
 *
 * Nilai `sajian` dikirim server. Fungsi di bawah tetap punya cadangan dari
 * `tampil_langsung` supaya halaman tidak menampilkan tombol yang salah bila
 * klien dan server sempat berbeda versi saat penerapan.
 */

/** Nilai `sajian` yang dikenali klien. */
export const SAJIAN = ['semat', 'dokumen', 'unduh', 'tautan']

/**
 * Sajian satu berkas: pakai `sajian` dari server, atau turunkan dari
 * `tampil_langsung` bila server belum mengirimnya.
 *
 * @param {{ sajian?: string|null, tampil_langsung?: boolean|null }|null|undefined} berkas
 * @returns {'semat'|'dokumen'|'unduh'|'tautan'}
 */
export function sajianBerkas(berkas) {
  if (berkas === null || berkas === undefined) return 'unduh'

  if (typeof berkas.sajian === 'string' && SAJIAN.includes(berkas.sajian)) {
    return /** @type {'semat'|'dokumen'|'unduh'|'tautan'} */ (berkas.sajian)
  }

  return berkas.tampil_langsung === true ? 'semat' : 'unduh'
}

/**
 * Nama jenis dokumen kantor untuk tombol & keterangan guru: "Word",
 * "PowerPoint", "Excel", atau "Dokumen".
 *
 * Dibaca dari mime lebih dulu (server sudah menetapkannya dari ISI berkas),
 * lalu dari ekstensi sebagai cadangan.
 *
 * @param {{ mime?: string|null, ekstensi?: string|null, nama?: string|null, nama_asli?: string|null }} berkas
 * @returns {string}
 */
export function labelDokumen(berkas) {
  const mime = berkas?.mime ?? ''

  if (mime.includes('wordprocessingml')) return 'Word'
  if (mime.includes('presentationml')) return 'PowerPoint'
  if (mime.includes('spreadsheetml')) return 'Excel'

  const nama = `${berkas?.nama ?? berkas?.nama_asli ?? ''}`.toLowerCase()

  if (nama.endsWith('.docx')) return 'Word'
  if (nama.endsWith('.pptx')) return 'PowerPoint'
  if (nama.endsWith('.xlsx')) return 'Excel'

  return 'Dokumen'
}

/**
 * Nama berkas yang ditampilkan ke murid: nama asli bila ada, atau kode unggahan.
 *
 * @param {{ nama?: string|null, nama_asli?: string|null, kode?: string|null }} berkas
 * @returns {string}
 */
export function namaBerkas(berkas) {
  return berkas?.nama ?? berkas?.nama_asli ?? berkas?.kode ?? 'berkas'
}
