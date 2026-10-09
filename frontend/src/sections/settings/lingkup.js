/**
 * Pilihan lingkup pengaturan tiga lapis, sebagai logika murni (diuji Vitest).
 *
 * Keputusan siapa yang boleh menyentuh lapis mana diambil **server** (K-05):
 * lingkup sekolah/kelas hanya admin, lingkup kuis hanya pemilik kuisnya.
 * Berkas ini hanya menyusun pilihan yang memang boleh dikirim, supaya guru
 * tidak disuguhi tombol yang pasti ditolak 403.
 */

/** Nilai pilihan untuk lapis sekolah. */
export const LINGKUP_SEKOLAH = 'sekolah'

/**
 * @typedef {'sekolah' | 'kelas' | 'kuis'} JenisLingkup
 * @typedef {{ nilai: string, label: string }} PilihanLingkup
 * @typedef {{ lingkup: JenisLingkup, lingkupId: number|null, kelasId: number|null, kuisId: number|null }} LingkupTerpilih
 */

/** @param {number} id */
export function nilaiLingkupKelas(id) {
  return `kelas:${id}`
}

/** @param {number} id */
export function nilaiLingkupKuis(id) {
  return `kuis:${id}`
}

/**
 * Terjemahkan nilai `<select>` menjadi parameter API.
 *
 * Nilai yang tidak dikenali (atau id bukan bilangan positif) menghasilkan `null`
 * — pemanggil menampilkannya sebagai "belum memilih lingkup", bukan menebak.
 *
 * @param {string} nilai
 * @returns {LingkupTerpilih|null}
 */
export function bacaLingkup(nilai) {
  if (nilai === LINGKUP_SEKOLAH) {
    return { lingkup: 'sekolah', lingkupId: null, kelasId: null, kuisId: null }
  }

  const [jenis, angka] = String(nilai).split(':')
  const id = Number(angka)

  if (!Number.isInteger(id) || id <= 0) return null

  if (jenis === 'kelas') {
    return { lingkup: 'kelas', lingkupId: id, kelasId: id, kuisId: null }
  }

  if (jenis === 'kuis') {
    return { lingkup: 'kuis', lingkupId: id, kelasId: null, kuisId: id }
  }

  return null
}

/**
 * Daftar pilihan lingkup sesuai peran yang sedang masuk.
 *
 * Admin melihat ketiga lapis. Guru hanya melihat kuis **miliknya sendiri**
 * (daftar kuis guru memang sudah disaring server) — sekolah dan kelas berlaku
 * untuk seluruh sekolah, jadi ditetapkan admin.
 *
 * @param {{ sebagaiAdmin: boolean, daftarKelas?: Array<{ id: number, nama: string }>, daftarKuis?: Array<{ id: number, judul: string }> }} opsi
 * @returns {PilihanLingkup[]}
 */
export function pilihanLingkup({ sebagaiAdmin, daftarKelas = [], daftarKuis = [] }) {
  /** @type {PilihanLingkup[]} */
  const pilihan = []

  if (sebagaiAdmin) {
    pilihan.push({ nilai: LINGKUP_SEKOLAH, label: 'Sekolah (berlaku umum)' })

    for (const kelas of daftarKelas) {
      pilihan.push({ nilai: nilaiLingkupKelas(Number(kelas.id)), label: `Kelas ${kelas.nama}` })
    }
  }

  for (const kuis of daftarKuis) {
    pilihan.push({ nilai: nilaiLingkupKuis(Number(kuis.id)), label: `Kuis: ${kuis.judul}` })
  }

  return pilihan
}

/**
 * Lingkup awal yang dipilih: admin mulai dari sekolah, guru dari kuis pertamanya
 * (kosong bila guru belum punya kuis — halaman akan menampilkan petunjuk).
 *
 * @param {PilihanLingkup[]} pilihan
 * @param {boolean} sebagaiAdmin
 */
export function lingkupAwal(pilihan, sebagaiAdmin) {
  if (sebagaiAdmin && pilihan.some((p) => p.nilai === LINGKUP_SEKOLAH)) return LINGKUP_SEKOLAH

  return pilihan[0]?.nilai ?? ''
}
