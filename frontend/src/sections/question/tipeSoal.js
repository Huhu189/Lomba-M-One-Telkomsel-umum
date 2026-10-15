/**
 * Registry tipe soal sisi klien — cermin App\Sections\Question\Enums\TipeSoal
 * dan RegistryTipeSoal di backend.
 *
 * Delapan tipe soal sudah bisa disimpan: enam objektif (pilihan ganda,
 * benar/salah, menjodohkan, mengurutkan, letak kata, hubung kata) dan dua
 * bertingkat (isian singkat, uraian) yang dinilai lewat kata kunci lalu bisa
 * dikoreksi guru pada antrean koreksi manual.
 */

import {
  IkonJam,
  IkonTipeBenarSalah,
  IkonTipeBenarSalahMajemuk,
  IkonTipeGarisBilangan,
  IkonTipeHotspotGambar,
  IkonTipeHubungKata,
  IkonTipeIsianAngka,
  IkonTipeIsianRumpang,
  IkonTipeIsianSingkat,
  IkonTipeKlasifikasi,
  IkonTipeLetakKata,
  IkonTipeMenjodohkan,
  IkonTipeMengurutkan,
  IkonTipePilihanGambar,
  IkonTipePilihanGanda,
  IkonTipePilihanGandaKompleks,
  IkonTipeSusunHuruf,
  IkonTipeTabelIsian,
  IkonTipeTekaSilangMini,
  IkonTipeTugasUnggah,
  IkonTipeUraian,
  IkonTipeUrutGambar,
} from '../../icons.jsx'
import {
  teknikKoreksiBawaan,
  teknikKoreksiDariState,
  teknikKoreksiSah,
} from './teknikKoreksi.js'

/** Nilai tipe soal — harus sama persis dengan enum backend. */
export const TIPE = {
  pilihanGanda: 'pilihan_ganda',
  benarSalah: 'benar_salah',
  isianSingkat: 'isian_singkat',
  uraian: 'uraian',
  menjodohkan: 'menjodohkan',
  mengurutkan: 'mengurutkan',
  letakKata: 'letak_kata',
  hubungKata: 'hubung_kata',
  pilihanGandaKompleks: 'pilihan_ganda_kompleks',
  benarSalahMajemuk: 'benar_salah_majemuk',
  isianAngka: 'isian_angka',
  pilihanGambar: 'pilihan_gambar',
  urutGambar: 'urut_gambar',
  susunHuruf: 'susun_huruf',
  isianRumpang: 'isian_rumpang',
  klasifikasi: 'klasifikasi',
  tabelIsian: 'tabel_isian',
  garisBilangan: 'garis_bilangan',
  hotspotGambar: 'hotspot_gambar',
  bacaJam: 'baca_jam',
  tugasUnggah: 'tugas_unggah',
  tekaSilangMini: 'teka_silang_mini',
}

/** @type {Record<string, string>} */
export const LABEL_TIPE = {
  [TIPE.pilihanGanda]: 'Pilihan ganda',
  [TIPE.benarSalah]: 'Benar / salah',
  [TIPE.isianSingkat]: 'Isian singkat',
  [TIPE.uraian]: 'Uraian',
  [TIPE.menjodohkan]: 'Menjodohkan',
  [TIPE.mengurutkan]: 'Mengurutkan',
  [TIPE.letakKata]: 'Letak kata',
  [TIPE.hubungKata]: 'Hubung kata',
  [TIPE.pilihanGandaKompleks]: 'Pilihan ganda kompleks',
  [TIPE.benarSalahMajemuk]: 'Benar / salah majemuk',
  [TIPE.isianAngka]: 'Isian angka',
  [TIPE.pilihanGambar]: 'Pilihan gambar',
  [TIPE.urutGambar]: 'Urut gambar',
  [TIPE.susunHuruf]: 'Susun huruf',
  [TIPE.isianRumpang]: 'Isian rumpang',
  [TIPE.klasifikasi]: 'Klasifikasi',
  [TIPE.tabelIsian]: 'Tabel isian',
  [TIPE.garisBilangan]: 'Garis bilangan',
  [TIPE.hotspotGambar]: 'Hotspot gambar',
  [TIPE.bacaJam]: 'Baca jam',
  [TIPE.tugasUnggah]: 'Tugas unggah',
  [TIPE.tekaSilangMini]: 'Teka silang mini',
}

/** Tipe yang dinilai pasti (soal objektif) — cermin TipeSoal::objektif(). */
export const TIPE_OBJEKTIF = [
  TIPE.pilihanGanda,
  TIPE.benarSalah,
  TIPE.menjodohkan,
  TIPE.mengurutkan,
  TIPE.letakKata,
  TIPE.hubungKata,
  TIPE.pilihanGandaKompleks,
  TIPE.benarSalahMajemuk,
  TIPE.isianAngka,
  TIPE.pilihanGambar,
  TIPE.urutGambar,
  TIPE.susunHuruf,
  TIPE.isianRumpang,
  TIPE.klasifikasi,
  TIPE.tabelIsian,
  TIPE.garisBilangan,
  TIPE.hotspotGambar,
  TIPE.bacaJam,
  TIPE.tekaSilangMini,
]

/** Tipe bertingkat: dinilai kata kunci, sisanya menunggu koreksi guru. */
export const TIPE_BERTINGKAT = [TIPE.isianSingkat, TIPE.uraian, TIPE.tugasUnggah]

/**
 * Tipe yang pertanyaannya bukan `konten.teks` (gambar, atau petunjuk susun
 * huruf), sehingga isi soal boleh kosong di editor.
 */
export const TIPE_TANPA_TEKS = [TIPE.pilihanGambar, TIPE.urutGambar, TIPE.susunHuruf]

/**
 * Ikon petak per jenis soal. Dipakai pemilih jenis ringkas di editor bank soal
 * (semua tipe tampil sekaligus sebagai petak berikon) dan sekaligus menjadi
 * penanda tipe di daftar. Kuncinya sama dengan nilai `TIPE`.
 * @type {Record<string, import('react').ComponentType<{ size?: number, className?: string }>>}
 */
export const IKON_TIPE = {
  [TIPE.pilihanGanda]: IkonTipePilihanGanda,
  [TIPE.benarSalah]: IkonTipeBenarSalah,
  [TIPE.isianSingkat]: IkonTipeIsianSingkat,
  [TIPE.uraian]: IkonTipeUraian,
  [TIPE.menjodohkan]: IkonTipeMenjodohkan,
  [TIPE.mengurutkan]: IkonTipeMengurutkan,
  [TIPE.letakKata]: IkonTipeLetakKata,
  [TIPE.hubungKata]: IkonTipeHubungKata,
  [TIPE.pilihanGandaKompleks]: IkonTipePilihanGandaKompleks,
  [TIPE.benarSalahMajemuk]: IkonTipeBenarSalahMajemuk,
  [TIPE.isianAngka]: IkonTipeIsianAngka,
  [TIPE.pilihanGambar]: IkonTipePilihanGambar,
  [TIPE.urutGambar]: IkonTipeUrutGambar,
  [TIPE.susunHuruf]: IkonTipeSusunHuruf,
  [TIPE.isianRumpang]: IkonTipeIsianRumpang,
  [TIPE.klasifikasi]: IkonTipeKlasifikasi,
  [TIPE.tabelIsian]: IkonTipeTabelIsian,
  [TIPE.garisBilangan]: IkonTipeGarisBilangan,
  [TIPE.hotspotGambar]: IkonTipeHotspotGambar,
  [TIPE.bacaJam]: IkonJam,
  [TIPE.tugasUnggah]: IkonTipeTugasUnggah,
  [TIPE.tekaSilangMini]: IkonTipeTekaSilangMini,
}

/**
 * Ikon satu jenis soal; `undefined` bila tipenya belum dikenal.
 * @param {string} nilai
 * @returns {import('react').ComponentType<{ size?: number, className?: string }>|undefined}
 */
export function ikonTipe(nilai) {
  return IKON_TIPE[nilai]
}

/** @typedef {{ nilai: string, label: string, objektif: boolean, ikon?: import('react').ComponentType<{ size?: number, className?: string }> }} BarisTipe */

/** Isi <select> tipe soal pada editor dan sumber pemilih jenis ringkas. */
/** @type {BarisTipe[]} */
export const DAFTAR_TIPE = Object.keys(LABEL_TIPE).map((nilai) => ({
  nilai,
  label: LABEL_TIPE[nilai],
  objektif: TIPE_OBJEKTIF.includes(nilai),
  ikon: IKON_TIPE[nilai],
}))

/** Batas opsi pilihan ganda (cermin PenanganPilihanGanda). */
export const MIN_OPSI = 2
export const MAKS_OPSI = 6

/** Minimal pasangan menjodohkan / item mengurutkan / kata & posisi letak kata. */
export const MIN_ITEM = 2

/** Batas pilihan ganda kompleks (cermin PenanganPilihanGandaKompleks). */
export const MIN_OPSI_KOMPLEKS = 3
export const MAKS_OPSI_KOMPLEKS = 8

/** Batas pernyataan benar/salah majemuk (cermin PenanganBenarSalahMajemuk). */
export const MIN_PERNYATAAN = 2
export const MAKS_PERNYATAAN = 8

/** Batas gambar pilihan & urut (cermin PenanganPilihanGambar / PenanganUrutGambar). */
export const MIN_GAMBAR = 2
export const MAKS_GAMBAR = 8

/** Batas kata susun huruf & panjang petunjuk (cermin PenanganSusunHuruf). */
export const MIN_HURUF = 2
export const MAKS_HURUF = 20
export const MAKS_PETUNJUK = 500

/** Batas isian rumpang, klasifikasi, tabel isian, garis bilangan. */
export const MAKS_LUBANG = 10
export const MAKS_ITEM_KLASIFIKASI = 12
export const MIN_KOTAK = 2
export const MAKS_KOTAK = 6
export const MAKS_SEL = 40
export const MAKS_RENTANG_GARIS = 1000

/** Batas hotspot gambar, baca jam, tugas unggah, dan teka silang mini. */
export const MAKS_AREA_HOTSPOT = 12
export const MAKS_BUTIR_RUBRIK = 10
export const MAKS_SISI_SILANG = 12
export const MAKS_PETUNJUK_SILANG = 12
export const MIN_HURUF_SILANG = 2

/**
 * Jenis berkas tugas unggah yang **dikenali aplikasi** — pilihan guru, bukan
 * teks bebas (14 Oktober 2026, permintaan pemilik produk: "jenis berkas yang
 * boleh diunggah itu jangan buat manual diketik, buat opsi banyak").
 *
 * Daftarnya dicerminkan dari apa yang benar-benar bisa dikirim murid
 * (`sections/attempt/komponen/UnggahLampiran.jsx`: foto, rekaman diri, berkas) dan dari
 * klasifikasi isi berkas di server
 * (`Sections/Material/Services/KlasifikasiBerkas.php`), jadi tidak ada pilihan
 * yang menjanjikan jenis berkas yang tidak bisa diunggah. `semua` sengaja
 * ditaruh paling depan: banyak tugas memang bebas jenis berkas, dan dulu itu
 * harus diketik sendiri.
 *
 * `cocok` dipakai untuk membaca soal LAMA yang masih menyimpan teks bebas
 * (mis. "Foto JPG atau PNG") supaya centangnya tidak hilang saat guru membuka
 * soal itu lagi.
 *
 * @type {{ nilai: string, label: string, teks: string, cocok: string[] }[]}
 */
export const JENIS_BERKAS_TUGAS = [
  { nilai: 'semua', label: 'Semua jenis berkas', teks: 'Semua jenis berkas', cocok: [] },
  {
    nilai: 'gambar',
    label: 'Foto atau gambar (JPG, PNG)',
    teks: 'Foto (JPG/PNG)',
    cocok: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'foto', 'gambar', 'image', 'kanvas'],
  },
  { nilai: 'pdf', label: 'Dokumen PDF', teks: 'Dokumen PDF', cocok: ['pdf'] },
  {
    nilai: 'video',
    label: 'Video (MP4, WEBM)',
    teks: 'Video (MP4/WEBM)',
    cocok: ['mp4', 'webm', 'video', 'film'],
  },
  {
    nilai: 'suara',
    label: 'Suara (MP3, WAV)',
    teks: 'Suara (MP3/WAV)',
    cocok: ['mp3', 'wav', 'ogg', 'suara', 'audio', 'rekam', 'voice'],
  },
  {
    nilai: 'kantor',
    label: 'Word, Excel, atau PowerPoint',
    teks: 'Word/Excel/PowerPoint',
    cocok: ['docx', 'xls', 'xlsx', 'ppt', 'office', 'word', 'excel', 'powerpoint', 'zip', 'rar', '7z'],
  },
]

/** Batas panjang `konten.jenis_berkas` (cermin PenanganTugasUnggah). */
export const MAKS_JENIS_BERKAS = 120

/**
 * Pilihan yang tercentang dari teks `jenis_berkas` yang tersimpan.
 *
 * Soal baru menyimpan kalimat yang disusun dari centangnya, tetapi soal LAMA
 * menyimpan teks bebas, jadi teksnya dicocokkan dengan kata kunci tiap pilihan.
 * Teks yang tidak dikenali mengembalikan daftar **kosong** — editor lalu
 * meminta guru memilih ulang, bukan diam-diam memperlonggar aturannya.
 *
 * @param {unknown} teks
 * @returns {string[]}
 */
export function pilihanJenisBerkas(teks) {
  const bersih = teksAman(teks).toLowerCase()

  if (bersih === '') return []
  if (bersih.includes('semua') || bersih.includes('apa saja')) return ['semua']

  return JENIS_BERKAS_TUGAS.filter(
    (satu) => satu.nilai !== 'semua' && satu.cocok.some((kata) => bersih.includes(kata)),
  ).map((satu) => satu.nilai)
}

/**
 * Kalimat `jenis_berkas` yang dibaca murid dari pilihan guru, dalam urutan
 * `JENIS_BERKAS_TUGAS`. Daftar kosong = belum ada pilihan (server menolaknya).
 *
 * @param {string[]} pilihan
 * @returns {string}
 */
export function teksJenisBerkas(pilihan) {
  const daftar = JENIS_BERKAS_TUGAS.filter((satu) => pilihan.includes(satu.nilai))

  if (daftar.length === 0) return ''
  if (daftar.some((satu) => satu.nilai === 'semua')) return 'Semua jenis berkas'

  return daftar.map((satu) => satu.teks).join(', ')
}

/**
 * Centang/hapus centang satu pilihan. `semua` tidak bisa digabung dengan
 * pilihan lain: mencentangnya menggantikan yang lain, dan mencentang yang lain
 * melepas `semua`.
 *
 * @param {string[]} pilihan
 * @param {string} nilai
 * @returns {string[]}
 */
export function centangJenisBerkas(pilihan, nilai) {
  if (nilai === 'semua') return pilihan.includes('semua') ? [] : ['semua']

  const tanpaSemua = pilihan.filter((satu) => satu !== 'semua')

  return tanpaSemua.includes(nilai)
    ? tanpaSemua.filter((satu) => satu !== nilai)
    : [...tanpaSemua, nilai]
}

/** Batas panjang teks MathML (cermin BantuanKonten::galatMatematika). */
export const MAKS_MATEMATIKA = 2000

/** Ambang kemiripan bawaan isian singkat (cermin PenanganIsianSingkat). */
export const AMBANG_BAWAAN_ISIAN = 0.8

/** Ambang lulus bawaan uraian (cermin PenanganUraian). */
export const AMBANG_BAWAAN_URAIAN = 0.6

/** @param {unknown} nilai @returns {string} */
export function teksAman(nilai) {
  return typeof nilai === 'string' ? nilai : ''
}

/**
 * Peta teks → teks dari data server (mis. kunci.pasangan), tahan data kotor.
 * @param {unknown} nilai
 * @returns {Record<string, string>}
 */
export function rekamanTeks(nilai) {
  if (nilai === null || typeof nilai !== 'object' || Array.isArray(nilai)) return {}

  /** @type {Record<string, string>} */
  const hasil = {}
  for (const [kunci, isi] of Object.entries(/** @type {Record<string, unknown>} */ (nilai))) {
    if (typeof isi === 'string' || typeof isi === 'number') hasil[kunci] = String(isi)
  }
  return hasil
}

/**
 * Daftar item {id, teks} dari konten server.
 * @param {unknown} nilai
 * @returns {{ id: string, teks: string }[]}
 */
export function daftarAman(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((baris) => baris !== null && typeof baris === 'object')
    .map((baris) => {
      const rekaman = /** @type {Record<string, unknown>} */ (baris)
      return { id: teksAman(rekaman.id), teks: teksAman(rekaman.teks) }
    })
}

/**
 * Daftar item bergambar {id, media} dari konten server.
 * @param {unknown} nilai
 * @returns {{ id: string, media: string }[]}
 */
export function daftarMedia(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((baris) => baris !== null && typeof baris === 'object')
    .map((baris) => {
      const rekaman = /** @type {Record<string, unknown>} */ (baris)
      return { id: teksAman(rekaman.id), media: teksAman(rekaman.media) }
    })
}

/**
 * Peta id → boolean dari data server (mis. kunci.jawaban benar/salah majemuk).
 * @param {unknown} nilai
 * @returns {Record<string, boolean>}
 */
export function rekamanBoolean(nilai) {
  if (nilai === null || typeof nilai !== 'object' || Array.isArray(nilai)) return {}

  /** @type {Record<string, boolean>} */
  const hasil = {}
  for (const [kunci, isi] of Object.entries(/** @type {Record<string, unknown>} */ (nilai))) {
    if (typeof isi === 'boolean') hasil[kunci] = isi
  }
  return hasil
}

/**
 * Daftar teks dari nilai array sederhana (mis. kunci.urutan).
 * @param {unknown} nilai
 * @returns {string[]}
 */
export function daftarTeks(nilai) {
  if (!Array.isArray(nilai)) return []
  return nilai.map((satu) => (typeof satu === 'string' || typeof satu === 'number' ? String(satu) : ''))
}

/**
 * Daftar {id, teks} dari bidang `label` (mis. kotak klasifikasi). Tanpa ini,
 * kotak berlabel tampil kosong karena isinya bukan `teks`.
 * @param {unknown} nilai
 * @returns {{ id: string, teks: string }[]}
 */
export function daftarLabel(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((baris) => baris !== null && typeof baris === 'object')
    .map((baris) => {
      const rekaman = /** @type {Record<string, unknown>} */ (baris)
      return { id: teksAman(rekaman.id), teks: teksAman(rekaman.label) }
    })
}

/**
 * Peta id → daftar jawaban diterima (mis. kunci.lubang / kunci.sel yang
 * nilainya berupa array). `rekamanTeks` tidak bisa dipakai untuk ini karena
 * membuang nilai non-teks.
 * @param {unknown} nilai
 * @returns {Record<string, string[]>}
 */
export function rekamanDaftarTeks(nilai) {
  if (nilai === null || typeof nilai !== 'object' || Array.isArray(nilai)) return {}

  /** @type {Record<string, string[]>} */
  const hasil = {}
  for (const [kunci, isi] of Object.entries(/** @type {Record<string, unknown>} */ (nilai))) {
    hasil[kunci] = daftarTeks(Array.isArray(isi) ? isi : [isi]).filter((satu) => satu !== '')
  }
  return hasil
}

/**
 * Persen (0–100) dari editor → pecahan 0–1 yang dikirim ke server.
 * Nilai di luar rentang dijepit supaya gambar tidak pernah "bocor" keluar bidang.
 * @param {unknown} nilai
 * @returns {number}
 */
export function persenKePecahan(nilai) {
  const angka = Number(nilai)

  if (!Number.isFinite(angka)) return 0

  return Math.min(1, Math.max(0, angka / 100))
}

/**
 * Kebalikannya: pecahan 0–1 dari server → persen untuk editor.
 * @param {unknown} nilai
 * @returns {string}
 */
export function pecahanKePersen(nilai) {
  const angka = Number(nilai)

  if (!Number.isFinite(angka)) return ''

  return String(Math.round(Math.min(1, Math.max(0, angka)) * 100))
}

/**
 * Baris grid teka silang dari kotak teks editor: tiap baris satu baris grid,
 * tanpa baris kosong dan tanpa spasi.
 * @param {string} teks
 * @returns {string[]}
 */
export function barisSilang(teks) {
  return teks
    .split('\n')
    .map((satu) => satu.replace(/\s+/g, ''))
    .filter((satu) => satu !== '')
}

/**
 * Kode sel teka silang: "baris,kolom".
 * @param {number} baris @param {number} kolom
 * @returns {string}
 */
export function kodeSilang(baris, kolom) {
  return `${baris},${kolom}`
}

/**
 * Huruf jawaban dari grid editor: huruf pada kotak yang diisi murid
 * (`#` = kotak hitam, titik/karakter lain = kotak yang belum diberi huruf).
 * @param {string} teks
 * @returns {Record<string, string>}
 */
export function selSilangDariGrid(teks) {
  /** @type {Record<string, string>} */
  const sel = {}

  barisSilang(teks).forEach((baris, r) => {
    ;[...baris].forEach((huruf, c) => {
      if (huruf !== '#' && /[a-zA-Z]/.test(huruf)) sel[kodeSilang(r, c)] = huruf
    })
  })

  return sel
}

/**
 * Matriks kotak grid silang untuk editor: tiap baris daftar satu karakter
 * (`#` kotak hitam, huruf = huruf jawaban, `.` belum diberi huruf).
 * @param {string} teks
 * @returns {string[][]}
 */
export function kotakSilangDariGrid(teks) {
  return barisSilang(teks).map((baris) => [...baris])
}

/**
 * Kebalikannya: matriks kotak menjadi teks grid (satu baris per baris).
 * @param {string[][]} kotak
 * @returns {string}
 */
export function gridDariKotakSilang(kotak) {
  return kotak.map((baris) => baris.join('')).join('\n')
}

/**
 * Samakan panjang semua baris grid: validasi dan backend menuntut tiap baris
 * sama panjang, jadi baris yang lebih pendek diberi kotak kosong `.`.
 * @param {string[][]} kotak
 * @returns {string[][]}
 */
export function samakanPanjangSilang(kotak) {
  const lebar = kotak.reduce((maks, baris) => Math.max(maks, baris.length), 0)

  return kotak.map((baris) => [...baris, ...[...Array(lebar - baris.length)].map(() => '.')])
}

/**
 * Ubah satu kotak grid silang. Nilai baru boleh huruf jawaban, `#` (kotak
 * hitam), atau `.` (kotak yang belum diberi huruf).
 * @param {string} teks @param {number} baris @param {number} kolom @param {string} nilai
 * @returns {string}
 */
export function ubahKotakSilang(teks, baris, kolom, nilai) {
  const kotak = kotakSilangDariGrid(teks)

  if (kotak[baris]?.[kolom] === undefined) return teks

  kotak[baris][kolom] = nilai

  return gridDariKotakSilang(samakanPanjangSilang(kotak))
}

/**
 * Tambah satu baris grid di ujung bawah. Lebarnya mengikuti baris yang ada;
 * grid kosong dimulai dari `lebarBawaan` kolom supaya tombolnya tetap berguna
 * (validasi menuntut minimal 2 × 2).
 * @param {string} teks @param {number} [lebarBawaan]
 * @returns {string|null}
 */
export function tambahBarisSilang(teks, lebarBawaan = 2) {
  const kotak = samakanPanjangSilang(kotakSilangDariGrid(teks))
  const lebar = kotak[0]?.length ?? lebarBawaan

  if (kotak.length + 1 > MAKS_SISI_SILANG || lebar > MAKS_SISI_SILANG) return null

  return gridDariKotakSilang([...kotak, [...Array(lebar)].map(() => '.')])
}

/**
 * Tambah satu kolom grid di ujung kanan, tiap baris ikut memanjang.
 * @param {string} teks
 * @returns {string|null}
 */
export function tambahKolomSilang(teks) {
  const kotak = samakanPanjangSilang(kotakSilangDariGrid(teks))

  if (kotak.length === 0) return null
  if (kotak[0].length + 1 > MAKS_SISI_SILANG) return null

  return gridDariKotakSilang(kotak.map((baris) => [...baris, '.']))
}

/**
 * Hapus satu baris grid. Dua baris terakhir dipertahankan: di bawah itu bukan
 * teka silang lagi menurut validasi.
 * @param {string} teks @param {number} index
 * @returns {string|null}
 */
export function hapusBarisSilang(teks, index) {
  const kotak = kotakSilangDariGrid(teks)

  if (kotak.length <= 2 || index < 0 || index >= kotak.length) return null

  return gridDariKotakSilang(kotak.filter((_, posisi) => posisi !== index))
}

/**
 * Hapus satu kolom grid; dua kolom terakhir dipertahankan.
 * @param {string} teks @param {number} index
 * @returns {string|null}
 */
export function hapusKolomSilang(teks, index) {
  const kotak = samakanPanjangSilang(kotakSilangDariGrid(teks))
  const lebar = kotak[0]?.length ?? 0

  if (lebar <= 2 || index < 0 || index >= lebar) return null

  return gridDariKotakSilang(kotak.map((baris) => baris.filter((_, posisi) => posisi !== index)))
}

/**
 * Daftar kode sel sebuah petunjuk dari sel awal + panjangnya.
 * @param {string} mulai kode sel awal ("baris,kolom")
 * @param {unknown} panjang
 * @param {string} arah 'mendatar'|'menurun'
 * @returns {string[]}
 */
export function selDariPetunjuk(mulai, panjang, arah) {
  const bagian = mulai.split(',')
  const baris = Number(bagian[0])
  const kolom = Number(bagian[1])
  const jumlah = Number(panjang)

  if (!Number.isInteger(baris) || !Number.isInteger(kolom) || !Number.isInteger(jumlah) || jumlah < 1) {
    return []
  }

  const sel = []

  for (let urut = 0; urut < jumlah; urut += 1) {
    sel.push(arah === 'menurun' ? kodeSilang(baris + urut, kolom) : kodeSilang(baris, kolom + urut))
  }

  return sel
}

/**
 * Peta kode sel awal → nomor petunjuk (untuk menulis nomor di kotak pertama).
 * @param {{ nomor: string, mulai: string }[]} petunjuk
 * @returns {Record<string, string>}
 */
export function nomorPetaSilang(petunjuk) {
  /** @type {Record<string, string>} */
  const peta = {}

  for (const satu of petunjuk) {
    if (satu.mulai !== '' && satu.nomor !== '') peta[satu.mulai] = satu.nomor
  }

  return peta
}

/**
 * Nomor penanda `{{n}}` pada teks soal, unik dan terurut menaik.
 * @param {string} teks
 * @returns {number[]}
 */
export function nomorLubangDariTeks(teks) {
  const cocok = teks.match(/\{\{\s*(\d+)\s*\}\}/g) ?? []
  const nomor = cocok.map((satu) => Number(satu.replace(/\D/g, '')))

  return [...new Set(nomor)].sort((a, b) => a - b)
}

/**
 * Pecah teks berpemisah koma menjadi daftar kata bersih.
 * @param {string} teks
 * @returns {string[]}
 */
export function pisahKata(teks) {
  return teks
    .split(',')
    .map((satu) => satu.trim())
    .filter((satu) => satu !== '')
}

/**
 * Daftar nama kolom tabel isian (tanpa nama kosong).
 *
 * Nama kolom disimpan sebagai satu teks berkoma (`state.kolom`) supaya materi
 * lama tetap terbaca; helper di sekitar sini yang membuatnya bisa disunting
 * sebagai **kolom sungguhan** di editor (14 Okt 2026).
 *
 * @param {Pick<StateSoal, 'kolom'>} state
 * @returns {string[]}
 */
export function kolomTabel(state) {
  return pisahKata(state.kolom)
}

/**
 * Ganti nama satu kolom tabel. Koma dibuang dari namanya: daftar kolom disimpan
 * sebagai teks berkoma, jadi satu koma di nama kolom akan menciptakan kolom baru
 * yang tidak pernah dikehendaki guru.
 *
 * @param {Pick<StateSoal, 'kolom'>} state
 * @param {number} index
 * @param {string} teks
 * @returns {string} teks kolom yang baru
 */
export function kolomTabelDiganti(state, index, teks) {
  const daftar = kolomTabel(state)

  if (index < 0 || index >= daftar.length) return state.kolom

  daftar[index] = teks.replace(/,/g, ' ').trimStart()

  return daftar.map((satu) => satu.trim()).join(', ')
}

/**
 * Tambah satu kolom tabel: nama bawaannya ikut ditulis supaya guru langsung bisa
 * menggantinya, dan tiap baris mendapat satu sel kosong baru.
 *
 * Kode sel dijaga **unik di seluruh tabel** (bukan hanya unik di dalam satu
 * baris): server menolak dua sel berkode sama. Kode sel adalah identitas
 * (`r{nomor}c{kolom}`), bukan posisi — karena itu kolom yang dihapus tidak
 * memaksa kode sel lain berubah, dan kunci jawaban sel lain tetap menempel.
 *
 * `null` berarti batas `MAKS_SEL` sudah tercapai — pemanggil menonaktifkan
 * tombolnya, bukan menambah diam-diam lalu ditolak server.
 *
 * @param {Pick<StateSoal, 'kolom'|'barisTabel'>} state
 * @returns {{ kolom: string, barisTabel: any[] }|null}
 */
export function tambahKolomTabel(state) {
  const daftar = kolomTabel(state)
  const kolomBaru = daftar.length + 1
  const totalSel = state.barisTabel.reduce((jumlah, baris) => jumlah + baris.sel.length, 0)

  if (totalSel + Math.max(1, state.barisTabel.length) > MAKS_SEL) return null

  const dipakai = new Set(state.barisTabel.flatMap((baris) => baris.sel.map((sel) => sel.kode)))

  return {
    kolom: [...daftar, `Kolom ${kolomBaru}`].join(', '),
    barisTabel: state.barisTabel.map((baris) => {
      let nomor = 1
      while (dipakai.has(`r${nomor}c${kolomBaru}`)) nomor += 1

      const kode = `r${nomor}c${kolomBaru}`
      dipakai.add(kode)

      return { ...baris, sel: [...baris.sel, { kode, teks: '' }] }
    }),
  }
}

/**
 * Hapus satu kolom tabel beserta selnya di **setiap** baris, dan kunci jawaban
 * yang menempel pada sel-sel itu.
 *
 * Kolom terakhir tidak boleh dihapus (tabel tanpa kolom bukan tabel).
 *
 * @param {Pick<StateSoal, 'kolom'|'barisTabel'|'kunciSel'>} state
 * @param {number} index
 * @returns {{ kolom: string, barisTabel: any[], kunciSel: Record<string, string> }|null}
 */
export function hapusKolomTabel(state, index) {
  const daftar = kolomTabel(state)

  if (daftar.length <= 1 || index < 0 || index >= daftar.length) return null

  const dibuang = new Set(
    state.barisTabel.map((baris) => baris.sel[index]?.kode).filter((kode) => typeof kode === 'string'),
  )

  return {
    kolom: daftar.filter((_, posisi) => posisi !== index).join(', '),
    barisTabel: state.barisTabel.map((baris) => ({
      ...baris,
      sel: baris.sel.filter((_, posisi) => posisi !== index),
    })),
    kunciSel: Object.fromEntries(
      Object.entries(state.kunciSel).filter(([kode]) => !dibuang.has(kode)),
    ),
  }
}

/**
 * Tambah satu baris tabel: tiap kolom yang ada mendapat satu sel kosong.
 *
 * `null` berarti tidak ada kolom sama sekali atau batas `MAKS_SEL` tercapai —
 * pemanggil menonaktifkan tombolnya, bukan menambah lalu ditolak server.
 *
 * @param {Pick<StateSoal, 'kolom'|'barisTabel'>} state
 * @returns {{ barisTabel: any[] }|null}
 */
export function tambahBarisTabel(state) {
  const daftar = kolomTabel(state)
  const totalSel = state.barisTabel.reduce((jumlah, baris) => jumlah + baris.sel.length, 0)

  if (daftar.length === 0 || totalSel + daftar.length > MAKS_SEL) return null

  const dipakai = new Set(state.barisTabel.flatMap((baris) => baris.sel.map((sel) => sel.kode)))
  let nomor = 1
  while (daftar.some((_, kolom) => dipakai.has(`r${nomor}c${kolom + 1}`))) nomor += 1

  return {
    barisTabel: [
      ...state.barisTabel,
      {
        id: idBerikut('R', state.barisTabel),
        sel: daftar.map((_, kolom) => ({ kode: `r${nomor}c${kolom + 1}`, teks: '' })),
      },
    ],
  }
}

/**
 * Hapus satu baris tabel beserta kunci jawaban sel-selnya.
 *
 * Baris terakhir tidak boleh dihapus (tabel tanpa baris bukan tabel).
 *
 * @param {Pick<StateSoal, 'barisTabel'|'kunciSel'>} state
 * @param {number} index
 * @returns {{ barisTabel: any[], kunciSel: Record<string, string> }|null}
 */
export function hapusBarisTabel(state, index) {
  if (state.barisTabel.length <= 1 || index < 0 || index >= state.barisTabel.length) return null

  const sisa = state.barisTabel.filter((_, posisi) => posisi !== index)
  const kode = new Set(sisa.flatMap((baris) => baris.sel.map((sel) => sel.kode)))

  return {
    barisTabel: sisa,
    kunciSel: Object.fromEntries(
      Object.entries(state.kunciSel).filter(([kodeSel]) => kode.has(kodeSel)),
    ),
  }
}

/**
 * Baris sinonim uraian (`kata = alias, alias`) menjadi peta untuk kunci
 * `sinonim: { kata: [alias, …] }`.
 * @param {string} teks
 * @returns {Record<string, string[]>}
 */
export function sinonimUraianDariTeks(teks) {
  /** @type {Record<string, string[]>} */
  const peta = {}

  for (const baris of teks.split('\n')) {
    const [kata, alias] = baris.split('=')
    const nama = teksAman(kata).trim()
    if (nama === '') continue

    const daftar = pisahKata(teksAman(alias))
    if (daftar.length > 0) peta[nama] = daftar
  }

  return peta
}

/**
 * Kebalikannya: peta sinonim uraian menjadi baris teks untuk editor.
 * @param {unknown} nilai
 * @returns {string}
 */
export function teksDariSinonimUraian(nilai) {
  if (nilai === null || typeof nilai !== 'object' || Array.isArray(nilai)) return ''

  return Object.entries(/** @type {Record<string, unknown>} */ (nilai))
    .map(([kata, alias]) => `${kata} = ${Array.isArray(alias) ? alias.map(String).join(', ') : ''}`)
    .join('\n')
}

/**
 * Baris sinonim uraian dalam bentuk yang bisa disunting sebagai **baris** di
 * editor (`kata` + `alias`), bukan sebagai teks mentah.
 *
 * Sumber kebenarannya tetap satu baris teks "kata = alias" supaya data lama
 * terbaca; fungsi di sekitar sini hanya membuatnya bisa diketik per bidang.
 * Baris yang masih kosong tetap dibawa (tidak dibuang) supaya guru bisa
 * mengetiknya tanpa barisnya hilang sendiri.
 *
 * @param {unknown} teks
 * @returns {{ kata: string, alias: string }[]}
 */
export function barisSinonimUraian(teks) {
  return teksAman(teks)
    .split('\n')
    .filter((baris) => baris.trim() !== '')
    .map((baris) => {
      // Hanya SATU spasi pemisah yang dibuang di tiap sisi — spasi yang diketik
      // guru di dalam kata ("rambut getar") harus tetap ada, kalau tidak
      // mengetik spasi terasa dimakan sendiri.
      const pisah = baris.indexOf('=')
      const kata = pisah === -1 ? baris : baris.slice(0, pisah)
      const alias = pisah === -1 ? '' : baris.slice(pisah + 1)

      return { kata: kata.replace(/ $/, ''), alias: alias.replace(/^ /, '') }
    })
}

/**
 * Kebalikannya: daftar baris sinonim uraian menjadi teks yang disimpan.
 * @param {{ kata: string, alias: string }[]} baris
 * @returns {string}
 */
export function teksDariBarisSinonimUraian(baris) {
  return baris.map((satu) => `${satu.kata} = ${satu.alias}`).join('\n')
}

/**
 * Ubah satu bidang (`kata`/`alias`) pada satu baris sinonim uraian.
 * @param {unknown} teks
 * @param {number} index
 * @param {'kata'|'alias'} bidang
 * @param {string} nilai
 * @returns {string}
 */
export function ubahBarisSinonimUraian(teks, index, bidang, nilai) {
  const baris = barisSinonimUraian(teks)

  if (baris[index] === undefined) return teksAman(teks)

  baris[index] = { ...baris[index], [bidang]: nilai }

  return teksDariBarisSinonimUraian(baris)
}

/**
 * Tambah satu baris sinonim uraian di ujung bawah.
 * @param {unknown} teks
 * @returns {string}
 */
export function tambahBarisSinonimUraian(teks) {
  return teksDariBarisSinonimUraian([...barisSinonimUraian(teks), { kata: '', alias: '' }])
}

/**
 * Hapus satu baris sinonim uraian.
 * @param {unknown} teks
 * @param {number} index
 * @returns {string}
 */
export function hapusBarisSinonimUraian(teks, index) {
  const baris = barisSinonimUraian(teks).filter((_, posisi) => posisi !== index)

  return teksDariBarisSinonimUraian(baris)
}

/**
 * Id berikutnya yang belum dipakai pada daftar (mis. 'A', 'B', …).
 * @param {string} prefix
 * @param {{ id: string }[]} daftar
 * @returns {string}
 */
export function idBerikut(prefix, daftar) {
  const dipakai = new Set(daftar.map((satu) => satu.id))
  let nomor = 1
  while (dipakai.has(`${prefix}${nomor}`)) nomor += 1
  return `${prefix}${nomor}`
}

/**
 * @typedef {{ id: string, teks: string }} ItemKonten
 * @typedef {{ id: string, teks: string, posisi: string }} ItemUrut
 * @typedef {{ teks: string, sinonim: string }} BarisIsian
 * @typedef {{ teks: string, bobot: string }} BarisKataKunci
 * @typedef {{
 *   id: number|null,
 *   subject_id: string,
 *   tag_id: string,
 *   tipe: string,
 *   teks: string,
 *   media: string,
 *   matematika: string,
 *   opsi: ItemKonten[],
 *   jawaban: string,
 *   benar: boolean,
 *   kiri: ItemKonten[],
 *   kanan: ItemKonten[],
 *   pasangan: Record<string, string>,
 *   item: ItemUrut[],
 *   jawabanBaku: BarisIsian[],
 *   ambang: string,
 *   angkaPersis: boolean,
 *   negasi: string,
 *   kataKunci: BarisKataKunci[],
 *   ambangLulus: string,
 *   sinonimUraian: string,
 *   kata: ItemKonten[],
 *   posisi: ItemKonten[],
 *   penempatan: Record<string, string>,
 *   sambungan: Record<string, string>,
 *   benarKompleks: string[],
 *   pernyataan: ItemKonten[],
 *   kunciPernyataan: Record<string, boolean>,
 *   satuan: string,
 *   angkaNilai: string,
 *   angkaToleransi: string,
 *   opsiGambar: ({ id: string, media: string })[],
 *   jawabanGambar: string,
 *   itemGambar: ({ id: string, media: string, posisi: string })[],
 *   petunjuk: string,
 *   kataSusun: string,
 *   lubang: Record<string, string>,
 *   itemKlasifikasi: ItemKonten[],
 *   kotak: ItemKonten[],
 *   petaKlasifikasi: Record<string, string>,
 *   kolom: string,
 *   barisTabel: ({ id: string, sel: ({ kode: string, teks: string })[] })[],
 *   kunciSel: Record<string, string>,
 *   garisMin: string,
 *   garisMax: string,
 *   garisLangkah: string,
 *   garisNilai: string,
 *   garisToleransi: string,
 *   areaHotspot: ({ id: string, x: string, y: string, w: string, h: string })[],
 *   benarHotspot: string[],
 *   jamJam: string,
 *   jamMenit: string,
 *   jenisBerkas: string,
 *   rubrik: ({ butir: string, poin: string })[],
 *   gridSilang: string,
 *   petunjukSilang: ({ arah: string, nomor: string, teks: string, mulai: string, panjang: string })[],
 *   pembahasan: string,
 *   skor: string,
 *   aktif: boolean,
 *   teknikKoreksi: string,
 * }} StateSoal
 */

/** Soal server yang bisa dibuka editor (bentuk minimal dari SoalResource). */
/**
 * @typedef {{
 *   id: number,
 *   subject_id: number,
 *   tag_id: number|null,
 *   tipe: string,
 *   konten: Record<string, unknown>,
 *   kunci: Record<string, unknown>,
 *   pembahasan: string|null,
 *   skor: number,
 *   aktif: boolean,
 * }} SoalTersimpan
 */

/** State kosong untuk soal baru (pilihan ganda dua opsi). */
export function stateSoalKosong() {
  return /** @type {StateSoal} */ ({
    id: null,
    subject_id: '',
    tag_id: '',
    tipe: TIPE.pilihanGanda,
    teks: '',
    media: '',
    matematika: '',
    opsi: [
      { id: 'A', teks: '' },
      { id: 'B', teks: '' },
    ],
    jawaban: 'A',
    benar: true,
    kiri: [
      { id: 'K1', teks: '' },
      { id: 'K2', teks: '' },
    ],
    kanan: [
      { id: 'N1', teks: '' },
      { id: 'N2', teks: '' },
    ],
    pasangan: { K1: 'N1', K2: 'N2' },
    item: [
      { id: 'I1', teks: '', posisi: '1' },
      { id: 'I2', teks: '', posisi: '2' },
    ],
    jawabanBaku: [{ teks: '', sinonim: '' }],
    ambang: String(AMBANG_BAWAAN_ISIAN),
    angkaPersis: true,
    negasi: '',
    kataKunci: [{ teks: '', bobot: '' }],
    ambangLulus: String(AMBANG_BAWAAN_URAIAN),
    sinonimUraian: '',
    kata: [
      { id: 'W1', teks: '' },
      { id: 'W2', teks: '' },
    ],
    posisi: [
      { id: 'P1', teks: '' },
      { id: 'P2', teks: '' },
    ],
    penempatan: { W1: 'P1', W2: 'P2' },
    sambungan: { K1: 'N1', K2: 'N2' },
    benarKompleks: [],
    pernyataan: [
      { id: 'P1', teks: '' },
      { id: 'P2', teks: '' },
    ],
    kunciPernyataan: { P1: true, P2: false },
    satuan: '',
    angkaNilai: '',
    angkaToleransi: '0',
    opsiGambar: [
      { id: 'G1', media: '' },
      { id: 'G2', media: '' },
    ],
    jawabanGambar: 'G1',
    itemGambar: [
      { id: 'U1', media: '', posisi: '1' },
      { id: 'U2', media: '', posisi: '2' },
    ],
    petunjuk: '',
    kataSusun: '',
    lubang: { '1': '' },
    itemKlasifikasi: [
      { id: 'I1', teks: '' },
      { id: 'I2', teks: '' },
    ],
    kotak: [
      { id: 'K1', teks: '' },
      { id: 'K2', teks: '' },
    ],
    petaKlasifikasi: {},
    // Nama kolom bawaan: grid tabel di editor menampilkannya sebagai kepala
    // tabel yang bisa langsung diganti, dan tabel tanpa nama kolom ditolak
    // validasi — jadi jangan mulai dari daftar kosong (14 Oktober 2026).
    kolom: 'Soal, Jawaban',
    barisTabel: [
      {
        id: 'R1',
        sel: [
          { kode: 'r1c1', teks: '' },
          { kode: 'r1c2', teks: '' },
        ],
      },
    ],
    kunciSel: {},
    garisMin: '0',
    garisMax: '10',
    garisLangkah: '1',
    garisNilai: '',
    garisToleransi: '0',
    areaHotspot: [
      { id: 'A1', x: '10', y: '20', w: '20', h: '20' },
      { id: 'A2', x: '40', y: '20', w: '20', h: '20' },
    ],
    benarHotspot: [],
    jamJam: '7',
    jamMenit: '0',
    // Tugas unggah baru mulai dari "Semua jenis berkas": guru tinggal
    // mempersempit bila perlu (14 Oktober 2026). Sebelumnya kolom ini kosong
    // dan harus DIKETIK sendiri.
    jenisBerkas: 'Semua jenis berkas',
    rubrik: [{ butir: '', poin: '1' }],
    gridSilang: '...\n...\n...',
    petunjukSilang: [{ arah: 'mendatar', nomor: '1', teks: '', mulai: '0,0', panjang: '3' }],
    pembahasan: '',
    skor: '10',
    aktif: true,
    // Cara mengoreksi soal ini. Bawaannya mengikuti jenis soal (14 Oktober
    // 2026) — lihat sections/question/teknikKoreksi.js.
    teknikKoreksi: teknikKoreksiBawaan(TIPE.pilihanGanda),
  })
}

/**
 * Isi soal (konten) dari state editor. Media/MathML kosong dibuang
 * supaya backend tidak menyimpan bidang kosong.
 * @param {StateSoal} state
 * @returns {Record<string, unknown>}
 */
export function kontenDariState(state) {
  /** @type {Record<string, unknown>} */
  const konten = { teks: state.teks.trim() }

  if (state.media.trim() !== '') konten.media = state.media.trim()
  if (state.matematika.trim() !== '') konten.matematika = state.matematika.trim()

  if (state.tipe === TIPE.pilihanGanda) {
    konten.opsi = state.opsi.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.menjodohkan) {
    konten.kiri = state.kiri.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
    konten.kanan = state.kanan.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.hubungKata) {
    konten.kiri = state.kiri.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
    konten.kanan = state.kanan.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.mengurutkan) {
    konten.item = state.item.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.letakKata) {
    konten.kata = state.kata.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
    konten.posisi = state.posisi.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.pilihanGandaKompleks) {
    konten.opsi = state.opsi.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.benarSalahMajemuk) {
    konten.pernyataan = state.pernyataan.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.isianAngka) {
    if (state.satuan.trim() !== '') konten.satuan = state.satuan.trim()
  }

  if (state.tipe === TIPE.pilihanGambar) {
    konten.opsi = state.opsiGambar.map((satu) => ({ id: satu.id, media: satu.media.trim() }))
  }

  if (state.tipe === TIPE.urutGambar) {
    konten.item = state.itemGambar.map((satu) => ({ id: satu.id, media: satu.media.trim() }))
  }

  if (state.tipe === TIPE.susunHuruf) {
    konten.petunjuk = state.petunjuk.trim()
    // konten susun huruf tidak memakai teks soal: petunjuk sudah menggantikannya.
    delete konten.teks
  }

  if (state.tipe === TIPE.klasifikasi) {
    konten.item = state.itemKlasifikasi.map((satu) => ({ id: satu.id, teks: satu.teks.trim() }))
    konten.kotak = state.kotak.map((satu) => ({ id: satu.id, label: satu.teks.trim() }))
  }

  if (state.tipe === TIPE.tabelIsian) {
    konten.kolom = pisahKata(state.kolom)
    konten.baris = state.barisTabel.map((baris) => ({
      id: baris.id,
      sel: baris.sel.map((sel) => {
        const teks = sel.teks.trim()
        return teks === '' ? { kode: sel.kode } : { kode: sel.kode, teks }
      }),
    }))
  }

  if (state.tipe === TIPE.garisBilangan) {
    konten.min = Number(state.garisMin)
    konten.max = Number(state.garisMax)
    konten.langkah = Number(state.garisLangkah)
  }

  if (state.tipe === TIPE.hotspotGambar) {
    // Editor memakai persen supaya guru tidak menghitung pecahan; server tetap
    // menerima koordinat ternormalisasi 0–1.
    konten.area = state.areaHotspot.map((satu) => ({
      id: satu.id,
      x: persenKePecahan(satu.x),
      y: persenKePecahan(satu.y),
      w: persenKePecahan(satu.w),
      h: persenKePecahan(satu.h),
    }))
  }

  if (state.tipe === TIPE.tugasUnggah) {
    konten.jenis_berkas = state.jenisBerkas.trim()
  }

  if (state.tipe === TIPE.tekaSilangMini) {
    // konten hanya membawa bentuk kotak; huruf jawabannya ada di kunci.sel.
    konten.grid = barisSilang(state.gridSilang).map((baris) =>
      [...baris].map((huruf) => (huruf === '#' ? '#' : '')),
    )

    /** @param {string} arah */
    const petunjuk = (arah) =>
      state.petunjukSilang
        .filter((satu) => satu.arah === arah)
        .map((satu) => ({
          nomor: Number(satu.nomor),
          teks: satu.teks.trim(),
          sel: selDariPetunjuk(satu.mulai, satu.panjang, arah),
        }))

    konten.mendatar = petunjuk('mendatar')
    konten.menurun = petunjuk('menurun')
  }

  return konten
}

/**
 * Kunci jawaban dari state editor.
 * @param {StateSoal} state
 * @returns {Record<string, unknown>}
 */
/**
 * Kunci jawaban dari state editor, **termasuk** pilihan teknik koreksi guru.
 *
 * `teknik_koreksi` hanya ditulis bila guru memilih yang BUKAN bawaan jenis
 * soalnya: kunci soal lama tidak berubah bentuk, dan bawaannya selalu dibaca
 * ulang dari jenis soalnya (di server: `TeknikKoreksi::untuk`).
 *
 * @param {StateSoal} state
 * @returns {Record<string, unknown>}
 */
export function kunciDariState(state) {
  const kunci = kunciIsi(state)

  if (teknikKoreksiDariState(state) !== teknikKoreksiBawaan(state.tipe)) {
    kunci.teknik_koreksi = state.teknikKoreksi
  }

  return kunci
}

/**
 * Isi kunci per jenis soal (tanpa teknik koreksi).
 * @param {StateSoal} state
 * @returns {Record<string, unknown>}
 */
function kunciIsi(state) {
  if (state.tipe === TIPE.benarSalah) return { benar: state.benar }
  if (state.tipe === TIPE.menjodohkan) return { pasangan: { ...state.pasangan } }
  if (state.tipe === TIPE.mengurutkan) return { urutan: urutanDariItem(state.item) }
  if (state.tipe === TIPE.letakKata) return { penempatan: { ...state.penempatan } }
  if (state.tipe === TIPE.hubungKata) return { sambungan: { ...state.sambungan } }
  if (state.tipe === TIPE.isianSingkat) return kunciIsian(state)
  if (state.tipe === TIPE.uraian) return kunciUraian(state)
  if (state.tipe === TIPE.pilihanGandaKompleks) return { benar: [...state.benarKompleks] }
  if (state.tipe === TIPE.benarSalahMajemuk) return { jawaban: { ...state.kunciPernyataan } }
  if (state.tipe === TIPE.isianAngka) {
    return { nilai: Number(state.angkaNilai), toleransi: Number(state.angkaToleransi || 0) }
  }
  if (state.tipe === TIPE.pilihanGambar) return { benar: state.jawabanGambar }
  if (state.tipe === TIPE.urutGambar) return { urutan: urutanDariItemGambar(state.itemGambar) }
  if (state.tipe === TIPE.susunHuruf) return { kata: state.kataSusun.trim() }
  if (state.tipe === TIPE.isianRumpang) {
    // Penanda yang sudah dihapus dari teks dibuang: server menolak kunci
    // dengan penanda yang tidak ada di teks.
    const nomor = nomorLubangDariTeks(state.teks)
    const dipakai = Object.fromEntries(
      Object.entries(state.lubang).filter(([kode]) => nomor.includes(Number(kode))),
    )
    return { lubang: petaJawabanDariRekaman(dipakai) }
  }
  if (state.tipe === TIPE.klasifikasi) return { peta: { ...state.petaKlasifikasi } }
  if (state.tipe === TIPE.tabelIsian) {
    // Sama seperti isian rumpang: kunci sel yang sudah tidak ada di tabel
    // jangan ikut terkirim.
    const kode = new Set(state.barisTabel.flatMap((baris) => baris.sel.map((sel) => sel.kode)))
    const dipakai = Object.fromEntries(
      Object.entries(state.kunciSel).filter(([kodeSel]) => kode.has(kodeSel)),
    )
    return { sel: petaJawabanDariRekaman(dipakai) }
  }
  if (state.tipe === TIPE.garisBilangan) {
    return { nilai: Number(state.garisNilai), toleransi: Number(state.garisToleransi || 0) }
  }
  if (state.tipe === TIPE.hotspotGambar) return { area_benar: [...state.benarHotspot] }
  if (state.tipe === TIPE.bacaJam) return { jam: Number(state.jamJam), menit: Number(state.jamMenit) }
  if (state.tipe === TIPE.tugasUnggah) {
    return {
      rubrik: state.rubrik.map((satu) => ({ butir: satu.butir.trim(), poin: Number(satu.poin) })),
    }
  }
  if (state.tipe === TIPE.tekaSilangMini) return { sel: selSilangDariGrid(state.gridSilang) }
  return { jawaban: state.jawaban }
}

/**
 * Peta `{kode: "jawaban, alias"}` menjadi `{kode: [jawaban, alias]}`.
 * @param {Record<string, string>} rekaman
 * @returns {Record<string, string[]>}
 */
export function petaJawabanDariRekaman(rekaman) {
  /** @type {Record<string, string[]>} */
  const peta = {}

  for (const [kode, teks] of Object.entries(rekaman)) {
    peta[kode] = pisahKata(teksAman(teks))
  }

  return peta
}

/**
 * Pindahkan satu baris daftar ke atas (-1) atau ke bawah (+1) lalu tulis ulang
 * `posisi` semua baris (1 paling awal).
 *
 * 14 Oktober 2026 — pemilik produk: "buat pengurutan urutan dll langsung
 * visual gak perlu ketik lagi". Sebelumnya guru mengetik angka urut di tiap
 * baris, yang mudah salah (dua baris bernomor sama, atau ada nomor yang tidak
 * dipakai) — dengan memindahkan barisnya, urutan yang dilihat guru **adalah**
 * urutan benarnya, dan nomornya dihitung sendiri. Daftar baru selalu punya
 * posisi 1..n tanpa lubang dan tanpa kembar; di ujung daftar, daftar aslinya
 * dikembalikan apa adanya.
 *
 * @template {{ posisi: string }} T
 * @param {T[]} daftar
 * @param {number} index
 * @param {number} arah
 * @returns {T[]}
 */
export function geserBarisPosisi(daftar, index, arah) {
  const tujuan = index + arah

  if (tujuan < 0 || tujuan >= daftar.length) return daftar

  const baru = [...daftar]
  const dipindah = baru.splice(index, 1)[0]
  baru.splice(tujuan, 0, dipindah)

  return /** @type {T[]} */ (
    baru.map((satu, posisi) => ({ ...satu, posisi: String(posisi + 1) }))
  )
}

/**
 * Peta "kanan ini dipakai kiri mana" dari peta pasangan (kiri → kanan).
 * Dipakai dua tempat: menandai item kanan yang **sudah dipakai** di papan jodoh
 * (dulu pilihan yang sudah terpakai masih bisa dipilih lagi sehingga guru baru
 * tahu dari galat server), dan memeriksa bentrok sebelum memasangkan.
 *
 * @param {Record<string, string>} peta
 * @returns {Record<string, string>}
 */
export function pemakaiKanan(peta) {
  /** @type {Record<string, string>} */
  const hasil = {}

  for (const [kiri, kanan] of Object.entries(peta)) {
    if (kanan !== '') hasil[kanan] = kiri
  }

  return hasil
}

/**
 * Pasangkan satu item kiri ke satu item kanan. Dua aturan di sini yang mencegah
 * human error: (1) satu item kanan hanya boleh dipakai **satu** kiri — peta
 * yang dikembalikan tidak berubah bila kanannya sudah dipakai kiri lain; (2)
 * memasangkan ulang kiri yang sama mengganti pasangannya, bukan menambah.
 *
 * @param {Record<string, string>} peta
 * @param {string} kiriId
 * @param {string} kananId
 * @returns {Record<string, string>}
 */
export function pasangkanKanan(peta, kiriId, kananId) {
  if (kiriId === '' || kananId === '') return peta

  const pemakai = pemakaiKanan(peta)

  if (pemakai[kananId] !== undefined && pemakai[kananId] !== kiriId) return peta

  return { ...peta, [kiriId]: kananId }
}

/**
 * Lepaskan pasangan satu item kiri. Entrinya **dibuang**, bukan dikosongkan:
 * peta yang tersimpan jadi sama seperti soal yang belum pernah dipasangkan,
 * sehingga validasi tidak perlu membedakan "belum diisi" dari "dikosongkan".
 *
 * @param {Record<string, string>} peta
 * @param {string} kiriId
 * @returns {Record<string, string>}
 */
export function lepasPasangan(peta, kiriId) {
  if (peta[kiriId] === undefined) return peta

  const baru = { ...peta }
  delete baru[kiriId]

  return baru
}

/**
 * Urutan id gambar berdasarkan posisi yang diisi guru (posisi 1 paling awal).
 * @param {{ id: string, posisi: string }[]} item
 * @returns {string[]}
 */
export function urutanDariItemGambar(item) {
  return [...item]
    .sort((a, b) => Number(a.posisi || 0) - Number(b.posisi || 0))
    .map((satu) => satu.id)
}

/**
 * Kunci isian singkat. `sinonim` hanya dikirim bila ada isinya; `angka_persis`
 * hanya dikirim saat dimatikan (bawaan backend true).
 * @param {StateSoal} state
 * @returns {Record<string, unknown>}
 */
export function kunciIsian(state) {
  /** @type {Record<string, unknown>} */
  const kunci = { jawaban_baku: state.jawabanBaku.map((satu) => satu.teks.trim()) }

  const sinonim = state.jawabanBaku.map((satu) => pisahKata(satu.sinonim))
  if (sinonim.some((daftar) => daftar.length > 0)) kunci.sinonim = sinonim

  if (!state.angkaPersis) kunci.angka_persis = false

  const ambang = Number(state.ambang)
  if (Number.isFinite(ambang) && ambang > 0 && ambang <= 1) kunci.ambang = ambang

  const negasi = pisahKata(state.negasi)
  if (negasi.length > 0) kunci.negasi = negasi

  return kunci
}

/**
 * Kunci uraian: kata kunci berbobot opsional, ambang lulus, dan sinonim.
 * @param {StateSoal} state
 * @returns {Record<string, unknown>}
 */
export function kunciUraian(state) {
  const kataKunci = state.kataKunci.map((satu) => {
    const bobot = Number(satu.bobot)
    const pakaiBobot = satu.bobot.trim() !== '' && Number.isFinite(bobot) && bobot > 0
    return pakaiBobot ? { teks: satu.teks.trim(), bobot } : { teks: satu.teks.trim() }
  })

  /** @type {Record<string, unknown>} */
  const kunci = { kata_kunci: kataKunci }

  const ambang = Number(state.ambangLulus)
  if (state.ambangLulus.trim() !== '' && Number.isFinite(ambang) && ambang > 0 && ambang <= 1) {
    kunci.ambang_lulus = ambang
  }

  const sinonim = sinonimUraianDariTeks(state.sinonimUraian)
  if (Object.keys(sinonim).length > 0) kunci.sinonim = sinonim

  return kunci
}

/**
 * Urutan id item berdasarkan posisi yang diisi guru (posisi 1 paling awal).
 * @param {ItemUrut[]} item
 * @returns {string[]}
 */
export function urutanDariItem(item) {
  return [...item]
    .sort((a, b) => Number(a.posisi || 0) - Number(b.posisi || 0))
    .map((satu) => satu.id)
}

/**
 * Buka soal tersimpan menjadi state editor.
 * @param {SoalTersimpan} soal
 * @returns {StateSoal}
 */
export function stateDariSoal(soal) {
  const state = stateSoalKosong()
  const konten = soal.konten ?? {}
  const kunci = soal.kunci ?? {}

  state.id = soal.id
  state.subject_id = String(soal.subject_id)
  state.tag_id = soal.tag_id === null ? '' : String(soal.tag_id)
  state.tipe = soal.tipe
  state.teks = teksAman(konten.teks)
  state.media = teksAman(konten.media)
  state.matematika = teksAman(konten.matematika)
  state.pembahasan = soal.pembahasan ?? ''
  state.skor = String(soal.skor)
  state.aktif = soal.aktif
  // Soal lama (sebelum pilihan teknik koreksi) tidak punya bidang ini: jatuh ke
  // bawaan jenis soalnya, jadi perilakunya tetap sama seperti sebelumnya.
  state.teknikKoreksi = teknikKoreksiSah(soal.tipe, kunci.teknik_koreksi)
    ? teksAman(kunci.teknik_koreksi)
    : teknikKoreksiBawaan(soal.tipe)

  if (soal.tipe === TIPE.pilihanGanda) {
    const opsi = daftarAman(konten.opsi)
    if (opsi.length > 0) state.opsi = opsi
    state.jawaban = teksAman(kunci.jawaban) || (state.opsi[0]?.id ?? '')
  }

  if (soal.tipe === TIPE.benarSalah) {
    state.benar = kunci.benar === true
  }

  if (soal.tipe === TIPE.menjodohkan) {
    const kiri = daftarAman(konten.kiri)
    const kanan = daftarAman(konten.kanan)
    if (kiri.length > 0) state.kiri = kiri
    if (kanan.length > 0) state.kanan = kanan
    state.pasangan = rekamanTeks(kunci.pasangan)
  }

  if (soal.tipe === TIPE.mengurutkan) {
    const item = daftarAman(konten.item)
    const urutan = daftarTeks(kunci.urutan)
    if (item.length > 0) {
      state.item = item.map((satu) => {
        const posisi = urutan.indexOf(satu.id)
        return { ...satu, posisi: String(posisi === -1 ? '' : posisi + 1) }
      })
    }
  }

  if (soal.tipe === TIPE.isianSingkat) {
    const baku = daftarTeks(kunci.jawaban_baku)
    const sinonim = Array.isArray(kunci.sinonim) ? kunci.sinonim : []
    if (baku.length > 0) {
      state.jawabanBaku = baku.map((teks, indeks) => ({
        teks,
        sinonim: daftarTeks(sinonim[indeks]).join(', '),
      }))
    }
    state.ambang = kunci.ambang === undefined ? state.ambang : String(kunci.ambang)
    state.angkaPersis = kunci.angka_persis !== false
    state.negasi = daftarTeks(kunci.negasi).join(', ')
  }

  if (soal.tipe === TIPE.uraian) {
    const kataKunci = Array.isArray(kunci.kata_kunci) ? kunci.kata_kunci : []
    const baris = kataKunci
      .filter((satu) => satu !== null && typeof satu === 'object')
      .map((satu) => {
        const rekaman = /** @type {Record<string, unknown>} */ (satu)
        return {
          teks: teksAman(rekaman.teks),
          bobot: rekaman.bobot === undefined || rekaman.bobot === null ? '' : String(rekaman.bobot),
        }
      })
    if (baris.length > 0) state.kataKunci = baris
    state.ambangLulus =
      kunci.ambang_lulus === undefined ? state.ambangLulus : String(kunci.ambang_lulus)
    state.sinonimUraian = teksDariSinonimUraian(kunci.sinonim)
  }

  if (soal.tipe === TIPE.letakKata) {
    const kata = daftarAman(konten.kata)
    const posisi = daftarAman(konten.posisi)
    if (kata.length > 0) state.kata = kata
    if (posisi.length > 0) state.posisi = posisi
    state.penempatan = rekamanTeks(kunci.penempatan)
  }

  if (soal.tipe === TIPE.hubungKata) {
    const kiri = daftarAman(konten.kiri)
    const kanan = daftarAman(konten.kanan)
    if (kiri.length > 0) state.kiri = kiri
    if (kanan.length > 0) state.kanan = kanan
    state.sambungan = rekamanTeks(kunci.sambungan)
  }

  if (soal.tipe === TIPE.pilihanGandaKompleks) {
    const opsi = daftarAman(konten.opsi)
    if (opsi.length > 0) state.opsi = opsi
    state.benarKompleks = daftarTeks(kunci.benar)
  }

  if (soal.tipe === TIPE.benarSalahMajemuk) {
    const pernyataan = daftarAman(konten.pernyataan)
    if (pernyataan.length > 0) state.pernyataan = pernyataan
    state.kunciPernyataan = rekamanBoolean(kunci.jawaban)
  }

  if (soal.tipe === TIPE.isianAngka) {
    state.satuan = teksAman(konten.satuan)
    state.angkaNilai = kunci.nilai === undefined || kunci.nilai === null ? '' : String(kunci.nilai)
    state.angkaToleransi = kunci.toleransi === undefined || kunci.toleransi === null ? '0' : String(kunci.toleransi)
  }

  if (soal.tipe === TIPE.pilihanGambar) {
    const opsi = daftarMedia(konten.opsi)
    if (opsi.length > 0) state.opsiGambar = opsi
    state.jawabanGambar = teksAman(kunci.benar) || (state.opsiGambar[0]?.id ?? '')
  }

  if (soal.tipe === TIPE.urutGambar) {
    const item = daftarMedia(konten.item)
    const urutan = daftarTeks(kunci.urutan)
    if (item.length > 0) {
      state.itemGambar = item.map((satu) => {
        const posisi = urutan.indexOf(satu.id)
        return { ...satu, posisi: String(posisi === -1 ? '' : posisi + 1) }
      })
    }
  }

  if (soal.tipe === TIPE.susunHuruf) {
    state.petunjuk = teksAman(konten.petunjuk)
    state.kataSusun = teksAman(kunci.kata)
  }

  if (soal.tipe === TIPE.isianRumpang) {
    /** @type {Record<string, string>} */
    const lubang = {}
    const sumber = kunci.lubang

    if (sumber !== null && typeof sumber === 'object' && !Array.isArray(sumber)) {
      for (const [kode, daftar] of Object.entries(/** @type {Record<string, unknown>} */ (sumber))) {
        lubang[kode] = daftarTeks(daftar).join(', ')
      }
    }

    if (Object.keys(lubang).length > 0) state.lubang = lubang
  }

  if (soal.tipe === TIPE.klasifikasi) {
    const item = daftarAman(konten.item)
    if (item.length > 0) state.itemKlasifikasi = item

    // Kotak memakai `label` di konten (bukan `teks`), jadi tidak bisa lewat
    // daftarAman: kalau salah baca, label hilang saat soal dibuka lagi.
    const kotak = Array.isArray(konten.kotak)
      ? konten.kotak
          .filter((satu) => satu !== null && typeof satu === 'object')
          .map((satu) => {
            const rekaman = /** @type {Record<string, unknown>} */ (satu)
            return { id: teksAman(rekaman.id), teks: teksAman(rekaman.label) }
          })
      : []

    if (kotak.length > 0) state.kotak = kotak
    state.petaKlasifikasi = rekamanTeks(kunci.peta)
  }

  if (soal.tipe === TIPE.tabelIsian) {
    state.kolom = daftarTeks(konten.kolom).join(', ')

    const baris = Array.isArray(konten.baris) ? konten.baris : []
    /** @type {({ id: string, sel: ({ kode: string, teks: string })[] })[]} */
    const barisTabel = []

    for (const satu of baris) {
      if (satu === null || typeof satu !== 'object') continue
      const rekaman = /** @type {Record<string, unknown>} */ (satu)
      const sel = Array.isArray(rekaman.sel) ? rekaman.sel : []
      barisTabel.push({
        id: teksAman(rekaman.id),
        sel: sel
          .filter((isi) => isi !== null && typeof isi === 'object')
          .map((isi) => {
            const isiRekaman = /** @type {Record<string, unknown>} */ (isi)
            return { kode: teksAman(isiRekaman.kode), teks: teksAman(isiRekaman.teks) }
          }),
      })
    }

    if (barisTabel.length > 0) state.barisTabel = barisTabel

    /** @type {Record<string, string>} */
    const kunciSel = {}
    const sumberSel = kunci.sel

    if (sumberSel !== null && typeof sumberSel === 'object' && !Array.isArray(sumberSel)) {
      for (const [kode, daftar] of Object.entries(/** @type {Record<string, unknown>} */ (sumberSel))) {
        kunciSel[kode] = daftarTeks(daftar).join(', ')
      }
    }

    state.kunciSel = kunciSel
  }

  if (soal.tipe === TIPE.hotspotGambar) {
    const area = Array.isArray(konten.area) ? konten.area : []

    if (area.length > 0) {
      state.areaHotspot = area
        .filter((satu) => satu !== null && typeof satu === 'object')
        .map((satu) => {
          const rekaman = /** @type {Record<string, unknown>} */ (satu)
          return {
            id: teksAman(rekaman.id),
            x: pecahanKePersen(rekaman.x),
            y: pecahanKePersen(rekaman.y),
            w: pecahanKePersen(rekaman.w),
            h: pecahanKePersen(rekaman.h),
          }
        })
    }

    state.benarHotspot = daftarTeks(kunci.area_benar)
  }

  if (soal.tipe === TIPE.bacaJam) {
    state.jamJam = kunci.jam === undefined || kunci.jam === null ? '0' : String(kunci.jam)
    state.jamMenit = kunci.menit === undefined || kunci.menit === null ? '0' : String(kunci.menit)
  }

  if (soal.tipe === TIPE.tugasUnggah) {
    state.jenisBerkas = teksAman(konten.jenis_berkas)

    const rubrik = Array.isArray(kunci.rubrik) ? kunci.rubrik : []
    const barisRubrik = rubrik
      .filter((satu) => satu !== null && typeof satu === 'object')
      .map((satu) => {
        const rekaman = /** @type {Record<string, unknown>} */ (satu)
        return {
          butir: teksAman(rekaman.butir),
          poin: rekaman.poin === undefined || rekaman.poin === null ? '' : String(rekaman.poin),
        }
      })

    if (barisRubrik.length > 0) state.rubrik = barisRubrik
  }

  if (soal.tipe === TIPE.tekaSilangMini) {
    const grid = Array.isArray(konten.grid) ? konten.grid : []
    const huruf = rekamanTeks(kunci.sel)

    if (grid.length > 0) {
      state.gridSilang = grid
        .map((baris, r) =>
          Array.isArray(baris)
            ? baris
                .map((kotak, c) => (kotak === '#' ? '#' : (huruf[kodeSilang(r, c)] ?? '.')))
                .join('')
            : '',
        )
        .join('\n')
    }

    /** @type {{ arah: string, nomor: string, teks: string, mulai: string, panjang: string }[]} */
    const petunjuk = []

    for (const [arah, nama] of [['mendatar', 'mendatar'], ['menurun', 'menurun']]) {
      const daftar = Array.isArray(konten[nama]) ? konten[nama] : []

      for (const satu of daftar) {
        if (satu === null || typeof satu !== 'object') continue
        const rekaman = /** @type {Record<string, unknown>} */ (satu)
        const sel = daftarTeks(rekaman.sel)

        petunjuk.push({
          arah,
          nomor: rekaman.nomor === undefined || rekaman.nomor === null ? '' : String(rekaman.nomor),
          teks: teksAman(rekaman.teks),
          mulai: sel[0] ?? '',
          panjang: String(sel.length),
        })
      }
    }

    if (petunjuk.length > 0) state.petunjukSilang = petunjuk
  }

  if (soal.tipe === TIPE.garisBilangan) {
    state.garisMin = konten.min === undefined || konten.min === null ? state.garisMin : String(konten.min)
    state.garisMax = konten.max === undefined || konten.max === null ? state.garisMax : String(konten.max)
    state.garisLangkah =
      konten.langkah === undefined || konten.langkah === null ? state.garisLangkah : String(konten.langkah)
    state.garisNilai = kunci.nilai === undefined || kunci.nilai === null ? '' : String(kunci.nilai)
    state.garisToleransi =
      kunci.toleransi === undefined || kunci.toleransi === null ? '0' : String(kunci.toleransi)
  }

  return state
}

/**
 * @typedef {{
 *   subject_id: number,
 *   tag_id: number|null,
 *   tipe: string,
 *   konten: Record<string, unknown>,
 *   kunci: Record<string, unknown>,
 *   pembahasan: string,
 *   skor: number,
 *   aktif: boolean,
 * }} MuatanSoal
 */

/**
 * Muatan siap kirim ke API /soal.
 * @param {StateSoal} state
 * @returns {MuatanSoal}
 */
export function muatanDariState(state) {
  return {
    subject_id: Number(state.subject_id),
    tag_id: state.tag_id === '' ? null : Number(state.tag_id),
    tipe: state.tipe,
    konten: kontenDariState(state),
    kunci: kunciDariState(state),
    pembahasan: state.pembahasan.trim(),
    skor: Number(state.skor),
    aktif: state.aktif,
  }
}
