// @vitest-environment jsdom
/**
 * Judul & meta dokumen per jalur (`shared/seo/meta.js` + `MetaHalaman`).
 *
 * Yang dijaga: aplikasi ini SPA, jadi tanpa berkas ini seluruh halaman berbagi
 * satu judul dan satu deskripsi. Dua hal yang mudah salah dan diuji di sini:
 * halaman aplikasi (berisi data sekolah) **tidak boleh** masuk indeks pencarian,
 * dan meta yang dipasang ulang saat berpindah halaman tidak boleh menumpuk jadi
 * beberapa tag `<meta name="description">`.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { META_BAWAAN, META_PUBLIK, metaUntukJalur, pasangMeta } from '../../shared/seo/meta.js'
import MetaHalaman from '../../shared/seo/MetaHalaman.jsx'
import { RUTE } from '../../routes.js'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

describe('metaUntukJalur', () => {
  it('halaman publik boleh diindeks dan punya deskripsi sendiri', () => {
    for (const jalur of [RUTE.beranda, RUTE.masuk, RUTE.daftar]) {
      const meta = metaUntukJalur(jalur)

      expect(meta.robotika).toBe('index, follow')
      expect(meta.judul).toBe(META_PUBLIK[jalur].judul)
      // Deskripsi yang terlalu pendek dipotong mesin pencari tanpa guna; ini
      // memastikan tiap halaman publik benar-benar punya kalimat penjelas.
      expect(meta.deskripsi.length).toBeGreaterThan(60)
    }
  })

  it('halaman aplikasi tidak diindeks, tetapi tautannya tetap diikuti', () => {
    const meta = metaUntukJalur('/kuis/abc123/laporan')

    expect(meta.judul).toBe('Laporan kuis — Ulangan Sekolah')
    // `follow`: isinya tidak untuk indeks, tetapi menutup jalan perayap ke
    // tautan di dalamnya tidak ada gunanya (dan itu dulu jadi keluhan).
    expect(meta.robotika).toBe('noindex, follow')
  })

  it('halaman aplikasi lain dikenali dari awalannya', () => {
    expect(metaUntukJalur('/kuis/abc123/koreksi').judul).toBe('Koreksi jawaban — Ulangan Sekolah')
    expect(metaUntukJalur('/kerjakan/12').judul).toBe('Mengerjakan ulangan — Ulangan Sekolah')
    expect(metaUntukJalur('/admin/akun').judul).toBe('Kelola akun sekolah — Ulangan Sekolah')
    expect(metaUntukJalur('/bank-soal').judul).toBe('Bank soal — Ulangan Sekolah')
  })

  it('query diabaikan dan garis miring di ujung tidak mengubah hasil', () => {
    expect(metaUntukJalur('/kuis/abc?tab=soal').judul).toBe(metaUntukJalur('/kuis/abc').judul)
    expect(metaUntukJalur('/kelas/').judul).toBe('Kelas — Ulangan Sekolah')
  })

  it('jalur tak dikenal memakai cadangan yang tetap tidak diindeks', () => {
    const meta = metaUntukJalur('/jalur-yang-tidak-ada')

    expect(meta.judul).toBe(META_BAWAAN.judul)
    expect(meta.robotika).toBe('noindex, follow')
  })
})

describe('pasangMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
  })

  /** @param {string} nama @returns {string|null} */
  function isi(nama) {
    return document.head.querySelector(`meta[name="${nama}"]`)?.getAttribute('content') ?? null
  }

  it('membuat meta yang belum ada di index.html', () => {
    pasangMeta(RUTE.beranda)

    expect(document.title).toBe(META_PUBLIK[RUTE.beranda].judul)
    expect(isi('description')).toBe(META_PUBLIK[RUTE.beranda].deskripsi)
    expect(isi('robots')).toBe('index, follow')
  })

  it('berpindah halaman memperbarui isinya, bukan menambah tag baru', () => {
    pasangMeta(RUTE.beranda)
    pasangMeta('/kuis/abc123/koreksi')

    expect(document.title).toBe('Koreksi jawaban — Ulangan Sekolah')
    expect(isi('robots')).toBe('noindex, follow')
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1)
  })

  it('mengganti isi tag yang sudah ada di index.html', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'description')
    meta.setAttribute('content', 'deskripsi lama')
    document.head.appendChild(meta)

    pasangMeta(RUTE.masuk)

    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(isi('description')).toBe(META_PUBLIK[RUTE.masuk].deskripsi)
  })
})

describe('pasangMeta: canonical + kartu pratinjau', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
  })

  /** @param {string} sel @param {string} atr @returns {string|null} */
  const baca = (sel, atr) => document.head.querySelector(sel)?.getAttribute(atr) ?? null

  it('halaman publik mendapat canonical, og:url, dan kartu pratinjau', () => {
    pasangMeta(`${RUTE.masuk}?lanjut=/kuis/1`)

    const url = `${document.location.origin}${RUTE.masuk}`
    expect(baca('link[rel="canonical"]', 'href')).toBe(url)
    expect(baca('meta[property="og:url"]', 'content')).toBe(url)
    expect(baca('meta[property="og:title"]', 'content')).toBe(META_PUBLIK[RUTE.masuk].judul)
    expect(baca('meta[name="twitter:card"]', 'content')).toBe('summary')
  })

  it('halaman noindex tidak membawa canonical maupun og:url', () => {
    pasangMeta(RUTE.beranda)
    pasangMeta('/kuis/abc123/laporan')

    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull()
  })

  it('berpindah halaman tidak menumpuk tag', () => {
    pasangMeta(RUTE.beranda)
    pasangMeta(RUTE.masuk)
    pasangMeta(RUTE.daftar)

    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
  })

  it('mengisi lang hanya bila belum ada', () => {
    document.documentElement.removeAttribute('lang')
    pasangMeta(RUTE.beranda)
    expect(document.documentElement.getAttribute('lang')).toBe('id')

    document.documentElement.setAttribute('lang', 'en')
    pasangMeta(RUTE.beranda)
    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })
})

describe('MetaHalaman', () => {
  /** @type {HTMLElement} */
  let wadah
  /** @type {import('react-dom/client').Root} */
  let root

  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
    wadah = document.createElement('div')
    document.body.appendChild(wadah)
    root = createRoot(wadah)
  })

  it('memasang meta saat dijalankan, dan mengikutinya saat jalurnya berganti', () => {
    act(() => {
      root.render(<MetaHalaman jalur={RUTE.masuk} />)
    })

    expect(document.title).toBe(META_PUBLIK[RUTE.masuk].judul)

    // Perpindahan halaman di SPA hanya mengganti prop ini — itulah jalur yang
    // dipakai Router, jadi judul tidak mungkin tertinggal di halaman sebelumnya.
    act(() => {
      root.render(<MetaHalaman jalur="/kuis/abc123/monitor" />)
    })

    expect(document.title).toBe('Monitor ulangan — Ulangan Sekolah')
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, follow',
    )

    act(() => root.unmount())
    wadah.remove()
  })
})
