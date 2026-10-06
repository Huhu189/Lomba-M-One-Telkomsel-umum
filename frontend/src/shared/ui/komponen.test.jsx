import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Isian from './Isian.jsx'
import Banner from './Banner.jsx'
import Langkah from './Langkah.jsx'
import MeterSandi from './MeterSandi.jsx'
import { HiasanLatar, IlustrasiSurat } from './Maskot.jsx'

describe('Isian', () => {
  it('label terhubung ke input lewat htmlFor/id', () => {
    const html = renderToStaticMarkup(<Isian label="Email" />)
    const id = /<input[^>]*id="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`for="${id}"`)
  })

  it('galat ditandai aria-invalid + aria-describedby dan memakai role=alert', () => {
    const html = renderToStaticMarkup(<Isian label="Email" galat="Email wajib diisi." />)
    expect(html).toContain('aria-invalid="true"')
    expect(html).toMatch(/aria-describedby="[^"]+-galat"/)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Email wajib diisi.')
  })

  it('tanpa galat tidak ada aria-invalid; bantuan ikut dibacakan', () => {
    const html = renderToStaticMarkup(<Isian label="Sandi" bantuan="Minimal 10 karakter." />)
    expect(html).not.toContain('aria-invalid')
    expect(html).toMatch(/aria-describedby="[^"]+-bantuan"/)
  })

  it('kolom sandi punya tombol lihat/sembunyikan yang berlabel', () => {
    const html = renderToStaticMarkup(<Isian label="Sandi" type="password" />)
    expect(html).toContain('aria-label="Tampilkan kata sandi"')
    expect(html).toContain('type="password"')
  })
})

describe('Banner', () => {
  it('galat memakai role=alert dan ada ikon + judul teks', () => {
    const html = renderToStaticMarkup(<Banner jenis="salah" judul="Gagal">isi</Banner>)
    expect(html).toContain('role="alert"')
    expect(html).toContain('<svg')
    expect(html).toContain('Gagal')
  })

  it('jenis lain memakai role=status', () => {
    expect(renderToStaticMarkup(<Banner jenis="sukses">ok</Banner>)).toContain('role="status"')
  })
})

describe('Langkah', () => {
  it('menandai langkah sekarang dengan aria-current dan yang selesai dengan teks', () => {
    const html = renderToStaticMarkup(<Langkah langkah={['A', 'B', 'C']} sekarang={1} />)
    expect(html).toContain('aria-current="step"')
    expect(html).toContain('(selesai)')
  })
})

describe('MeterSandi', () => {
  it('tidak menampilkan apa pun saat kosong', () => {
    expect(renderToStaticMarkup(<MeterSandi sandi="" />)).toBe('')
  })

  it('menampilkan label teks (bukan hanya warna)', () => {
    expect(renderToStaticMarkup(<MeterSandi sandi="Sandi-Kuat-123!" />)).toContain('Sangat kuat')
  })
})

describe('Ilustrasi', () => {
  it('IlustrasiSurat dekoratif (aria-hidden) dan memakai kelas warna tema', () => {
    const html = renderToStaticMarkup(<IlustrasiSurat />)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('il-pendukung')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })

  it('HiasanLatar dekoratif tanpa warna hex', () => {
    const html = renderToStaticMarkup(<HiasanLatar className="hias" />)
    expect(html).toContain('class="hias"')
    expect(html).toContain('il-bulat')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })
})
