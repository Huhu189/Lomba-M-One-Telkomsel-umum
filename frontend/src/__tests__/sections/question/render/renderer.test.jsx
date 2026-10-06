// @vitest-environment jsdom
/**
 * Tes renderer soal objektif — markup statis, jadi tidak perlu klien interaktif.
 * Yang dijaga: tiap tipe punya kendali jawaban sendiri, kunci hanya muncul
 * saat guru membukanya, dan MathML dirender tanpa menyisipkan HTML mentah.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import MediaSoal, { mathmlKeElemen, teksTanpaTag } from '../../../../sections/question/render/MediaSoal.jsx'
import RendererSoal from '../../../../sections/question/render/RendererSoal.jsx'
import SoalBenarSalah from '../../../../sections/question/render/SoalBenarSalah.jsx'
import SoalMenjodohkan from '../../../../sections/question/render/SoalMenjodohkan.jsx'
import SoalMengurutkan from '../../../../sections/question/render/SoalMengurutkan.jsx'
import SoalPilihanGanda from '../../../../sections/question/render/SoalPilihanGanda.jsx'
import SoalHubungKata from '../../../../sections/question/render/SoalHubungKata.jsx'
import SoalIsianSingkat from '../../../../sections/question/render/SoalIsianSingkat.jsx'
import SoalLetakKata from '../../../../sections/question/render/SoalLetakKata.jsx'
import SoalUraian from '../../../../sections/question/render/SoalUraian.jsx'

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

describe('SoalLetakKata', () => {
  const konten = {
    teks: 'Letakkan kata pada posisi yang tepat.',
    kata: [
      { id: 'W1', teks: 'kucing' },
      { id: 'W2', teks: 'berlari' },
    ],
    posisi: [
      { id: 'P1', teks: 'Subjek' },
      { id: 'P2', teks: 'Predikat' },
    ],
  }

  it('menyediakan satu daftar pilih posisi per kata', () => {
    const html = renderToStaticMarkup(<SoalLetakKata konten={konten} />)

    expect(html.match(/<select/g)).toHaveLength(2)
    expect(html.match(/Pilih posisi…/g)).toHaveLength(2)
    expect(html).toContain('kucing')
    expect(html).toContain('Subjek')
  })

  it('memakai jawaban murid sebagai pilihan aktif', () => {
    const html = renderToStaticMarkup(<SoalLetakKata konten={konten} nilai={{ W1: 'P1' }} />)
    expect(/<option[^>]*value="P1"[^>]*selected/.test(html)).toBe(true)
  })

  it('menandai kunci yang tepat dan yang belum sesuai', () => {
    const html = renderToStaticMarkup(
      <SoalLetakKata
        konten={konten}
        kunci={{ penempatan: { W1: 'P1', W2: 'P2' } }}
        nilai={{ W1: 'P1' }}
        tampilkanKunci
      />,
    )

    expect(html).toContain('>tepat<')
    expect(html).toContain('kunci: Predikat')
  })
})

describe('SoalHubungKata', () => {
  const konten = {
    teks: 'Hubungkan kata dengan pasangannya.',
    kiri: [
      { id: 'K1', teks: 'besar' },
      { id: 'K2', teks: 'panas' },
    ],
    kanan: [
      { id: 'N1', teks: 'kecil' },
      { id: 'N2', teks: 'dingin' },
    ],
  }

  it('menyediakan satu daftar pilih pasangan per kata kiri', () => {
    const html = renderToStaticMarkup(<SoalHubungKata konten={konten} />)

    expect(html.match(/<select/g)).toHaveLength(2)
    expect(html.match(/Pilih pasangan…/g)).toHaveLength(2)
    expect(html).toContain('besar')
    expect(html).toContain('dingin')
  })

  it('menampilkan kunci sambungan saat dibuka', () => {
    const html = renderToStaticMarkup(
      <SoalHubungKata
        konten={konten}
        kunci={{ sambungan: { K1: 'N1', K2: 'N2' } }}
        nilai={{ K1: 'N1' }}
        tampilkanKunci
      />,
    )

    expect(html.match(/badge-kunci/g)).toHaveLength(2)
    expect(html).toContain('>tepat<')
    expect(html).toContain('kunci: dingin')
  })
})

describe('SoalIsianSingkat', () => {
  it('menyediakan satu kotak teks dengan petunjuk soal', () => {
    const html = renderToStaticMarkup(
      <SoalIsianSingkat
        konten={{ teks: 'Berapa hasil 4 + 5?', petunjuk: 'Tulis angka saja.' }}
        nama="s1"
      />,
    )

    expect(html).toContain('Berapa hasil 4 + 5?')
    expect(html).toContain('name="s1"')
    expect(html.match(/type="text"/g)).toHaveLength(1)
    expect(html).toContain('placeholder="Tulis angka saja."')
  })

  it('memakai nilai murid sebagai isi kotak jawaban', () => {
    const html = renderToStaticMarkup(<SoalIsianSingkat konten={{ teks: 'x' }} nilai="9" />)
    expect(html).toContain('value="9"')
  })

  it('menampilkan jawaban baku beserta sinonimnya sebagai kunci', () => {
    const html = renderToStaticMarkup(
      <SoalIsianSingkat
        konten={{ teks: 'Berapa hasil 4 + 5?' }}
        kunci={{ jawaban_baku: ['9', 'sembilan'], sinonim: [['sembilan']] }}
        tampilkanKunci
      />,
    )

    expect(html.match(/badge-kunci/g)).toHaveLength(2)
    expect(html).toContain('9 · sembilan')
  })

  it('tidak membocorkan kunci saat guru menutupnya', () => {
    const html = renderToStaticMarkup(
      <SoalIsianSingkat konten={{ teks: 'x' }} kunci={{ jawaban_baku: ['9'] }} />,
    )
    expect(html).not.toContain('badge-kunci')
  })
})

describe('SoalUraian', () => {
  it('menyediakan kotak teks panjang', () => {
    const html = renderToStaticMarkup(
      <SoalUraian konten={{ teks: 'Jelaskan cara menjumlahkan.' }} nama="s2" />,
    )

    expect(html).toContain('Jelaskan cara menjumlahkan.')
    expect(html.match(/<textarea/g)).toHaveLength(1)
    expect(html).toContain('rows="4"')
    expect(html).toContain('name="s2"')
  })

  it('menampilkan kata kunci berbobot sebagai kunci', () => {
    const html = renderToStaticMarkup(
      <SoalUraian
        konten={{ teks: 'Jelaskan.' }}
        kunci={{ kata_kunci: [{ teks: 'jumlah', bobot: 2 }, { teks: 'hasil' }] }}
        tampilkanKunci
      />,
    )

    expect(html.match(/badge-kunci/g)).toHaveLength(1)
    expect(html).toContain('jumlah (2) · hasil (1)')
  })
})

describe('RendererSoal', () => {
  it('memilih renderer sesuai tipe', () => {
    const html = renderToStaticMarkup(<RendererSoal tipe="pilihan_ganda" konten={kontenPg} />)
    expect(html).toContain('Berapa hasil 4 + 5?')
  })

  it('mengarahkan isian singkat dan uraian ke renderer bertingkat', () => {
    const isian = renderToStaticMarkup(
      <RendererSoal tipe="isian_singkat" konten={{ teks: 'Hasil 4 + 5?' }} />,
    )
    expect(isian).toContain('type="text"')

    const uraian = renderToStaticMarkup(<RendererSoal tipe="uraian" konten={{ teks: 'Jelaskan.' }} />)
    expect(uraian).toContain('<textarea')
  })

  it('menjelaskan tipe yang belum didukung alih-alih gagal', () => {
    const html = renderToStaticMarkup(<RendererSoal tipe="esai_bebas" konten={{ teks: 'Jelaskan.' }} />)
    expect(html).toContain('belum didukung')
    expect(html).toContain('esai_bebas')
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
