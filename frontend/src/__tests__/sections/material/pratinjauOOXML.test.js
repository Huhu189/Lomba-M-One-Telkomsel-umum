// @vitest-environment jsdom
/**
 * Pembaca berkas kantor (Word/PowerPoint/Excel) di peramban — 14 Oktober 2026.
 *
 * Yang dijaga di sini: isi `.docx/.pptx/.xlsx` benar-benar terbaca sebagai teks,
 * butir, tabel, gambar, dan lembar — bukan sekadar "berhasil dibuka". Berkas
 * contoh dibuat sebagai ZIP sungguhan (jszip), jadi uji ini juga menangkap
 * kesalahan jalur bagian OOXML (mis. `word/media/…` yang salah diresolusi).
 *
 * Berkas OOXML punya banyak jalan buntu (format lama, isi rusak, tanpa gambar):
 * semua itu harus menghasilkan jawaban yang jujur, bukan lemparan tak tertangani.
 */
import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  gambarDalam,
  jenisOOXML,
  tanpaIsi,
  uraiOOXML,
} from '../../../sections/material/editor/pratinjauOOXML.js'

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'

/** @param {JSZip} zip @param {string} jalur @param {string} isi */
function tulisXml(zip, jalur, isi) {
  zip.file(jalur, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${isi}`)
}

/** @param {JSZip} zip @returns {Promise<ArrayBuffer>} */
function jadi(zip) {
  return zip.generateAsync({ type: 'arraybuffer' })
}

/** Dokumen Word: judul, dua butir, teks bertab & baris baru, gambar, tabel. */
async function zipWord() {
  const zip = new JSZip()

  tulisXml(
    zip,
    'word/document.xml',
    `<w:document xmlns:w="${NS_W}" xmlns:r="${NS_R}" xmlns:a="${NS_A}">
      <w:body>
        <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Bagian Akar</w:t></w:r></w:p>
        <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Akar menyerap air</w:t></w:r></w:p>
        <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Akar menahan tanah</w:t></w:r></w:p>
        <w:p><w:r><w:t>Batang</w:t><w:tab/><w:t>daun</w:t></w:r><w:r><w:br/><w:t>baris dua</w:t></w:r></w:p>
        <w:p><w:r><w:drawing><a:blip r:embed="rId9"/></w:drawing></w:r></w:p>
        <w:tbl>
          <w:tr><w:tc><w:p><w:r><w:t>Ciri</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Contoh</w:t></w:r></w:p></w:tc></w:tr>
          <w:tr><w:tc><w:p><w:r><w:t>Berakar</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Pohon</w:t></w:r></w:p></w:tc></w:tr>
        </w:tbl>
        <w:p/>
      </w:body>
    </w:document>`,
  )

  tulisXml(
    zip,
    'word/_rels/document.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/akar.png"/>
      <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://contoh.test" TargetMode="External"/>
    </Relationships>`,
  )

  zip.file('word/media/akar.png', new Uint8Array([137, 80, 78, 71]))
  return jadi(zip)
}

/** @param {string} judul @param {string} isiSlide */
function slidePptx(judul, isiSlide) {
  return `<p:sld xmlns:p="${NS_P}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">
    <p:cSld><p:spTree>
      <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:txBody><a:p><a:r><a:t>${judul}</a:t></a:r></a:p></p:txBody></p:sp>
      ${isiSlide}
    </p:spTree></p:cSld>
  </p:sld>`
}

/** Dekan PowerPoint: urutan slide dari presentation.xml (bukan nomor berkas). */
async function zipPptx() {
  const zip = new JSZip()

  tulisXml(
    zip,
    'ppt/presentation.xml',
    `<p:presentation xmlns:p="${NS_P}" xmlns:r="${NS_R}">
      <p:sldIdLst>
        <p:sldId id="256" r:id="rId2"/>
        <p:sldId id="257" r:id="rId3"/>
      </p:sldIdLst>
    </p:presentation>`,
  )

  tulisXml(
    zip,
    'ppt/_rels/presentation.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
      <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
      <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://contoh.test" TargetMode="External"/>
    </Relationships>`,
  )

  tulisXml(
    zip,
    'ppt/slides/slide1.xml',
    slidePptx(
      'Bagian Tumbuhan',
      `<p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody>
        <a:p><a:r><a:t>Akar menyerap air</a:t></a:r></a:p>
        <a:p><a:pPr lvl="1"/><a:r><a:t>Rambut akar</a:t></a:r></a:p>
        <a:p/>
      </p:txBody></p:sp>
      <p:pic><p:blipFill><a:blip r:embed="rId3"/></p:blipFill></p:pic>`,
    ),
  )

  tulisXml(
    zip,
    'ppt/slides/slide2.xml',
    slidePptx('Bagian Daun', '<p:sp><p:txBody><a:p><a:r><a:t>Daun membuat makanan</a:t></a:r></a:p></p:txBody></p:sp>'),
  )

  tulisXml(
    zip,
    'ppt/slides/_rels/slide1.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/gambar1.png"/>
    </Relationships>`,
  )

  zip.file('ppt/media/gambar1.png', new Uint8Array([1, 2, 3]))
  return jadi(zip)
}

/** Buku kerja Excel: dua lembar, string bersama, string inline, angka, baris bolong. */
async function zipXlsx() {
  const zip = new JSZip()

  tulisXml(
    zip,
    'xl/workbook.xml',
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${NS_R}">
      <sheets>
        <sheet name="Nilai" sheetId="1" r:id="rId1"/>
        <sheet name="Kosong" sheetId="2" r:id="rId2"/>
      </sheets>
    </workbook>`,
  )

  tulisXml(
    zip,
    'xl/_rels/workbook.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet2.xml"/>
    </Relationships>`,
  )

  tulisXml(
    zip,
    'xl/sharedStrings.xml',
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <si><t>Nama</t></si>
      <si><r><t>Skor</t></r><r><t> ujian</t></r></si>
    </sst>`,
  )

  tulisXml(
    zip,
    'xl/worksheets/sheet1.xml',
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="3"><c r="A3"><v>42</v></c><c r="B3" t="b"><v>1</v></c><c r="C3" t="inlineStr"><is><t>Selesai</t></is></c></row>
    </sheetData></worksheet>`,
  )

  tulisXml(
    zip,
    'xl/worksheets/sheet2.xml',
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`,
  )

  return jadi(zip)
}

describe('jenisOOXML', () => {
  it('mengenali jenis dari mime yang ditetapkan server', () => {
    expect(
      jenisOOXML({ mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }),
    ).toBe('powerpoint')
    expect(
      jenisOOXML({ mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    ).toBe('word')
    expect(
      jenisOOXML({ mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    ).toBe('excel')
  })

  it('memakai ekstensi sebagai cadangan, dan menolak format kantor lama', () => {
    expect(jenisOOXML({ nama: 'Bahan Ajar.PPTX' })).toBe('powerpoint')
    expect(jenisOOXML({ nama: 'catatan.doc', mime: 'application/msword' })).toBeNull()
    expect(jenisOOXML({ nama: 'arsip.pdf', mime: 'application/pdf' })).toBeNull()
  })
})

describe('uraiOOXML · Word', () => {
  it('membaca judul, butir, tabel, dan gambar sesuai urutan dokumen', async () => {
    const hasil = await uraiOOXML(await zipWord(), 'word')
    const blok = hasil.blok ?? []

    expect(hasil.jenis).toBe('word')
    expect(blok[0]).toMatchObject({ tipe: 'paragraf', teks: 'Bagian Akar', gaya: 'judul' })
    expect(blok[1]).toMatchObject({ tipe: 'paragraf', teks: 'Akar menyerap air', poin: true })
    expect(blok[2]).toMatchObject({ tipe: 'paragraf', teks: 'Akar menahan tanah', poin: true })
    // Tab dan baris baru dipertahankan supaya kalimatnya tidak menyatu.
    expect(blok[3]).toMatchObject({ tipe: 'paragraf', teks: 'Batang\tdaun\nbaris dua' })

    const gambar = blok[4]
    expect(gambar?.tipe).toBe('gambar')
    expect(gambar?.gambar?.kunci).toBe('word/media/akar.png')
    expect(gambar?.gambar?.tipe).toBe('image/png')

    expect(blok[5]).toMatchObject({
      tipe: 'tabel',
      baris: [
        ['Ciri', 'Contoh'],
        ['Berakar', 'Pohon'],
      ],
    })
    // Paragraf kosong tidak ikut jadi blok kosong.
    expect(blok).toHaveLength(6)
    expect(tanpaIsi(hasil)).toBe(false)
    expect(gambarDalam(hasil).map((satu) => satu.kunci)).toEqual(['word/media/akar.png'])
  })

  it('tidak menganggap dokumen tanpa isi teks sebagai ada isinya', async () => {
    const zip = new JSZip()
    tulisXml(zip, 'word/document.xml', `<w:document xmlns:w="${NS_W}"><w:body><w:p/></w:body></w:document>`)

    const hasil = await uraiOOXML(await jadi(zip), 'word')

    expect(tanpaIsi(hasil)).toBe(true)
  })
})

describe('uraiOOXML · PowerPoint', () => {
  it('mengikuti urutan slide dari presentation.xml, bukan nomor berkasnya', async () => {
    const hasil = await uraiOOXML(await zipPptx(), 'powerpoint')
    const slide = hasil.slide ?? []

    expect(slide.map((satu) => satu.judul)).toEqual(['Bagian Daun', 'Bagian Tumbuhan'])
    expect(slide[0]?.nomor).toBe(1)
  })

  it('memisahkan judul, butir (dengan tingkat), dan gambar', async () => {
    const hasil = await uraiOOXML(await zipPptx(), 'powerpoint')
    const kedua = (hasil.slide ?? [])[1]

    expect(kedua?.judul).toBe('Bagian Tumbuhan')
    expect(kedua?.butir).toEqual([
      { teks: 'Akar menyerap air', tingkat: 0 },
      { teks: 'Rambut akar', tingkat: 1 },
    ])
    expect(kedua?.gambar.map((satu) => satu.tipe)).toEqual(['image/png'])
    expect(tanpaIsi(hasil)).toBe(false)
  })

  it('tetap membaca slide bila urutan resminya tidak ada', async () => {
    const zip = new JSZip()
    tulisXml(zip, 'ppt/slides/slide2.xml', slidePptx('Kedua', ''))
    tulisXml(zip, 'ppt/slides/slide1.xml', slidePptx('Pertama', ''))

    const hasil = await uraiOOXML(await jadi(zip), 'powerpoint')

    expect((hasil.slide ?? []).map((satu) => satu.judul)).toEqual(['Pertama', 'Kedua'])
  })
})

describe('uraiOOXML · Excel', () => {
  it('membaca nama lembar, string bersama, string inline, dan angka', async () => {
    const hasil = await uraiOOXML(await zipXlsx(), 'excel')
    const lembar = hasil.lembar ?? []

    expect(lembar.map((satu) => satu.nama)).toEqual(['Nilai', 'Kosong'])
    // Lebar kolom disamakan antar baris supaya posisi isinya tetap lurus.
    expect(lembar[0]?.baris[0]).toEqual(['Nama', 'Skor ujian', ''])
    // Baris nomor 2 bolong di berkasnya: posisinya tetap dijaga.
    expect(lembar[0]?.baris[1]).toEqual(['', '', ''])
    expect(lembar[0]?.baris[2]).toEqual(['42', 'Benar', 'Selesai'])
    expect(lembar[1]?.baris).toEqual([])
    expect(tanpaIsi(hasil)).toBe(false)
  })

  it('lembar tanpa isi tidak dianggap berisi', async () => {
    const zip = new JSZip()
    tulisXml(
      zip,
      'xl/worksheets/sheet1.xml',
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`,
    )

    const hasil = await uraiOOXML(await jadi(zip), 'excel')

    expect(tanpaIsi(hasil)).toBe(true)
  })
})

describe('uraiOOXML · berkas bermasalah', () => {
  it('menolak isi yang bukan arsip ZIP', async () => {
    await expect(uraiOOXML(new TextEncoder().encode('bukan berkas kantor'), 'word')).rejects.toThrow()
  })

  it('menolak jenis yang tidak dikenal alih-alih menebak', async () => {
    await expect(uraiOOXML(new ArrayBuffer(8), null)).rejects.toThrow('Jenis dokumen tidak dikenal')
  })

  it('mengembalikan hasil kosong bila bagian utamanya hilang', async () => {
    const zip = new JSZip()
    zip.file('docProps/app.xml', '<Properties/>')

    const hasil = await uraiOOXML(await jadi(zip), 'powerpoint')

    expect(hasil.slide).toEqual([])
    expect(tanpaIsi(hasil)).toBe(true)
  })
})
