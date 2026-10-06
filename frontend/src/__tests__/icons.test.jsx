import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { IkonCentang, IkonBuku, daftarIkon } from '../icons.jsx'

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
})
