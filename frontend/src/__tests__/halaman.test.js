/**
 * Pagar bundel per halaman.
 *
 * Yang dijaga di sini:
 * 1. Setiap halaman non-kerangka benar-benar dibungkus `MalasHalaman` dan
 *    membawa pemuat modulnya sendiri — bukan impor statis yang kebetulan
 *    diekspor ulang, dan bukan pemuat yang sama dipakai dua halaman karena
 *    salah tempel.
 * 2. Peta pramuat menu hanya berisi jalur tetap dan cocok dengan tautan menu
 *    (rute berparameter/jalur asing TIDAK ikut, supaya tidak ada modul yang
 *    diunduh hanya karena jalurnya mirip).
 * 3. `App.jsx` tidak diam-diam mengimpor halaman berat secara statis lagi. Itu
 *    kesalahan yang paling mudah terulang: satu baris `import` statis sudah
 *    cukup untuk mengembalikan seluruh kode ke bundel awal, dan tidak ada satu
 *    pun halaman yang tampak rusak — jadi hanya tes ini yang bisa menangkapnya.
 */
import { describe, expect, it } from 'vitest'
import * as halaman from '../halaman.js'
import { pemuatHalaman } from '../halaman.js'
import { RUTE } from '../routes.js'

/**
 * Setiap komponen rute membawa pemuat modulnya (ditempelkan `malas()` di
 * `halaman.js`). Itulah yang membuat tes ini bisa membedakan halaman yang benar
 * dipecah per berkas dari halaman yang ikut bundel awal.
 *
 * Kenapa bukan lagi penanda `React.lazy`: sejak 14 Okt 2026 pembungkusnya
 * `MalasHalaman`, dan itu memang tujuan perbaikannya — `lazy` menyimpan hasil
 * impornya selamanya, jadi satu kegagalan unduh (koneksi murid putus tepat saat
 * ia menekan menu) membuat rutenya menolak selamanya dan menutup SELURUH
 * aplikasi, termasuk ulangan yang sedang dikerjakan.
 */
/** @param {unknown} komponen */
const pemuatHalamanDari = (komponen) => /** @type {Record<string, unknown>} */ (komponen).pemuat

/** Jalur halaman tetap yang tautannya ada di menu (jadi layak dipramuat). */
const jalurMenu = [
  RUTE.pengaturan,
  RUTE.adminAkun,
  RUTE.kelas,
  RUTE.mapel,
  RUTE.murid,
  RUTE.imporMurid,
  RUTE.bankSoal,
  RUTE.tag,
  RUTE.kuis,
  RUTE.materi,
  RUTE.avatar,
  RUTE.badge,
  RUTE.progresTema,
]

/** Semua halaman yang harus berupa potongan bundel sendiri. */
const halamanMalas = [
  'HalamanDaftar',
  'HalamanLupaSandi',
  // Pintu siswa tamu di halamannya sendiri (15 Oktober 2026).
  'HalamanMasukTamu',
  'HalamanAturUlangSandi',
  // Lapisan wajib-buat-sandi akun Google (14 Oktober 2026).
  'HalamanBuatSandi',
  'HalamanVerifikasiEmail',
  'HalamanPerluVerifikasi',
  'HalamanAkun',
  'HalamanAkunSekolah',
  'HalamanKelas',
  'HalamanMapel',
  'HalamanMurid',
  'HalamanImporMurid',
  'HalamanBankSoal',
  'HalamanTag',
  'PilihHalamanKuis',
  'HalamanKuisDetail',
  'HalamanKerjakan',
  'HalamanHasil',
  'HalamanTim',
  'HalamanPeringkat',
  'HalamanLaporan',
  'HalamanBadge',
  'HalamanProgresTema',
  'HalamanKoreksi',
  'HalamanMonitor',
  'HalamanLayar',
  'PilihHalamanMateri',
  'EditorMateri',
  'PilihHalamanAvatar',
]

describe('halaman malas', () => {
  it('setiap halaman non-kerangka dibungkus pembungkus malas', () => {
    for (const nama of halamanMalas) {
      const komponen = /** @type {Record<string, unknown>} */ (halaman)[nama]
      expect(komponen, `${nama} diekspor`).toBeDefined()
      // Komponen rute bisa dipanggil DAN membawa pemuat modulnya; impor statis
      // yang kebetulan diekspor ulang tidak punya properti ini.
      expect(typeof komponen, `${nama} komponen`).toBe('function')
      expect(typeof pemuatHalamanDari(komponen), `${nama} punya pemuat modul`).toBe('function')
    }
  })

  it('setiap halaman punya pemuatnya sendiri (tidak salah tempel)', () => {
    const pemuat = halamanMalas.map((nama) => pemuatHalamanDari(/** @type {Record<string, unknown>} */ (halaman)[nama]))

    expect(new Set(pemuat).size).toBe(halamanMalas.length)
  })

  it('pemuat halaman hanyalah impor dinamis, bukan impor statis', () => {
    // Pagar bundel: kalau salah satu pemuat diubah jadi impor statis di atas
    // berkas, halaman itu ikut bundel awal tanpa ada tampilan yang rusak — hanya
    // tes ini yang bisa menangkapnya.
    const sumber = String(
      import.meta.glob('../halaman.js', { query: '?raw', import: 'default', eager: true })['../halaman.js'],
    )

    expect([...sumber.matchAll(/\(\) => import\('\.\/sections\//g)]).toHaveLength(halamanMalas.length)
    expect(sumber).not.toMatch(/^import .* from '\.\/sections\//m)
  })
})

describe('peta pramuat menu', () => {
  it('setiap tautan halaman tetap punya pemuat modulnya', () => {
    for (const jalur of jalurMenu) {
      expect(typeof pemuatHalaman(jalur), `pemuat untuk ${jalur}`).toBe('function')
    }
  })

  it('rute berparameter dan jalur asing tidak dipramuat', () => {
    expect(pemuatHalaman(RUTE.kuisDetail)).toBeNull()
    expect(pemuatHalaman('/kuis/unu5k')).toBeNull()
    expect(pemuatHalaman('/kerjakan/12')).toBeNull()
    expect(pemuatHalaman('/hasil/3')).toBeNull()
    expect(pemuatHalaman('/entah')).toBeNull()
    expect(pemuatHalaman('')).toBeNull()
  })

  it('beranda dan halaman auth tidak dipramuat dari menu', () => {
    // Beranda ikut bundel awal (halaman pertama semua orang), sedangkan halaman
    // auth tidak punya tautan menu yang bisa disorot — keduanya null, bukan
    // pemuat yang salah tempat.
    expect(pemuatHalaman(RUTE.beranda)).toBeNull()
    expect(pemuatHalaman(RUTE.daftar)).toBeNull()
    expect(pemuatHalaman(RUTE.lupaSandi)).toBeNull()
  })

  it('rute panel admin tidak tertukar dengan halaman lain', () => {
    // `/admin/akun` tidak boleh disorot oleh pemuat halaman mana pun selain
    // miliknya; pemeriksaan ini menangkap salah tempel peta pramuat.
    expect(pemuatHalaman(RUTE.adminAkun)).not.toBe(pemuatHalaman(RUTE.pengaturan))
    expect(pemuatHalaman(RUTE.adminAkun)).not.toBe(pemuatHalaman(RUTE.murid))
    expect(pemuatHalaman('/admin')).toBeNull()
    expect(pemuatHalaman('/admin/lain')).toBeNull()
  })
})

describe('bundel awal App.jsx', () => {
  const app = String(
    import.meta.glob('../App.jsx', { query: '?raw', import: 'default', eager: true })['../App.jsx'],
  )

  it('hanya kerangka, beranda, halaman masuk, dan 404 yang diimpor statis', () => {
    const statis = [...app.matchAll(/^import\s+\w+\s+from\s+'(\.\/sections\/[^']+)'/gm)].map((m) => m[1])

    expect(statis).toEqual([
      './sections/home/halaman/Beranda.jsx',
      './sections/home/halaman/HalamanTidakDitemukan.jsx',
      './sections/auth/halaman/HalamanMasuk.jsx',
      './sections/attempt/komponen/BatasGalatUlangan.jsx',
    ])
  })

  it('halaman sisanya masuk lewat daftar malas, bukan impor langsung', () => {
    // Semua komponen halaman yang dipakai router harus berasal dari `halaman.js`.
    expect(app).toContain("from './halaman.js'")
    for (const nama of ['HalamanKerjakan', 'EditorMateri', 'HalamanMonitor', 'HalamanKoreksi']) {
      expect(app).toContain(`  ${nama},\n`)
    }
  })
})
