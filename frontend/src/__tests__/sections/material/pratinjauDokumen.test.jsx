// @vitest-environment jsdom
/**
 * Pratinjau dokumen kantor di halaman murid — 14 Oktober 2026.
 *
 * Permintaan pemilik produk: berkas PowerPoint/Word/Excel yang diunggah guru
 * **ditunjukkan** kepada murid, bukan disuruh diunduh dulu. Yang dijaga di sini:
 * berkasnya benar-benar dibaca dan digambar di halaman, berkas yang tidak bisa
 * dibaca memberi pesan jujur (bukan layar kosong), format kantor lama tetap
 * memakai tombol lama, dan tautan ke berkas aslinya selalu tersedia.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import JSZip from 'jszip'
import PratinjauDokumen from '../../../sections/material/PratinjauDokumen.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root
/** @type {typeof URL.createObjectURL} */
let asliBuatUrl
/** @type {typeof URL.revokeObjectURL} */
let asliLepasUrl

/** @param {import('../../../sections/material/PratinjauDokumen.jsx').BerkasPratinjau} berkas */
function pasang(berkas) {
  act(() => root.render(<PratinjauDokumen berkas={berkas} />))
}

/**
 * Menunggu efek (fetch → baca ZIP) selesai, tanpa gelombang `act` yang panjang.
 * @param {() => boolean} cek
 */
async function tungguSampai(cek) {
  for (let i = 0; i < 60; i += 1) {
    if (cek()) return
    await act(async () => {
      await new Promise((selesai) => setTimeout(selesai, 5))
    })
  }
}

/**
 * Berkas PowerPoint kecil yang berisi satu slide berjudul.
 * @param {string} judul
 */
async function pptxBerjudul(judul) {
  const zip = new JSZip()
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${judul}</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:t>Akar menyerap air</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:blipFill><a:blip r:embed="rId3" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>`,
  )
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/gambar1.png"/></Relationships>`,
  )
  zip.file('ppt/media/gambar1.png', new Uint8Array([137, 80, 78, 71]))
  return zip.generateAsync({ type: 'arraybuffer' })
}

/**
 * Tanggapan fetch tiruan. Dipakai apa adanya (tanpa `Response`) supaya uji ini
 * tidak bergantung pada implementasi fetch lingkungannya.
 * @param {{ ok?: boolean, status?: number, isi?: ArrayBuffer|Uint8Array }} ubah
 */
function tanggapan(ubah = {}) {
  const isi = ubah.isi ?? new ArrayBuffer(0)
  return {
    ok: ubah.ok ?? true,
    status: ubah.status ?? 200,
    arrayBuffer: async () => isi,
  }
}

beforeEach(() => {
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)

  // jsdom tidak membuat URL objek untuk Blob; dipalsukan supaya jalur gambar
  // (bukan hanya teksnya) ikut teruji.
  asliBuatUrl = URL.createObjectURL
  asliLepasUrl = URL.revokeObjectURL
  URL.createObjectURL = /** @type {typeof URL.createObjectURL} */ (
    vi.fn(() => 'blob:uji-gambar')
  )
  URL.revokeObjectURL = /** @type {typeof URL.revokeObjectURL} */ (vi.fn())
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  URL.createObjectURL = asliBuatUrl
  URL.revokeObjectURL = asliLepasUrl
  vi.unstubAllGlobals()
})

describe('PratinjauDokumen', () => {
  it('menampilkan isi PowerPoint di halaman, bukan menyuruh mengunduh', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => tanggapan({ isi: await pptxBerjudul('Bagian Tumbuhan') })),
    )

    pasang({
      url: '/api/v1/berkas/abc?signature=xyz',
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      nama: 'Bahan Ajar.pptx',
    })

    await tungguSampai(() => (wadah.textContent ?? '').includes('Bagian Tumbuhan'))

    const teks = wadah.textContent ?? ''
    expect(teks).toContain('Pratinjau PowerPoint')
    expect(teks).toContain('Bahan Ajar.pptx')
    expect(teks).toContain('Akar menyerap air')
    expect(wadah.querySelector('.pd-slide-satu')).not.toBeNull()
    // Gambar slide ikut digambar dari URL objek yang dibuat komponen.
    expect(wadah.querySelector('img.pd-gambar')?.getAttribute('src')).toBe('blob:uji-gambar')
    // Tautan berkas aslinya tetap ada sebagai cadangan.
    const tautan = /** @type {HTMLAnchorElement|null} */ (wadah.querySelector('a[href^="/api/"]'))
    expect(tautan?.getAttribute('href')).toContain('/api/v1/berkas/abc')
    // Dan tidak ada tombol unduh yang memaksa murid menyimpan dulu.
    expect(wadah.querySelector('a[download]')).toBeNull()
  })

  it('berkas rusak memberi pesan jujur beserta jalan keluarnya', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => tanggapan({ isi: new TextEncoder().encode('bukan arsip zip') })),
    )

    pasang({
      url: '/api/v1/berkas/rusak',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      nama: 'Rusak.docx',
    })

    await tungguSampai(() => (wadah.textContent ?? '').includes('gagal dibuka'))

    const teks = wadah.textContent ?? ''
    expect(teks).toContain('Pratinjau Word gagal dibuka')
    expect(teks).toContain('Buka Rusak.docx di tab baru')
  })

  it('penolakan server tidak ditampilkan sebagai pratinjau kosong', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => tanggapan({ ok: false, status: 403 })))

    pasang({
      url: '/api/v1/berkas/rahasia',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      nama: 'Nilai.xlsx',
    })

    await tungguSampai(() => (wadah.textContent ?? '').includes('gagal dibuka'))

    expect(wadah.textContent ?? '').toContain('Pratinjau Excel gagal dibuka')
  })

  it('format kantor lama tetap memakai tombol “Buka dokumen”', () => {
    const fetchTiruan = vi.fn()
    vi.stubGlobal('fetch', fetchTiruan)

    pasang({ url: '/api/v1/berkas/lama', mime: 'application/msword', nama: 'catatan.doc' })

    const teks = wadah.textContent ?? ''
    expect(teks).toContain('Buka dokumen Dokumen (catatan.doc)')
    // Tidak ada gunanya menembak server: isinya tidak mungkin dibaca.
    expect(fetchTiruan).not.toHaveBeenCalled()
  })

  it('berkas tanpa URL tidak menautkan ke mana pun', () => {
    pasang({ url: null, mime: 'application/pdf', nama: 'Materi.pdf' })

    expect(wadah.querySelector('a[download]')).toBeNull()
    expect(wadah.querySelector('.pratinjau-dokumen')).toBeNull()
  })
})
