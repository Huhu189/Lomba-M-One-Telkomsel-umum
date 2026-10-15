/**
 * Pembaca berkas kantor (`.docx`/`.pptx`/`.xlsx`) langsung di peramban, supaya
 * materi **ditunjukkan** kepada murid alih-alih disuruh diunduh dulu
 * (14 Oktober 2026).
 *
 * Kenapa begini: guru SD mengunggah PowerPoint/Word sebagai bahan ajar, dan
 * peramban memang tidak bisa menggambar berkas itu sendiri. Sebelum ini murid
 * hanya mendapat tombol "Buka dokumen" — di ponsel artinya berkas terunduh dulu
 * lalu dicari di folder unduhan, padahal yang diminta adalah membacanya di
 * halaman. Berkas OOXML sebetulnya arsip ZIP berisi XML, dan `jszip` sudah
 * dipakai proyek ini, jadi isinya bisa dibaca langsung: teks paragraf, butir,
 * tabel, dan gambar.
 *
 * Yang **tidak** dilakukan (dan tidak mungkin tanpanya): menggambar ulang tata
 * letak, tema, animasi, bagan, atau rumus. Pratinjau ini sederhana dengan sadar
 * — teks, tabel, gambar — dan berkas aslinya tetap bisa dibuka lewat tautan di
 * bawah pratinjau.
 *
 * Fungsi di sini tidak menyentuh DOM tampilan maupun URL objek; ia hanya
 * membaca ZIP dan mengembalikan struktur data (gambar dikembalikan sebagai
 * byte), jadi bisa diuji tanpa React.
 */
/** Jenis dokumen yang bisa dipratinjau. */
export const JENIS = ['word', 'powerpoint', 'excel']

/** Berkas yang sempat dibuka: batasnya untuk menjaga laptop sekolah, bukan teoretis. */
const MAKS_BLOK = 400
const MAKS_BARIS = 200
const MAKS_KOLOM = 20
const MAKS_LEMBAR = 8
const MAKS_SLIDE = 120
const MAKS_GAMBAR = 24
const MAKS_UKURAN_GAMBAR = 6 * 1024 * 1024

/**
 * @typedef {{ kunci: string, nama: string, tipe: string, data: Uint8Array }} GambarBerkas
 * @typedef {{ nomor: number, judul: string, butir: { teks: string, tingkat: number }[], gambar: GambarBerkas[] }} SlideDokumen
 * @typedef {{ nama: string, baris: string[][], terpotong: boolean }} LembarDokumen
 * @typedef {{
 *   tipe: 'paragraf'|'tabel'|'gambar',
 *   teks?: string,
 *   gaya?: 'judul'|'normal',
 *   poin?: boolean,
 *   baris?: string[][],
 *   kunci?: string,
 *   gambar?: GambarBerkas|null,
 * }} BlokDokumen
 * @typedef {{
 *   jenis: 'word'|'powerpoint'|'excel',
 *   blok?: BlokDokumen[],
 *   slide?: SlideDokumen[],
 *   lembar?: LembarDokumen[],
 * }} HasilOOXML
 */

/* ------------------------------------------------------------------ utilitas DOM XML */

/**
 * Nama elemen/atribut tanpa awalan namespace (`w:p` → `p`), huruf kecil supaya
 * perbandingan tidak bergantung pada kapitalisasi berkas OOXML.
 * @param {Node} node
 * @returns {string}
 */
function nama(node) {
  const penuh = node.nodeName
  const pisah = penuh.indexOf(':')
  return (pisah === -1 ? penuh : penuh.slice(pisah + 1)).toLowerCase()
}

/** @param {Node} node @returns {Element[]} */
function anakElemen(node) {
  /** @type {Element[]} */
  const daftar = []
  for (const satu of node.childNodes) {
    if (satu.nodeType === 1) daftar.push(/** @type {Element} */ (satu))
  }
  return daftar
}

/** @param {Element} node @param {string} cari @returns {Element[]} */
function anak(node, cari) {
  return anakElemen(node).filter((satu) => nama(satu) === cari)
}

/** @param {Element} node @param {string} cari @returns {Element|null} */
function anakSatu(node, cari) {
  return anak(node, cari)[0] ?? null
}

/** @param {Element} node @param {string} cari @returns {Element[]} */
function turunan(node, cari) {
  /** @type {Element[]} */
  const daftar = []
  for (const satu of node.getElementsByTagName('*')) {
    if (nama(satu) === cari) daftar.push(satu)
  }
  return daftar
}

/** @param {Element} node @param {string} cari @returns {Element|null} */
function turunanSatu(node, cari) {
  return turunan(node, cari)[0] ?? null
}

/**
 * Atribut polos (tanpa awalan namespace), mis. `TargetMode` atau `r` pada sel.
 * @param {Element} node @param {string} cari
 * @returns {string|null}
 */
function attr(node, cari) {
  for (const satu of node.attributes) {
    if (satu.nodeName.indexOf(':') === -1 && nama(satu) === cari) return satu.value
  }
  return null
}

/**
 * Atribut berawalan namespace, mis. `r:embed` pada gambar atau `r:id` pada
 * rujukan. Perlu dipisah dari `attr` karena `<p:sldId id="256" r:id="rId2"/>`
 * punya dua atribut bernama `id`: yang polos nomor slide, yang berawalan
 * rujukan hubungan.
 * @param {Element} node @param {string} cari
 * @returns {string|null}
 */
function attrRujukan(node, cari) {
  for (const satu of node.attributes) {
    const pisah = satu.nodeName.indexOf(':')
    if (pisah !== -1 && satu.nodeName.slice(pisah + 1).toLowerCase() === cari) return satu.value
  }
  return null
}

/**
 * Atribut yang boleh ditulis polos maupun berawalan namespace: gaya paragraf
 * ditulis `w:val`, tetapi sebagian berkas menulisnya `val`. Dicoba polos dulu,
 * lalu yang berawalan — kecuali pada `sldId` yang punya dua `id` (lihat
 * `attrRujukan`).
 * @param {Element} node @param {string} cari
 * @returns {string|null}
 */
function attrNilai(node, cari) {
  return attr(node, cari) ?? attrRujukan(node, cari)
}

/**
 * Teks berjalan di dalam satu paragraf: `<…:t>` jadi teks, `<…:tab>` jadi tab,
 * `<…:br>`/`<…:cr>` jadi baris baru. Isi gambar/objek/field tidak ikut karena
 * yang ditampilkan hanya teksnya.
 * @param {Element} node @param {string[]} potongan
 */
function kumpulkanTeks(node, potongan) {
  for (const bagian of anakElemen(node)) {
    const sebutan = nama(bagian)
    if (sebutan === 't') potongan.push(bagian.textContent ?? '')
    else if (sebutan === 'tab') potongan.push('\t')
    else if (sebutan === 'br' || sebutan === 'cr') potongan.push('\n')
    else if (sebutan === 'instrtext' || sebutan === 'deltext') continue
    else if (sebutan === 'drawing' || sebutan === 'object' || sebutan === 'pict') continue
    else kumpulkanTeks(bagian, potongan)
  }
}

/** @param {Element} node @param {string} cari @returns {string} */
function teksAnak(node, cari) {
  const isi = anakSatu(node, cari)
  return isi === null ? '' : (isi.textContent ?? '')
}

/* ------------------------------------------------------------------ utilitas jalur & rels */

/** @param {string} jalur @returns {string} */
function rapikanJalur(jalur) {
  /** @type {string[]} */
  const bagian = []
  for (const potongan of jalur.split('/')) {
    if (potongan === '' || potongan === '.') continue
    if (potongan === '..') bagian.pop()
    else bagian.push(potongan)
  }
  return bagian.join('/')
}

/**
 * Jalur bagian OOXML dari target hubungan: target bisa relatif (`media/a.png`)
 * atau absolut (`/xl/worksheets/sheet1.xml`).
 * @param {string} dasar @param {string} target
 * @returns {string}
 */
function gabungJalur(dasar, target) {
  if (target.startsWith('/')) return rapikanJalur(target)
  return rapikanJalur(`${dasar}/${target}`)
}

/** @param {string} jalur @returns {string} */
function relsUntuk(jalur) {
  const pisah = jalur.lastIndexOf('/')
  return `${jalur.slice(0, pisah)}/_rels/${jalur.slice(pisah + 1)}.rels`
}

/** @param {string} jalur @returns {string} */
function dasarJalur(jalur) {
  const pisah = jalur.lastIndexOf('/')
  return pisah === -1 ? '' : jalur.slice(0, pisah)
}

/**
 * @param {import('jszip')} zip @param {string} jalur
 * @returns {Promise<Document|null>}
 */
async function bacaXml(zip, jalur) {
  const berkas = zip.file(jalur)
  if (berkas === null || typeof DOMParser === 'undefined') return null

  const isi = await berkas.async('string')
  const dok = new DOMParser().parseFromString(isi, 'application/xml')
  if (dok.getElementsByTagName('parsererror').length > 0) return null
  return dok
}

/**
 * Peta `rId` → jalur bagian di dalam ZIP. Target eksternal (tautan luar)
 * dilewati karena bukan berkas milik paket.
 * @param {import('jszip')} zip @param {string} jalurRels @param {string} dasar
 * @returns {Promise<Map<string, string>>}
 */
async function petaRels(zip, jalurRels, dasar) {
  /** @type {Map<string, string>} */
  const peta = new Map()
  const dok = await bacaXml(zip, jalurRels)
  if (dok === null) return peta

  for (const satu of turunan(dok.documentElement, 'relationship')) {
    const id = attr(satu, 'id')
    const target = attr(satu, 'target')
    if (id === null || target === null) continue
    if ((attrNilai(satu, 'targetmode') ?? '').toLowerCase() === 'external') continue
    peta.set(id, gabungJalur(dasar, target))
  }
  return peta
}

/* ------------------------------------------------------------------ gambar */

/** @param {string} jalur @returns {string|null} */
function tipeGambar(jalur) {
  const nama = jalur.toLowerCase()
  if (nama.endsWith('.png')) return 'image/png'
  if (nama.endsWith('.jpg') || nama.endsWith('.jpeg')) return 'image/jpeg'
  if (nama.endsWith('.gif')) return 'image/gif'
  if (nama.endsWith('.webp')) return 'image/webp'
  if (nama.endsWith('.bmp')) return 'image/bmp'
  if (nama.endsWith('.svg')) return 'image/svg+xml'
  // EMF/WMF/TIFF memang tidak bisa digambar peramban — lebih baik tidak
  // ditawarkan daripada menampilkan kotak rusak.
  return null
}

/**
 * Baca byte gambar dari ZIP. Gambar terlalu besar atau bertipe yang tidak bisa
 * digambar peramban dilewati, bukan digagalkan.
 * @param {import('jszip')} zip @param {string[]} rujukan
 * @returns {Promise<Map<string, GambarBerkas>>}
 */
async function bacaGambar(zip, rujukan) {
  /** @type {Map<string, GambarBerkas>} */
  const peta = new Map()

  for (const jalur of rujukan) {
    if (peta.size >= MAKS_GAMBAR) break
    if (peta.has(jalur)) continue

    const tipe = tipeGambar(jalur)
    if (tipe === null) continue

    const berkas = zip.file(jalur)
    if (berkas === null) continue

    const data = await berkas.async('uint8array')
    if (data.length > MAKS_UKURAN_GAMBAR) continue

    peta.set(jalur, { kunci: jalur, nama: jalur.split('/').pop() ?? jalur, tipe, data })
  }
  return peta
}

/**
 * Semua gambar pada hasil pembacaan, berurutan sesuai tampilannya. Dipakai
 * komponen untuk membuat URL objek sekali per gambar.
 * @param {HasilOOXML} hasil
 * @returns {GambarBerkas[]}
 */
export function gambarDalam(hasil) {
  /** @type {GambarBerkas[]} */
  const daftar = []
  /** @param {GambarBerkas|null} gambar */
  const tambah = (gambar) => {
    if (gambar === null || gambar === undefined) return
    if (daftar.some((satu) => satu.kunci === gambar.kunci)) return
    daftar.push(gambar)
  }

  for (const satu of hasil.blok ?? []) tambah(satu.gambar ?? null)
  for (const slide of hasil.slide ?? []) for (const gambar of slide.gambar) tambah(gambar)
  return daftar
}

/**
 * Benar bila tidak ada apa pun yang bisa ditampilkan (teks/tabel/butir kosong).
 * Gambar tidak dihitung: tanpa isi lain, pratinjau akan tampak rusak, dan lebih
 * baik jujur menyuruh murid membuka berkas aslinya.
 * @param {HasilOOXML} hasil
 * @returns {boolean}
 */
export function tanpaIsi(hasil) {
  const adaTeks =
    (hasil.blok ?? []).some((satu) =>
      satu.tipe === 'tabel'
        ? (satu.baris ?? []).some((baris) => baris.some((sel) => sel.trim() !== ''))
        : (satu.teks ?? '').trim() !== '',
    ) ||
    (hasil.slide ?? []).some(
      (satu) => satu.judul.trim() !== '' || satu.butir.some((butir) => butir.teks.trim() !== ''),
    ) ||
    (hasil.lembar ?? []).some((satu) =>
      satu.baris.some((baris) => baris.some((sel) => sel.trim() !== '')),
    )

  return !adaTeks
}

/* ------------------------------------------------------------------ Word */

/**
 * @param {Element} p @param {Map<string, string>} rels
 * @returns {{ teks: string, gaya: 'judul'|'normal', poin: boolean, gambar: string[] }}
 */
function paragrafWord(p, rels) {
  /** @type {string[]} */
  const potongan = []
  kumpulkanTeks(p, potongan)

  const elemenGaya = turunanSatu(p, 'pstyle')
  const namaGaya = elemenGaya === null ? '' : (attrNilai(elemenGaya, 'val') ?? '')

  /** @type {string[]} */
  const gambar = []
  for (const blip of turunan(p, 'blip')) {
    const rid = attrRujukan(blip, 'embed')
    const jalur = rid === null ? undefined : rels.get(rid)
    if (jalur !== undefined) gambar.push(jalur)
  }

  return {
    teks: potongan.join('').replace(/\s+$/u, ''),
    gaya: /heading|judul|title/iu.test(namaGaya) ? 'judul' : 'normal',
    poin: turunanSatu(p, 'numpr') !== null,
    gambar,
  }
}

/**
 * @param {Element} tbl @param {Map<string, string>} rels
 * @returns {string[][]}
 */
function tabelWord(tbl, rels) {
  /** @type {string[][]} */
  const baris = []

  for (const tr of anak(tbl, 'tr')) {
    if (baris.length >= MAKS_BARIS) break
    baris.push(
      anak(tr, 'tc')
        .slice(0, MAKS_KOLOM)
        .map((tc) => {
          const isiSel = anak(tc, 'p')
            .map((p) => paragrafWord(p, rels).teks)
            .filter((teks) => teks.trim() !== '')
          return isiSel.join('\n')
        }),
    )
  }
  return baris
}

/** @param {import('jszip')} zip @returns {Promise<HasilOOXML>} */
async function uraiWord(zip) {
  /** @type {BlokDokumen[]} */
  const blok = []
  const dok = await bacaXml(zip, 'word/document.xml')
  if (dok === null) return { jenis: 'word', blok: [] }

  const rels = await petaRels(zip, 'word/_rels/document.xml.rels', 'word')
  const badan = anakSatu(dok.documentElement, 'body') ?? dok.documentElement

  /** @type {string[]} */
  const rujukanGambar = []

  for (const bagian of anakElemen(badan)) {
    if (blok.length >= MAKS_BLOK) break
    const sebutan = nama(bagian)

    if (sebutan === 'p') {
      const paragraf = paragrafWord(bagian, rels)
      if (paragraf.teks.trim() !== '') {
        blok.push({
          tipe: 'paragraf',
          teks: paragraf.teks,
          gaya: paragraf.gaya,
          poin: paragraf.poin,
        })
      }
      for (const jalur of paragraf.gambar) {
        blok.push({ tipe: 'gambar', kunci: jalur })
        rujukanGambar.push(jalur)
      }
    } else if (sebutan === 'tbl') {
      const baris = tabelWord(bagian, rels)
      if (baris.length > 0) blok.push({ tipe: 'tabel', baris })
    }
  }

  // Byte gambar dibaca setelah struktur selesai supaya urutan blok tetap sama
  // dengan dokumennya.
  const petaGambar = await bacaGambar(zip, rujukanGambar)
  for (const satu of blok) {
    if (satu.tipe === 'gambar') satu.gambar = petaGambar.get(satu.kunci ?? '') ?? null
  }

  return { jenis: 'word', blok }
}

/* ------------------------------------------------------------------ PowerPoint */

/** @param {string} jalur @returns {number} */
function nomorBerkas(jalur) {
  const cocok = /(\d+)\.xml$/u.exec(jalur)
  return cocok === null ? 0 : Number(cocok[1])
}

/** @param {import('jszip')} zip @returns {string[]} */
function slideMenurutNomor(zip) {
  return Object.keys(zip.files)
    .filter((jalur) => /^ppt\/slides\/slide\d+\.xml$/u.test(jalur))
    .sort((a, b) => nomorBerkas(a) - nomorBerkas(b))
}

/** @param {Element} p @returns {number} */
function tingkatParagraf(p) {
  const ppr = anakSatu(p, 'ppr')
  const lvl = ppr === null ? null : attrNilai(ppr, 'lvl')
  const nilai = Number(lvl ?? '0')
  return Number.isFinite(nilai) ? Math.min(Math.max(nilai, 0), 4) : 0
}

/** @param {Element} p @returns {string} */
function teksParagraf(p) {
  /** @type {string[]} */
  const potongan = []
  kumpulkanTeks(p, potongan)
  return potongan.join('').replace(/\s+$/u, '')
}

/**
 * @param {import('jszip')} zip @param {string} jalur @param {number} nomor
 * @returns {Promise<SlideDokumen>}
 */
async function satuSlide(zip, jalur, nomor) {
  const dok = await bacaXml(zip, jalur)
  if (dok === null) return { nomor, judul: '', butir: [], gambar: [] }

  const rels = await petaRels(zip, relsUntuk(jalur), dasarJalur(jalur))
  let judul = ''
  /** @type {{ teks: string, tingkat: number }[]} */
  const butir = []

  for (const sp of turunan(dok.documentElement, 'sp')) {
    const badanTeks = turunanSatu(sp, 'txbody')
    if (badanTeks === null) continue

    const ph = turunanSatu(sp, 'ph')
    const sebagaiJudul = /title/iu.test(ph === null ? '' : (attrNilai(ph, 'type') ?? ''))

    for (const p of anak(badanTeks, 'p')) {
      const teks = teksParagraf(p)
      if (teks.trim() === '') continue
      if (sebagaiJudul && judul === '') judul = teks
      else butir.push({ teks, tingkat: tingkatParagraf(p) })
    }
  }

  /** @type {string[]} */
  const rujukanGambar = []
  for (const blip of turunan(dok.documentElement, 'blip')) {
    const rid = attrRujukan(blip, 'embed')
    const target = rid === null ? undefined : rels.get(rid)
    if (target !== undefined) rujukanGambar.push(target)
  }

  const petaGambar = await bacaGambar(zip, rujukanGambar)
  /** @type {GambarBerkas[]} */
  const gambar = []
  for (const satu of rujukanGambar) {
    const isi = petaGambar.get(satu)
    if (isi !== undefined) gambar.push(isi)
  }

  return { nomor, judul, butir, gambar }
}

/** @param {import('jszip')} zip @returns {Promise<HasilOOXML>} */
async function uraiPowerpoint(zip) {
  const dok = await bacaXml(zip, 'ppt/presentation.xml')
  const rels = await petaRels(zip, 'ppt/_rels/presentation.xml.rels', 'ppt')

  /** @type {string[]} */
  let urutan = []
  if (dok !== null) {
    for (const sldId of turunan(dok.documentElement, 'sldid')) {
      const rid = attrRujukan(sldId, 'id')
      const target = rid === null ? undefined : rels.get(rid)
      if (target !== undefined) urutan.push(target)
    }
  }
  // Tanpa daftar urutan (berkas buatan alat lain), nomor berkas slide yang
  // dipakai — jauh lebih baik daripada tidak menampilkan apa pun.
  if (urutan.length === 0) urutan = slideMenurutNomor(zip)

  /** @type {SlideDokumen[]} */
  const slide = []
  for (const [indeks, jalur] of urutan.slice(0, MAKS_SLIDE).entries()) {
    slide.push(await satuSlide(zip, jalur, indeks + 1))
  }
  return { jenis: 'powerpoint', slide }
}

/* ------------------------------------------------------------------ Excel */

/** @param {import('jszip')} zip @returns {Promise<string[]>} */
async function sharedStrings(zip) {
  /** @type {string[]} */
  const daftar = []
  const dok = await bacaXml(zip, 'xl/sharedStrings.xml')
  if (dok === null) return daftar

  for (const si of turunan(dok.documentElement, 'si')) {
    /** @type {string[]} */
    const potongan = []
    kumpulkanTeks(si, potongan)
    daftar.push(potongan.join(''))
  }
  return daftar
}

/**
 * Nomor kolom (0-based) dari rujukan sel `C7` (juga menerima `$C$7`).
 * @param {string|null} rujukan @returns {number|null}
 */
function indeksKolom(rujukan) {
  if (rujukan === null) return null
  const huruf = /^\$?([A-Za-z]+)/u.exec(rujukan)?.[1]
  if (huruf === undefined) return null

  let nilai = 0
  for (const karakter of huruf.toUpperCase()) {
    nilai = nilai * 26 + (karakter.charCodeAt(0) - 64)
  }
  return nilai - 1
}

/**
 * @param {Element} c @param {string[]} bersama @returns {string}
 */
function nilaiSel(c, bersama) {
  const tipe = (attrNilai(c, 't') ?? '').toLowerCase()

  if (tipe === 's') {
    const indeks = Number(teksAnak(c, 'v'))
    return bersama[indeks] ?? ''
  }
  if (tipe === 'inlinestr') {
    const isi = anakSatu(c, 'is')
    if (isi === null) return ''
    /** @type {string[]} */
    const potongan = []
    kumpulkanTeks(isi, potongan)
    return potongan.join('')
  }
  if (tipe === 'b') return teksAnak(c, 'v') === '1' ? 'Benar' : 'Salah'
  return teksAnak(c, 'v')
}

/**
 * @param {Element} root @param {string[]} bersama
 * @returns {{ baris: string[][], terpotong: boolean }}
 */
function barisLembar(root, bersama) {
  /** @type {string[][]} */
  const baris = []
  let terpotong = false
  const data = anakSatu(root, 'sheetdata') ?? root

  for (const row of anak(data, 'row')) {
    if (baris.length >= MAKS_BARIS) {
      terpotong = true
      break
    }

    // Baris kosong yang dilewati berkas tetap diisi supaya tabel tidak
    // "naik" dan isi kolomnya tidak salah posisi.
    const nomor = Number(attrNilai(row, 'r') ?? '')
    if (Number.isFinite(nomor)) {
      while (baris.length < nomor - 1 && baris.length < MAKS_BARIS) baris.push([])
    }

    /** @type {string[]} */
    const sel = []
    for (const c of anak(row, 'c')) {
      const kolom = indeksKolom(attrNilai(c, 'r'))
      const nilai = nilaiSel(c, bersama)
      if (kolom === null) {
        sel.push(nilai)
        continue
      }
      if (kolom >= MAKS_KOLOM) {
        terpotong = true
        continue
      }
      sel[kolom] = nilai
    }
    baris.push(sel)
  }

  const lebar = baris.reduce((maks, satu) => Math.max(maks, satu.length), 0)
  for (const satu of baris) {
    for (let i = 0; i < lebar; i += 1) if (satu[i] === undefined) satu[i] = ''
  }

  return { baris, terpotong }
}

/** @param {import('jszip')} zip @returns {string[]} */
function lembarMenurutNomor(zip) {
  return Object.keys(zip.files)
    .filter((jalur) => /^xl\/worksheets\/sheet\d+\.xml$/u.test(jalur))
    .sort((a, b) => nomorBerkas(a) - nomorBerkas(b))
}

/** @param {import('jszip')} zip @returns {Promise<HasilOOXML>} */
async function uraiExcel(zip) {
  const bersama = await sharedStrings(zip)
  const wb = await bacaXml(zip, 'xl/workbook.xml')
  const rels = await petaRels(zip, 'xl/_rels/workbook.xml.rels', 'xl')

  /** @type {{ nama: string, jalur: string }[]} */
  const daftar = []
  if (wb !== null) {
    for (const sheet of turunan(wb.documentElement, 'sheet')) {
      const rid = attrRujukan(sheet, 'id')
      const target = rid === null ? undefined : rels.get(rid)
      if (target !== undefined && target !== '') {
        daftar.push({ nama: attrNilai(sheet, 'name') ?? 'Lembar', jalur: target })
      }
    }
  }
  if (daftar.length === 0) {
    for (const jalur of lembarMenurutNomor(zip)) daftar.push({ nama: 'Lembar', jalur })
  }

  /** @type {LembarDokumen[]} */
  const lembar = []
  for (const satu of daftar.slice(0, MAKS_LEMBAR)) {
    const dok = await bacaXml(zip, satu.jalur)
    if (dok === null) {
      lembar.push({ nama: satu.nama, baris: [], terpotong: false })
      continue
    }
    const { baris, terpotong } = barisLembar(dok.documentElement, bersama)
    lembar.push({ nama: satu.nama, baris, terpotong })
  }

  return { jenis: 'excel', lembar }
}

/* ------------------------------------------------------------------ pintu masuk */

/**
 * Jenis dokumen kantor sebuah berkas, atau `null` bila bukan format OOXML yang
 * bisa dibaca peramban (mis. `.doc`/`.ppt`/`.xls` lama).
 *
 * Dibaca dari mime lebih dulu (server menetapkannya dari ISI berkas), lalu dari
 * ekstensi sebagai cadangan.
 * @param {{ mime?: string|null, nama?: string|null, nama_asli?: string|null }|null|undefined} berkas
 * @returns {'word'|'powerpoint'|'excel'|null}
 */
export function jenisOOXML(berkas) {
  const mime = `${berkas?.mime ?? ''}`.toLowerCase()
  const nama = `${berkas?.nama ?? berkas?.nama_asli ?? ''}`.toLowerCase()

  if (mime.includes('wordprocessingml') || nama.endsWith('.docx')) return 'word'
  if (mime.includes('presentationml') || nama.endsWith('.pptx')) return 'powerpoint'
  if (mime.includes('spreadsheetml') || nama.endsWith('.xlsx')) return 'excel'
  return null
}

/**
 * Baca isi berkas kantor menjadi struktur sederhana yang bisa digambar React.
 * @param {ArrayBuffer|Uint8Array} isi
 * @param {'word'|'powerpoint'|'excel'|null} jenis
 * @returns {Promise<HasilOOXML>}
 */
export async function uraiOOXML(isi, jenis) {
  if (jenis !== 'word' && jenis !== 'powerpoint' && jenis !== 'excel') {
    throw new Error('Jenis dokumen tidak dikenal')
  }

  // Dimuat saat dokumen benar-benar dipratinjau, bukan saat halaman materi
  // dibuka: kebanyakan materi tidak berisi berkas kantor.
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(isi)
  if (jenis === 'word') return uraiWord(zip)
  if (jenis === 'powerpoint') return uraiPowerpoint(zip)
  return uraiExcel(zip)
}
