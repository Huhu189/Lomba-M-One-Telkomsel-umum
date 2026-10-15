// @vitest-environment jsdom
/**
 * Penyajian media penjelasan setelah kuis (14 Oktober 2026).
 *
 * Permintaan pemilik produk: materi jangan "hanya video" — PDF, Word,
 * PowerPoint, dan Excel harus ikut tampil, dan jangan malah dijadikan unduhan
 * `.upload`. Yang diuji di sini: PDF ditampilkan di dalam halaman, dokumen
 * kantor **ditampilkan isinya** (bukan disuruh diunduh), dan berkas yang memang
 * berisiko tetap diunduh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import JSZip from 'jszip'
import { PenjelasanKuis } from '../../../sections/material/pemutar/PemutarMateri.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/**
 * Media penjelasan seperti yang dikirim server.
 * @param {Record<string, unknown>} ubah
 */
function media(ubah) {
  return {
    kode: 'abc',
    keterangan: '',
    nama: 'Bahan Ajar.pptx',
    kategori: 'dokumen',
    kategori_label: 'Dokumen kantor',
    tampil_langsung: true,
    sajian: 'dokumen',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ukuran_manusia: '1,2 MiB',
    url: '/api/v1/berkas/abc?signature=xyz',
    tersedia: true,
    ...ubah,
  }
}

/** @param {any} isiMedia */
function pasang(isiMedia) {
  act(() => {
    root.render(<PenjelasanKuis penjelasan={{ teks: 'Ini penjelasannya.', media: isiMedia }} />)
  })
}

/**
 * Berkas PowerPoint kecil berisi satu slide berjudul.
 * @param {string} judul
 */
async function pptxBerjudul(judul) {
  const zip = new JSZip()
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${judul}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
  )
  return zip.generateAsync({ type: 'arraybuffer' })
}

/**
 * Menunggu pratinjau selesai dibaca & digambar.
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

beforeEach(() => {
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  vi.unstubAllGlobals()
})

describe('PenjelasanKuis · penyajian dokumen', () => {
  it('isi PowerPoint ditampilkan di halaman, bukan disuruh diunduh', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => await pptxBerjudul('Bagian Tumbuhan') })))

    pasang(media({}))
    await tungguSampai(() => (wadah.textContent ?? '').includes('Bagian Tumbuhan'))

    const teks = wadah.textContent ?? ''

    expect(teks).toContain('Pratinjau PowerPoint')
    expect(teks).toContain('Bagian Tumbuhan')
    expect(teks).toContain('Bahan Ajar.pptx')
    // Tidak ada tombol unduh dan tidak ada pemutar — peramban tidak bisa
    // merender PowerPoint, jadi isinya dibaca dan digambar sendiri.
    expect(wadah.querySelector('a[download]')).toBeNull()
    expect(wadah.querySelector('iframe')).toBeNull()
  })

  it('PDF tampil di dalam halaman beserta tautan cadangan', () => {
    pasang(
      media({
        nama: 'Materi.pdf',
        kategori: 'umum',
        kategori_label: 'Berkas umum',
        sajian: 'semat',
        mime: 'application/pdf',
      }),
    )

    const bingkai = wadah.querySelector('iframe.pm-penjelasan-dokumen')

    expect(bingkai?.getAttribute('src')).toContain('/api/v1/berkas/abc')
    expect(wadah.textContent ?? '').toContain('Buka PDF di tab baru')
  })

  it('arsip tetap diunduh sebagai berkas aman', () => {
    pasang(
      media({
        nama: 'arsip.zip',
        kategori: 'berisiko',
        kategori_label: 'Berkas berisiko',
        tampil_langsung: false,
        sajian: 'unduh',
        mime: 'application/octet-stream',
      }),
    )

    const tautan = /** @type {HTMLAnchorElement|null} */ (wadah.querySelector('a[download]'))

    expect(tautan).not.toBeNull()
    expect(wadah.textContent ?? '').toContain('Unduh media penjelasan (Berkas berisiko)')
  })

  it('server lama tanpa bidang sajian tetap menampilkan gambar', () => {
    pasang({
      kode: 'lama',
      keterangan: '',
      nama: 'gambar.png',
      kategori: 'umum',
      kategori_label: 'Berkas umum',
      tampil_langsung: true,
      mime: 'image/png',
      ukuran_manusia: '12 KiB',
      url: '/api/v1/berkas/lama?signature=xyz',
      tersedia: true,
    })

    expect(wadah.querySelector('img.pm-penjelasan-media')).not.toBeNull()
  })
})
