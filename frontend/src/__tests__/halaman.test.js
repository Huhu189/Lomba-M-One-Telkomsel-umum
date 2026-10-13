/**
 * Pagar bundel per halaman.
 *
 * Yang dijaga di sini:
 * 1. Setiap halaman non-kerangka benar-benar komponen malas (`React.lazy`) —
 *    bukan impor statis yang kebetulan diekspor ulang.
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

/** Simbol yang dipasang `React.lazy` pada setiap komponennya. */
const SIMBOL_MALAS = Symbol.for('react.lazy')

/** Jalur halaman tetap yang tautannya ada di menu (jadi layak dipramuat). */
const jalurMenu = [
  RUTE.pengaturan,
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
  'HalamanAturUlangSandi',
  'HalamanVerifikasiEmail',
  'HalamanPerluVerifikasi',
  'HalamanAkun',
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
  it('setiap halaman non-kerangka berupa komponen malas', () => {
    for (const nama of halamanMalas) {
      const komponen = /** @type {Record<string, unknown>} */ (halaman)[nama]
      expect(komponen, `${nama} diekspor`).toBeDefined()
      // `React.lazy` menandai komponennya dengan simbol ini; impor statis tidak.
      expect(
        /** @type {{ $$typeof?: symbol }} */ (komponen).$$typeof,
        `${nama} seharusnya React.lazy`,
      ).toBe(SIMBOL_MALAS)
    }
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
})

describe('bundel awal App.jsx', () => {
  const app = String(
    import.meta.glob('../App.jsx', { query: '?raw', import: 'default', eager: true })['../App.jsx'],
  )

  it('hanya kerangka, beranda, halaman masuk, dan 404 yang diimpor statis', () => {
    const statis = [...app.matchAll(/^import\s+\w+\s+from\s+'(\.\/sections\/[^']+)'/gm)].map((m) => m[1])

    expect(statis).toEqual([
      './sections/home/Beranda.jsx',
      './sections/home/HalamanTidakDitemukan.jsx',
      './sections/auth/HalamanMasuk.jsx',
      './sections/attempt/BatasGalatUlangan.jsx',
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
