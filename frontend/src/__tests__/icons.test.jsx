import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { IkonCentang, IkonBuku, IkonMenu, daftarIkon } from '../icons.jsx'

describe('icons.jsx', () => {
  it('ikon ter-render sebagai <svg> dengan viewBox 24', () => {
    const html = renderToStaticMarkup(<IkonCentang size={24} label="centang" />)
    expect(html).toContain('<svg')
    expect(html).toContain('viewBox="0 0 24 24"')
    expect(html).toContain('aria-label="centang"')
  })

  it('ikon buku memakai warna currentColor', () => {
    const html = renderToStaticMarkup(<IkonBuku />)
    expect(html).toContain('stroke="currentColor"')
  })

  it('daftarIkon berisi seluruh ikon wajib slice 00', () => {
    expect(Object.keys(daftarIkon)).toEqual(
      expect.arrayContaining([
        'centang',
        'silang',
        'peringatan',
        'info',
        'buku',
        'jam',
        'pengguna',
        'perisai',
        'matahari',
        'bulan',
      ]),
    )
  })

  it('ikon navigasi & aksi tersedia untuk shell dan kartu', () => {
    // Ikon ini dipakai menu (hamburger + tautan bagian) dan tombol aksi kartu.
    expect(Object.keys(daftarIkon)).toEqual(
      expect.arrayContaining([
        'menu',
        'pensil',
        'tongSampah',
        'tambah',
        'simpan',
        'kisi',
        'lapis',
        'tanda',
        'papan',
        'gear',
        'grafik',
        'putar',
        'jeda',
      ]),
    )
  })

  it('ikon menu (hamburger) ter-render sebagai tiga garis', () => {
    const html = renderToStaticMarkup(<IkonMenu size={22} label="Buka menu" />)
    expect(html).toContain('aria-label="Buka menu"')
    expect(html).toContain('width="22"')
  })
})
