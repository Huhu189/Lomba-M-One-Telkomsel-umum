// @vitest-environment jsdom
/**
 * Tes renderer soal objektif — markup statis, jadi tidak perlu klien interaktif.
 * Yang dijaga: tiap tipe punya kendali jawaban sendiri, kunci hanya muncul
 * saat guru membukanya, dan MathML dirender tanpa menyisipkan HTML mentah.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import MediaSoal, { mathmlKeElemen, teksTanpaTag } from './MediaSoal.jsx'
import RendererSoal from './RendererSoal.jsx'
import SoalBenarSalah from './SoalBenarSalah.jsx'
import SoalMenjodohkan from './SoalMenjodohkan.jsx'
import SoalMengurutkan from './SoalMengurutkan.jsx'
import SoalPilihanGanda from './SoalPilihanGanda.jsx'

const kontenPg = {
  teks: 'Berapa hasil 4 + 5?',
  opsi: [
    { id: 'A', teks: '8' },
    { id: 'B', teks: '9' },
  ],
}

describe('SoalPilihanGanda', () => {
  it('menampilkan teks soal dan satu radio per opsi', () => {
    const html = renderToStaticMarkup(<SoalPilihanGanda konten={kontenPg} nama="s1" />)

    expect(html).toContain('Berapa hasil 4 + 5?')
    expect(html).toContain('name="s1"')
    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(html).toContain('>A.<')
    expect(html).toContain('>B.<')
  })

  it('tidak membocorkan kunci saat guru menutupnya', () => {
    const html = renderToStaticMarkup(<SoalPilihanGanda konten={kontenPg} kunci={{ jawaban: 'B' }} />)
    expect(html).not.toContain('badge-kunci')
  })

  it('menandai kunci saat tampilkanKunci diaktifkan', () => {
    const html = renderToStaticMarkup(
      <SoalPilihanGanda konten={kontenPg} kunci={{ jawaban: 'B' }} tampilkanKunci />,
    )
    expect(html).toContain('badge-kunci')
    expect(html.match(/badge-kunci/g)).toHaveLength(1)
  })

  it('menandai opsi yang sedang dipilih lewat nilai', () => {
    const html = renderToStaticMarkup(<SoalPilihanGanda konten={kontenPg} nilai="A" />)
    expect(html.match(/checked/g)).toHaveLength(1)
  })
})

describe('SoalBenarSalah', () => {
  it('menampilkan pilihan Benar dan Salah', () => {
    const html = renderToStaticMarkup(<SoalBenarSalah konten={{ teks: '1 + 1 = 2.' }} />)

    expect(html).toContain('1 + 1 = 2.')
    expect(html).toContain('Benar')
    expect(html).toContain('Salah')
    expect(html.match(/type="radio"/g)).toHaveLength(2)
  })

  it('menandai kunci salah pada pilihan Salah', () => {
    const html = renderToStaticMarkup(
      <SoalBenarSalah konten={{ teks: '1 + 1 = 3.' }} kunci={{ benar: false }} tampilkanKunci />,
    )

    const potongan = html.split('Salah')[1] ?? ''
    expect(potongan).toContain('badge-kunci')
  })
})

describe('SoalMenjodohkan', () => {
  const konten = {
    teks: 'Jodohkan.',
    kiri: [
      { id: 'K1', teks: '4 + 5' },
      { id: 'K2', teks: '3 + 3' },
    ],
    kanan: [
      { id: 'N1', teks: '6' },
      { id: 'N2', teks: '9' },
    ],
  }

  it('menyediakan satu daftar pilih per item kiri', () => {
    const html = renderToStaticMarkup(<SoalMenjodohkan konten={konten} />)

    expect(html.match(/<select/g)).toHaveLength(2)
    expect(html.match(/Pilih pasangan…/g)).toHaveLength(2)
    expect(html).toContain('4 + 5')
    expect(html).toContain('3 + 3')
  })

  it('menampilkan kunci pasangan saat dibuka', () => {
    const html = renderToStaticMarkup(
      <SoalMenjodohkan konten={konten} kunci={{ pasangan: { K1: 'N2', K2: 'N1' } }} tampilkanKunci />,
    )
    expect(html.match(/badge-kunci/g)).toHaveLength(2)
    expect(html).toContain('kunci: 9')
  })

  it('memakai nilai jawaban murid sebagai pilihan aktif', () => {
    const html = renderToStaticMarkup(<SoalMenjodohkan konten={konten} nilai={{ K1: 'N1' }} />)
    const pilihanTerpilih = /<option[^>]*value="N1"[^>]*selected/.test(html)
    expect(pilihanTerpilih).toBe(true)
  })
})

describe('SoalMengurutkan', () => {
  const konten = {
    teks: 'Urutkan dari terkecil.',
    item: [
      { id: 'I1', teks: '9' },
      { id: 'I2', teks: '2' },
    ],
  }

  it('menyediakan satu isian nomor urut per item', () => {
    const html = renderToStaticMarkup(<SoalMengurutkan konten={konten} />)

    expect(html.match(/type="number"/g)).toHaveLength(2)
    expect(html).toContain('Urutkan dari terkecil.')
  })

  it('menampilkan kunci posisi saat dibuka', () => {
    const html = renderToStaticMarkup(
      <SoalMengurutkan konten={konten} kunci={{ urutan: ['I2', 'I1'] }} tampilkanKunci />,
    )
    expect(html).toContain('kunci: 2')
    expect(html).toContain('kunci: 1')
  })
})

describe('RendererSoal', () => {
  it('memilih renderer sesuai tipe', () => {
    const html = renderToStaticMarkup(<RendererSoal tipe="pilihan_ganda" konten={kontenPg} />)
    expect(html).toContain('Berapa hasil 4 + 5?')
  })

  it('menjelaskan tipe yang belum didukung alih-alih gagal', () => {
    const html = renderToStaticMarkup(<RendererSoal tipe="uraian" konten={{ teks: 'Jelaskan.' }} />)
    expect(html).toContain('belum didukung')
  })
})

describe('MediaSoal & MathML', () => {
  it('merender MathML native', () => {
    const html = renderToStaticMarkup(
      <MediaSoal konten={{ matematika: '<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>' }} />,
    )

    expect(html).toContain('<math>')
    expect(html).toContain('<mfrac>')
    expect(html).toContain('<mn>1</mn>')
  })

  it('tidak meneruskan tag di luar daftar putih', () => {
    expect(() => mathmlKeElemen('<script>alert(1)</script>')).not.toThrow()
    expect(mathmlKeElemen('<script>alert(1)</script>')).toBeNull()

    const html = renderToStaticMarkup(
      <MediaSoal
        konten={{ matematika: '<math><mi>x</mi><script>alert(1)</script></math>' }}
      />,
    )
    expect(html).not.toContain('<script')
  })

  it('menampilkan gambar media bila ada', () => {
    const html = renderToStaticMarkup(<MediaSoal konten={{ media: '/media/lingkaran.png' }} />)
    expect(html).toContain('src="/media/lingkaran.png"')
  })

  it('teksTanpaTag membuang markup sebagai cadangan', () => {
    expect(teksTanpaTag('<math><mn>2</mn></math>')).toBe('2')
  })
})
