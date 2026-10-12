/**
 * Perjalanan materi (tema + langkah) — helper murni.
 *
 * Materi bukan cuma urutan blok: tiap blok adalah satu LANGKAH perjalanan yang
 * dilihat anak sebagai peta beranimasi (mis. tema "Mendaki Gunung": basecamp →
 * jalur pinus → … → puncak). Berkas ini memegang dua hal yang harus sama persis
 * dengan server:
 *
 * 1. **Nama langkah bawaan** dari tema, termasuk kelanjutan "Pos n" bila klip
 *    lebih banyak daripada fase tema (lihat Registry\TemaPerjalanan di backend).
 * 2. **Posisi, persentase, dan kenaikan tingkat** — dihitung dari langkah WAJIB,
 *    sedangkan langkah opsional tetap tampil sebagai jalan pintas di peta.
 *
 * Dipakai editor (pratinjau sebelum disimpan, jadi tidak boleh menunggu server)
 * dan layar murid (datanya dari server, divalidasi Zod). Hitungan server tetap
 * penentu; yang di sini hanya tampilan.
 */
import { z } from 'zod'

/** Rasi bingkai peta perjalanan (lebar/tinggi) supaya titik pos tidak meleset. */
export const RASIO_PETA = 16 / 9

/** Batas panjang nama langkah — sama dengan batas di server. */
export const MAKS_NAMA_LANGKAH = 40

/** Satu POS di peta perjalanan. */
export const skemaLangkahPerjalanan = z.object({
  block_id: z.number().nullable().optional(),
  nomor: z.number(),
  nama: z.string(),
  ikon: z.string(),
  warna: z.string(),
  bawaan: z.string().optional(),
  wajib: z.boolean(),
  status: z.string(),
  selesai: z.boolean(),
})

/** Tingkat (kenaikan) yang sedang dipegang murid. */
export const skemaTingkatPerjalanan = z.object({
  nomor: z.number(),
  nama: z.string(),
  min: z.number(),
  puncak: z.boolean(),
})

/** Seluruh peta perjalanan seorang murid (tema + pos + tingkat). */
export const skemaPerjalanan = z.object({
  kode: z.string(),
  nama: z.string(),
  // `true` = materi tanpa peta (daftar bagian biasa); peta tidak digambar.
  tanpa: z.boolean(),
  adegan: z.string(),
  satuan: z.string(),
  deskripsi: z.string().optional(),
  video_url: z.string().nullable(),
  langkah: z.array(skemaLangkahPerjalanan),
  jumlah_langkah: z.number(),
  posisi: z.number(),
  selesai: z.number(),
  total: z.number(),
  persen: z.number(),
  tuntas: z.boolean(),
  tingkat: skemaTingkatPerjalanan,
  tingkat_berikut: z
    .object({ nomor: z.number(), nama: z.string(), min: z.number(), sisa: z.number() })
    .nullable(),
})

/** Satu fase bawaan tema (mis. "Basecamp"). */
export const skemaFaseTema = z.object({
  nama: z.string(),
  ikon: z.string(),
  warna: z.string(),
})

/** Satu tingkat (kenaikan) bawaan tema. */
export const skemaTingkatKatalog = z.object({
  nomor: z.number(),
  nama: z.string(),
  min: z.number(),
})

/** Satu template tema perjalanan dari katalog server. */
export const skemaTemaKatalog = z.object({
  kode: z.string(),
  nama: z.string(),
  deskripsi: z.string(),
  adegan: z.string(),
  satuan: z.string(),
  fase: z.array(skemaFaseTema),
  tingkat: z.array(skemaTingkatKatalog),
})

/**
 * Konfigurasi tema yang menempel pada materi guru (MateriResource.perjalanan):
 * katalog + pilihan guru (nama ganti, video latar).
 */
export const skemaKonfigurasiTema = skemaTemaKatalog.extend({
  video_kode: z.string().nullable(),
  // `true` = tema "tanpa peta" dipilih guru.
  tanpa: z.boolean(),
})

/** Pilihan tema yang tersimpan di materi (guru boleh mengganti namanya). */
export const skemaTemaMateri = z.object({
  kode: z.string().nullable(),
  nama: z.string().nullable(),
  video_kode: z.string().nullable(),
})

/**
 * @typedef {z.infer<typeof skemaPerjalanan>} DataPerjalanan
 * @typedef {z.infer<typeof skemaLangkahPerjalanan>} DataLangkah
 * @typedef {z.infer<typeof skemaTemaKatalog>} DataTemaKatalog
 * @typedef {z.infer<typeof skemaKonfigurasiTema>} DataKonfigurasiTema
 */

/**
 * Kode tema "tanpa peta": materi berjalan sebagai daftar bagian biasa — tanpa
 * pos, tingkat, atau peta. Sama dengan `TemaPerjalanan::TANPA` di server.
 */
export const KODE_TANPA_PETA = 'tanpa'

/**
 * Nama langkah lanjutan bila klip lebih banyak daripada fase tema.
 *
 * Mengikuti **satuan tema**, sama seperti server: "Pos 7" untuk tema pendakian,
 * "Bagian 3" untuk materi tanpa peta — jadi pratinjau editor tidak pernah
 * menulis nama yang berbeda dari yang dikirim server.
 *
 * @param {string|undefined|null} satuan
 * @param {number} indeks
 * @returns {string}
 */
function namaLanjutan(satuan, indeks) {
  const kata = (satuan ?? '').trim() || TEMA_CADANGAN.satuan

  return `${kata.charAt(0).toUpperCase()}${kata.slice(1)} ${indeks + 1}`
}

/**
 * Materi berjalan sebagai daftar bagian biasa (guru memilih tema "tanpa").
 *
 * Menerima konfigurasi server (`tanpa`) maupun satu entri katalog tema (yang
 * hanya punya `kode`), supaya editor dan layar murid memakai aturan yang sama.
 *
 * @param {{ kode?: string|null, tanpa?: boolean }|undefined|null} tema
 * @returns {boolean}
 */
export function tanpaPeta(tema) {
  if (!tema) return false

  return tema.tanpa === true || tema.kode === KODE_TANPA_PETA
}

/** Fase cadangan bila katalog belum termuat (editor baru dibuka). */
export const TEMA_CADANGAN = /** @type {DataTemaKatalog} */ ({
  kode: 'mendaki-gunung',
  nama: 'Mendaki Gunung',
  deskripsi: '',
  adegan: 'gunung',
  satuan: 'pos',
  fase: [],
  tingkat: [],
})

/**
 * Nama, ikon, dan warna untuk langkah ke-`indeks` (0-based).
 *
 * Guru boleh mengganti nama satu langkah; bila kosong, nama bawaan tema yang
 * dipakai. Klip yang melebihi daftar fase melanjutkan dengan "Pos n" supaya
 * tidak ada pos tanpa nama.
 *
 * @param {DataTemaKatalog|undefined|null} tema
 * @param {number} indeks
 * @param {string|null|undefined} [namaGanti] nama dari klip (isi.fase)
 * @returns {{ nama: string, ikon: string, warna: string, bawaan: string, diubah: boolean }}
 */
export function faseKe(tema, indeks, namaGanti) {
  const daftar = tema?.fase ?? []
  const bawaan = daftar[indeks]
  const namaBawaan = bawaan?.nama ?? namaLanjutan(tema?.satuan, indeks)
  const ikonBawaan = bawaan?.ikon ?? 'tanda'
  const warnaBawaan = bawaan?.warna ?? 'kelabu'
  const nama = typeof namaGanti === 'string' ? namaGanti.trim() : ''

  if (nama === '') {
    return { nama: namaBawaan, ikon: ikonBawaan, warna: warnaBawaan, bawaan: namaBawaan, diubah: false }
  }

  return {
    nama: nama.slice(0, MAKS_NAMA_LANGKAH),
    ikon: ikonBawaan,
    warna: warnaBawaan,
    bawaan: namaBawaan,
    diubah: true,
  }
}

/**
 * Isi nama langkah tiap klip dari fase bawaan tema; guru tetap boleh mengubahnya
 * satu per satu sesudahnya.
 *
 * @template {{ fase?: string }} T
 * @param {T[]} blok
 * @param {DataTemaKatalog|undefined|null} tema
 * @returns {T[]}
 */
export function terapkanTema(blok, tema) {
  return blok.map((satu, indeks) => ({ ...satu, fase: faseKe(tema, indeks, '').nama }))
}

/**
 * Langkah-langkah perjalanan dari susunan klip yang BELUM disimpan (pratinjau
 * editor): bentuknya sama dengan langkah dari server, statusnya "belum".
 *
 * @param {import('./editorMateri.js').BarisBlok[]} blok
 * @param {DataTemaKatalog|undefined|null} tema
 * @returns {DataLangkah[]}
 */
export function langkahLokal(blok, tema) {
  return blok.map((satu, indeks) => {
    const fase = faseKe(tema, indeks, satu.fase)

    return {
      block_id: null,
      nomor: indeks + 1,
      nama: fase.nama,
      ikon: fase.ikon,
      warna: fase.warna,
      bawaan: fase.bawaan,
      wajib: satu.wajib,
      status: 'belum',
      selesai: false,
    }
  })
}

/**
 * Tingkat (kenaikan) untuk persentase tertentu — cerminan `TemaPerjalanan::tingkat`.
 * @param {DataTemaKatalog|undefined|null} tema
 * @param {number} persen
 * @returns {{ nomor: number, nama: string, min: number, puncak: boolean, berikut: { nomor: number, nama: string, min: number, sisa: number }|null }}
 */
export function tingkatKe(tema, persen) {
  const daftar = tema?.tingkat ?? []
  const angka = Math.max(0, Math.min(100, Math.round(persen)))

  if (daftar.length === 0) {
    return { nomor: 1, nama: 'Pendaki', min: 0, puncak: angka >= 100, berikut: null }
  }

  /** @type {{ nomor: number, nama: string, min: number }} */
  let kini = daftar[0]
  /** @type {{ nomor: number, nama: string, min: number }|null} */
  let berikut = null

  daftar.forEach((satu, indeks) => {
    if (angka >= satu.min) {
      kini = satu
      berikut = daftar[indeks + 1] ?? null
    }
  })

  const lanjut = /** @type {{ nomor: number, nama: string, min: number }|null} */ (berikut)

  return {
    nomor: kini.nomor,
    nama: kini.nama,
    min: kini.min,
    puncak: angka >= 100,
    berikut:
      lanjut === null
        ? null
        : { nomor: lanjut.nomor, nama: lanjut.nama, min: lanjut.min, sisa: Math.max(0, lanjut.min - angka) },
  }
}

/**
 * Peta perjalanan dari klip yang belum disimpan (pratinjau editor).
 *
 * Aturannya sama dengan server: kenaikan dihitung dari langkah WAJIB; bila tidak
 * ada satupun langkah wajib, seluruh langkah yang dipakai.
 *
 * @param {import('./editorMateri.js').BarisBlok[]} blok
 * @param {DataTemaKatalog|undefined|null} tema
 * @param {{ nama?: string, videoUrl?: string|null }} [opsi]
 * @returns {DataPerjalanan}
 */
export function petaLokal(blok, tema, opsi = {}) {
  const langkah = langkahLokal(blok, tema)
  const dasar = langkah.filter((satu) => satu.wajib)
  const total = (dasar.length > 0 ? dasar : langkah).length
  // Pratinjau belum dikerjakan murid mana pun: persentase selalu nol, dan posisi
  // menunjuk pos pertama yang harus ditempuh.
  const persen = 0
  const tingkat = tingkatKe(tema, persen)
  const satuan = tema?.satuan ?? TEMA_CADANGAN.satuan

  return {
    kode: tema?.kode ?? TEMA_CADANGAN.kode,
    nama: opsi.nama?.trim() || tema?.nama || TEMA_CADANGAN.nama,
    tanpa: tanpaPeta(tema),
    adegan: tema?.adegan ?? TEMA_CADANGAN.adegan,
    satuan,
    deskripsi: tema?.deskripsi ?? '',
    video_url: opsi.videoUrl ?? null,
    langkah,
    jumlah_langkah: langkah.length,
    posisi: posisiAktif(langkah),
    selesai: 0,
    total,
    persen,
    tuntas: false,
    tingkat: { nomor: tingkat.nomor, nama: tingkat.nama, min: tingkat.min, puncak: tingkat.puncak },
    tingkat_berikut: tingkat.berikut,
  }
}

/**
 * Rute pos untuk **setiap tema**, dalam persen lebar/tinggi peta.
 *
 * Tiap titik adalah tempat pos benar-benar **berdiri di sesuatu**: di lereng
 * gunung, di dermaga/perahu/pantai/goa pulau, atau di landasan/Bumi/Saturnus/
 * Bulan. Daftar ini dipakai bersama oleh peta (untuk menggambar) dan oleh pagar
 * uji `__tests__/theme/latarTema.test.js` (untuk memastikan pos tidak berdiri di
 * ruang kosong) — jadi angka di sini tidak boleh menyimpang dari latarnya.
 *
 * Kenapa dulu pos pernah "di udara": jalur lama menaikkan pos secara lurus ke
 * `y = 12%` sementara puncak gunung ada di `y ≈ 39%`, sehingga pos terakhir (dan
 * tiap pos baru yang disisipkan lewat kuis di ujung materi) berdiri di langit,
 * di atas punggungan. Sekarang tiap rute berhenti **di** bentuk latarnya.
 *
 * `n` adalah nama tempat itu (dipakai uji & dokumen); koordinatnya yang
 * menentukan gambar.
 *
 * @type {Record<string, Array<{ x: number, y: number, n: string, di?: string }>>}
 */
export const RUTE_TEMA = {
  // Jalur pendakian berbelok-belok: basecamp kiri bawah → lereng kanan → lereng
  // kiri → punggung kanan → puncak. Tiap titik duduk **di bawah** garis
  // punggungan `public/tema/gunung.svg` (dari hasil ukur berkas itu, bukan dari
  // rumus): (6%,71%) ↔ 40 px · (88%,63%) ↔ 36 px · (38%,58%) ↔ 31 px ·
  // (64%,54%) ↔ 30 px · (50%,42%) ↔ 26 px di bawah punggungan — semuanya di
  // daratan, dan pos terakhir berdiri tepat di bawah puncak (punggungan puncak
  // ada di y≈39%).
  gunung: [
    { x: 6, y: 71, n: 'Basecamp', di: 'kaki lereng kiri' },
    { x: 88, y: 63, n: 'Jalur Pinus', di: 'lereng kanan' },
    { x: 38, y: 58, n: 'Sungai Deras', di: 'lereng kiri' },
    { x: 64, y: 54, n: 'Lereng Berbatu', di: 'punggung kanan' },
    { x: 50, y: 42, n: 'Puncak', di: 'puncak' },
  ],
  // Pelayaran mencari harta karun: dermaga → perahu → karang → pantai → hutan
  // kelapa → goa harta karun. Semua titik berada di atas benda yang digambar di
  // `public/tema/pulau.svg` (id `dermaga`, `perahu`, `karang`, `pantai`,
  // `hutan`, `goa`).
  pulau: [
    { x: 8, y: 84, n: 'Dermaga', di: 'dermaga' },
    { x: 26, y: 74, n: 'Perahu Layar', di: 'perahu' },
    { x: 46, y: 72, n: 'Karang', di: 'karang' },
    { x: 62, y: 62, n: 'Pantai Berpasir', di: 'pantai' },
    { x: 74, y: 50, n: 'Hutan Kelapa', di: 'hutan' },
    { x: 80, y: 41, n: 'Goa Harta Karun', di: 'goa' },
  ],
  // Peluncuran ke luar angkasa: landasan → tepi Bumi → sabuk asteroid → tepi
  // Saturnus → permukaan Bulan. Benda yang diinjak digambar di
  // `public/tema/angkasa.svg` (id `landasan`, `bumi`, `asteroid`, `saturnus`,
  // `bulan`).
  angkasa: [
    { x: 11, y: 79, n: 'Landasan Peluncuran', di: 'landasan' },
    { x: 26, y: 52, n: 'Orbit Bumi', di: 'bumi' },
    { x: 50, y: 50, n: 'Sabuk Asteroid', di: 'asteroid' },
    { x: 72, y: 33, n: 'Cincin Saturnus', di: 'saturnus' },
    { x: 86, y: 20, n: 'Bulan', di: 'bulan' },
  ],
}

/**
 * Kunci rute yang dipakai sebuah adegan; adegan tak dikenal memakai rute
 * pendakian (tema lama tidak boleh kehilangan jalurnya).
 *
 * @param {string|undefined|null} adegan
 * @returns {string}
 */
export function ruteUntuk(adegan) {
  return typeof adegan === 'string' && adegan in RUTE_TEMA ? adegan : 'gunung'
}

/**
 * Titik tiap pos pada peta (persen dari lebar/tinggi peta), di atas rute tema.
 *
 * Pos disebar **rata di sepanjang rute**, bukan dihitung dari rumus lereng:
 * dengan begitu menambah/menyisipkan satu bagian (mis. kuis di ujung materi)
 * hanya menggeser pos-pos lain di rute yang sama, dan tidak ada pos yang
 * terlempar ke langit seperti pada rumus lama (`y = 86 − maju × 74`).
 *
 * Jumlah pos boleh berbeda dari jumlah titik rute: rute diinterpolasi, jadi
 * materi 2 pos maupun 12 pos sama-sama berjalan dari tempat pertama ke tempat
 * terakhir temanya.
 *
 * @param {number} jumlah
 * @param {string|undefined|null} [adegan]
 * @returns {Array<{ x: number, y: number }>}
 */
export function titikJalur(jumlah, adegan) {
  const rute = RUTE_TEMA[ruteUntuk(adegan)]
  const banyak = Math.max(1, Math.floor(jumlah))
  const segmen = rute.length - 1

  if (banyak === 1) {
    const { x, y } = rute[0]
    return [{ x, y }]
  }

  /** Membulatkan ke 0,1 persen supaya koordinatnya sama dengan gaya berkas lama. @param {number} angka */
  const bulat = (angka) => Math.round(angka * 10) / 10
  const titik = []

  for (let indeks = 0; indeks < banyak; indeks++) {
    const posisi = (indeks / (banyak - 1)) * segmen
    const kiri = rute[Math.floor(posisi)] ?? rute[segmen]
    const kanan = rute[Math.min(Math.floor(posisi) + 1, segmen)]
    const sisa = posisi - Math.floor(posisi)

    titik.push({
      x: bulat(kiri.x + (kanan.x - kiri.x) * sisa),
      y: bulat(kiri.y + (kanan.y - kiri.y) * sisa),
    })
  }

  return titik
}

/**
 * Nomor pos yang sedang ditempuh: langkah wajib pertama yang belum selesai.
 * Bila semua wajib sudah selesai, pos terakhir yang wajib (penanda sudah di
 * puncak jalur).
 *
 * @param {DataLangkah[]} langkah
 * @returns {number} 0 bila tidak ada langkah sama sekali
 */
export function posisiAktif(langkah) {
  const dasar = langkah.filter((satu) => satu.wajib)
  const dipakai = dasar.length > 0 ? dasar : langkah

  if (dipakai.length === 0) return 0

  const tertunda = dipakai.find((satu) => !satu.selesai)

  return tertunda === undefined ? dipakai[dipakai.length - 1].nomor : tertunda.nomor
}

/**
 * Peristiwa kenaikan antara dua peta perjalanan (sebelum dan sesudah satu
 * langkah selesai). Dipakai untuk menampilkan pesan "naik ke pos …" dan "naik
 * tingkat …" di layar murid — perayaannya hanya muncul saat benar-benar naik.
 *
 * @param {DataPerjalanan|undefined|null} lama
 * @param {DataPerjalanan|undefined|null} baru
 * @returns {{ jenis: 'puncak'|'tingkat'|'langkah'|'tuntas'|'bagian', judul: string, pesan: string }|null}
 */
export function kenaikanUntuk(lama, baru) {
  if (!lama || !baru) return null

  // Materi tanpa peta tidak punya tingkat maupun kiasan pendakian: pesannya
  // memakai kata "bagian" apa adanya, tidak menyebut puncak/pos.
  if (baru.tanpa) {
    if (baru.selesai <= lama.selesai) return null

    if (baru.total > 0 && baru.selesai >= baru.total) {
      return {
        jenis: 'tuntas',
        judul: `${baru.total} ${baru.satuan} wajib selesai!`,
        pesan: 'Semua bagian wajib materi ini sudah kamu selesaikan.',
      }
    }

    return {
      jenis: 'bagian',
      judul: `${baru.satuan.charAt(0).toUpperCase()}${baru.satuan.slice(1)} ${baru.selesai} dari ${baru.total} selesai`,
      pesan: 'Lanjut ke bagian berikutnya.',
    }
  }

  if (baru.tuntas && !lama.tuntas) {
    return {
      jenis: 'puncak',
      judul: `${baru.nama} tuntas!`,
      pesan: `Semua ${baru.total} ${baru.satuan} wajib sudah kamu lewati. Kamu sampai di puncak.`,
    }
  }

  if (baru.tingkat.nomor > lama.tingkat.nomor) {
    return {
      jenis: 'tingkat',
      judul: `Naik tingkat: ${baru.tingkat.nama}`,
      pesan: `${baru.selesai} dari ${baru.total} ${baru.satuan} wajib selesai. Terus mendaki!`,
    }
  }

  if (baru.posisi > lama.posisi) {
    const pos = baru.langkah.find((satu) => satu.nomor === baru.posisi)

    return {
      jenis: 'langkah',
      judul: `Naik ke ${baru.satuan} ${baru.posisi}${pos ? `: ${pos.nama}` : ''}`,
      pesan: pos?.wajib === false ? 'Kamu menyusuri jalan pintas yang opsional.' : 'Satu langkah lagi selesai.',
    }
  }

  return null
}

/**
 * Keterangan singkat posisi: "Pos 3 dari 6" (satuan mengikuti tema).
 *
 * @param {DataPerjalanan|undefined|null} peta
 * @returns {string}
 */
export function labelPerjalanan(peta) {
  if (!peta || peta.jumlah_langkah === 0) return 'Belum ada langkah'

  return `${peta.satuan} ${peta.posisi} dari ${peta.jumlah_langkah}`
}
