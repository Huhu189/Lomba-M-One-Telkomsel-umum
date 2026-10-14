// @vitest-environment jsdom
/**
 * Penyajian media penjelasan setelah kuis (14 Oktober 2026).
 *
 * Permintaan pemilik produk: materi jangan "hanya video" — PDF, Word,
 * PowerPoint, dan Excel harus ikut tampil, dan jangan malah dijadikan unduhan
 * `.upload`. Yang diuji di sini: PDF ditampilkan di dalam halaman, dokumen
 * kantor ditawarkan sebagai "Buka dokumen" (bukan "Unduh"), dan berkas yang
 * memang berisiko tetap diunduh.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PenjelasanKuis } from '../../../sections/material/PemutarMateri.jsx'

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

beforeEach(() => {
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('PenjelasanKuis · penyajian dokumen', () => {
  it('dokumen kantor ditawarkan sebagai “Buka dokumen”, bukan unduhan', () => {
    pasang(media({}))

    const teks = wadah.textContent ?? ''

    expect(teks).toContain('Buka dokumen PowerPoint')
    expect(teks).toContain('Bahan Ajar.pptx')
    // Tidak ada tombol unduh dan tidak ada pemutar — peramban tidak bisa
    // merender PowerPoint.
    expect(teks).not.toContain('Unduh')
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
