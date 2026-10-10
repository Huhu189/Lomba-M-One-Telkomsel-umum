// @vitest-environment jsdom
/**
 * Tes renderer soal objektif — markup statis, jadi tidak perlu klien interaktif.
 * Yang dijaga: tiap tipe punya kendali jawaban sendiri, kunci hanya muncul
 * saat guru membukanya, dan MathML dirender tanpa menyisipkan HTML mentah.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import MediaSoal, {
  altMedia,
  mathmlKeElemen,
  teksTanpaTag,
} from '../../../../sections/question/render/MediaSoal.jsx'
import RendererSoal from '../../../../sections/question/render/RendererSoal.jsx'
import SoalBenarSalah from '../../../../sections/question/render/SoalBenarSalah.jsx'
import SoalMenjodohkan from '../../../../sections/question/render/SoalMenjodohkan.jsx'
import SoalMengurutkan from '../../../../sections/question/render/SoalMengurutkan.jsx'
import SoalPilihanGanda from '../../../../sections/question/render/SoalPilihanGanda.jsx'
import SoalHubungKata from '../../../../sections/question/render/SoalHubungKata.jsx'
import SoalIsianSingkat from '../../../../sections/question/render/SoalIsianSingkat.jsx'
import SoalLetakKata from '../../../../sections/question/render/SoalLetakKata.jsx'
import SoalUraian from '../../../../sections/question/render/SoalUraian.jsx'
import SoalPilihanGandaKompleks from '../../../../sections/question/render/SoalPilihanGandaKompleks.jsx'
import SoalBenarSalahMajemuk from '../../../../sections/question/render/SoalBenarSalahMajemuk.jsx'
import SoalIsianAngka from '../../../../sections/question/render/SoalIsianAngka.jsx'
import SoalPilihanGambar from '../../../../sections/question/render/SoalPilihanGambar.jsx'
import SoalUrutGambar from '../../../../sections/question/render/SoalUrutGambar.jsx'
import SoalSusunHuruf from '../../../../sections/question/render/SoalSusunHuruf.jsx'
import SoalIsianRumpang, {
  pecahRumpang,
} from '../../../../sections/question/render/SoalIsianRumpang.jsx'
import SoalKlasifikasi from '../../../../sections/question/render/SoalKlasifikasi.jsx'
import SoalTabelIsian, {
  barisTabel,
} from '../../../../sections/question/render/SoalTabelIsian.jsx'
import SoalGarisBilangan, {
  titikGaris,
} from '../../../../sections/question/render/SoalGarisBilangan.jsx'
import SoalHotspotGambar, {
  areaHotspot,
} from '../../../../sections/question/render/SoalHotspotGambar.jsx'
import SoalBacaJam, {
  angkaJam,
  ujungJarum,
} from '../../../../sections/question/render/SoalBacaJam.jsx'
import SoalTugasUnggah, {
  rubrikPenilaian,
} from '../../../../sections/question/render/SoalTugasUnggah.jsx'
import SoalTekaSilangMini, {
  gridSilang,
  petunjukSilang,
} from '../../../../sections/question/render/SoalTekaSilangMini.jsx'

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

  // U-01: alt bermakna per soal (bukan label generik yang sama) + rasio cadangan
  // supaya tata letak tidak melompat sebelum gambar selesai dimuat.
  it('memberi alt bermakna per soal dan dimensi cadangan', () => {
    const html = renderToStaticMarkup(
      <MediaSoal konten={{ teks: 'Berapa hasil 4 + 5?', media: '/media/lingkaran.png' }} />,
    )

    expect(html).toContain('alt="Gambar pendukung: Berapa hasil 4 + 5?"')
    expect(html).toContain('width="480"')
    expect(html).toContain('height="270"')
  })

  it('altMedia memakai deskripsi khusus lalu jatuh ke teks soal', () => {
    expect(altMedia({ teks: 'x', alt: 'Lingkaran merah' })).toBe('Lingkaran merah')
    expect(altMedia({ teks: 'Berapa hasil 4 + 5?' })).toBe('Gambar pendukung: Berapa hasil 4 + 5?')
    expect(altMedia({ media: '/a.png' })).toBe('Gambar pendukung soal')
  })

  it('teksTanpaTag membuang markup sebagai cadangan', () => {
    expect(teksTanpaTag('<math><mn>2</mn></math>')).toBe('2')
  })
})

describe('renderer tipe baru (gelombang 1)', () => {
  it('pilihan ganda kompleks memakai kotak centang dan menandai kunci', () => {
    const konten = {
      teks: 'Centang bilangan genap.',
      opsi: [
        { id: 'o1', teks: '4' },
        { id: 'o2', teks: '7' },
        { id: 'o3', teks: '10' },
      ],
    }
    const html = renderToStaticMarkup(
      <SoalPilihanGandaKompleks konten={konten} kunci={{ benar: ['o1', 'o3'] }} nilai={['o1']} />,
    )

    expect(html.match(/type="checkbox"/g)).toHaveLength(3)
    expect(html.match(/checked/g)).toHaveLength(1)
    expect(html).not.toContain('badge-kunci')

    const denganKunci = renderToStaticMarkup(
      <SoalPilihanGandaKompleks konten={konten} kunci={{ benar: ['o1', 'o3'] }} tampilkanKunci />,
    )
    expect(denganKunci.match(/badge-kunci/g)).toHaveLength(2)
  })

  it('benar/salah majemuk menampilkan radio per pernyataan', () => {
    const html = renderToStaticMarkup(
      <SoalBenarSalahMajemuk
        konten={{ teks: 'Tandai.', pernyataan: [{ id: 'p1', teks: '1 + 1 = 2' }, { id: 'p2', teks: '2 + 2 = 5' }] }}
        nilai={{ p1: true }}
      />,
    )

    expect(html).toContain('1 + 1 = 2')
    expect(html.match(/type="radio"/g)).toHaveLength(4)
    expect(html.match(/checked/g)).toHaveLength(1)
  })

  it('isian angka menampilkan satuan dan tidak membocorkan kunci bila tertutup', () => {
    const html = renderToStaticMarkup(
      <SoalIsianAngka konten={{ teks: 'Berapa?', satuan: 'cm' }} kunci={{ nilai: 21, toleransi: 0 }} />,
    )

    expect(html).toContain('cm')
    expect(html).not.toContain('badge-kunci')
  })

  it('pilihan gambar menampilkan satu gambar per opsi dan kunci hanya saat dibuka', () => {
    const konten = {
      teks: 'Pilih lingkaran.',
      opsi: [
        { id: 'g1', media: '/media/a.png' },
        { id: 'g2', media: '/media/b.png' },
      ],
    }
    const html = renderToStaticMarkup(<SoalPilihanGambar konten={konten} kunci={{ benar: 'g1' }} />)

    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(html).toContain('src="/media/a.png"')
    expect(html).not.toContain('badge-kunci')
  })

  it('urut gambar menampilkan tombol naik/turun aksesibel', () => {
    const konten = {
      teks: 'Urutkan.',
      item: [
        { id: 'u1', media: '/media/a.png' },
        { id: 'u2', media: '/media/b.png' },
      ],
    }
    const html = renderToStaticMarkup(<SoalUrutGambar konten={konten} />)

    expect(html).toContain('aria-label="Naikkan gambar ke atas"')
    expect(html).toContain('aria-label="Turunkan gambar ke bawah"')
  })

  it('susun huruf memakai huruf dari server, bukan kata kunci', () => {
    const html = renderToStaticMarkup(
      <SoalSusunHuruf konten={{ petunjuk: 'Nama hewan mengeong.', huruf: ['g', 'n', 'k', 'u', 'c', 'i'] }} />,
    )

    expect(html).toContain('Nama hewan mengeong.')
    expect(html.match(/susun-huruf-tombol/g)).toHaveLength(6)
    expect(html).not.toContain('kucing')
  })
})

describe('renderer tipe baru (gelombang 2)', () => {
  it('isian rumpang mengubah penanda menjadi kotak isian', () => {
    expect(pecahRumpang('Hasil {{1}} dan {{2}}.')).toEqual([
      { jenis: 'teks', isi: 'Hasil ' },
      { jenis: 'lubang', nomor: '1' },
      { jenis: 'teks', isi: ' dan ' },
      { jenis: 'lubang', nomor: '2' },
      { jenis: 'teks', isi: '.' },
    ])

    const konten = { teks: 'Ibu kota Indonesia adalah {{1}}.' }
    const html = renderToStaticMarkup(<SoalIsianRumpang konten={konten} nilai={{ 1: 'Bandung' }} />)

    expect(html.match(/rumpang-kotak/g)).toHaveLength(1)
    expect(html).toContain('value="Bandung"')
    expect(html).not.toContain('badge-kunci')

    const denganKunci = renderToStaticMarkup(
      <SoalIsianRumpang konten={konten} kunci={{ lubang: { 1: ['Jakarta'] } }} tampilkanKunci />,
    )
    expect(denganKunci).toContain('badge-kunci')
    expect(denganKunci).toContain('Jakarta')
  })

  it('klasifikasi menyediakan satu pilihan kotak per item', () => {
    const konten = {
      teks: 'Kelompokkan hewan.',
      item: [
        { id: 'i1', teks: 'kucing' },
        { id: 'i2', teks: 'ayam' },
      ],
      kotak: [
        { id: 'k1', label: 'Mamalia' },
        { id: 'k2', label: 'Unggas' },
      ],
    }
    const html = renderToStaticMarkup(<SoalKlasifikasi konten={konten} nama="s9" />)

    expect(html.match(/<select/g)).toHaveLength(2)
    expect(html).toContain('name="s9-i1"')
    expect(html).toContain('Mamalia')
    expect(html).not.toContain('badge-kunci')

    const denganKunci = renderToStaticMarkup(
      <SoalKlasifikasi konten={konten} kunci={{ peta: { i1: 'k1', i2: 'k2' } }} tampilkanKunci />,
    )
    expect(denganKunci.match(/badge-kunci/g)).toHaveLength(2)
    expect(denganKunci).toContain('kunci: Mamalia')
  })

  it('tabel isian mengisi hanya sel kosong', () => {
    const konten = {
      teks: 'Isi tabel.',
      kolom: ['Soal', 'Hasil'],
      baris: [
        { id: 'r1', sel: [{ kode: 'r1c1', teks: '3 x 4' }, { kode: 'r1c2' }] },
      ],
    }

    expect(barisTabel(konten.baris)).toEqual([
      {
        id: 'r1',
        sel: [
          { kode: 'r1c1', teks: '3 x 4' },
          { kode: 'r1c2', teks: '' },
        ],
      },
    ])

    const html = renderToStaticMarkup(<SoalTabelIsian konten={konten} nilai={{ r1c2: '12' }} />)

    expect(html.match(/<input/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Isian r1c2"')
    expect(html).toContain('value="12"')
    expect(html).toContain('3 x 4')
    expect(html).not.toContain('badge-kunci')

    const denganKunci = renderToStaticMarkup(
      <SoalTabelIsian konten={konten} kunci={{ sel: { r1c2: ['12', 'dua belas'] } }} tampilkanKunci />,
    )
    expect(denganKunci).toContain('kunci: 12, dua belas')
  })

  it('garis bilangan menggambar tick yang bisa diketuk dan keyboard', () => {
    expect(titikGaris(0, 3, 1)).toEqual([0, 1, 2, 3])
    expect(titikGaris(0, 10, 0)).toEqual([])

    const html = renderToStaticMarkup(
      <SoalGarisBilangan konten={{ teks: 'Tandai 2.', min: 0, max: 3, langkah: 1 }} nilai={2} />,
    )

    expect(html).toContain('class="garis-bilangan"')
    expect(html.match(/role="button"/g)).toHaveLength(4)
    expect(html).toContain('aria-label="Tandai 2"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).not.toContain('badge-kunci')
  })
})

describe('renderer tipe baru (gelombang 3)', () => {
  const kontenHotspot = {
    teks: 'Ketuk lingkaran.',
    media: '/media/bentuk.png',
    area: [
      { id: 'a1', x: 0.05, y: 0.2, w: 0.25, h: 0.5 },
      { id: 'a2', x: 0.4, y: 0.2, w: 0.25, h: 0.5 },
    ],
  }

  it('hotspot gambar menyediakan satu area yang bisa diketuk per kotak', () => {
    expect(areaHotspot(kontenHotspot.area)).toEqual(kontenHotspot.area)
    // Nilai di luar 0–1 dijepit dan data kotor dibuang.
    expect(areaHotspot([{ id: 'x', x: 2, y: -1, w: 0.5, h: 0.5 }, null])).toEqual([
      { id: 'x', x: 1, y: 0, w: 0.5, h: 0.5 },
    ])

    const html = renderToStaticMarkup(
      <SoalHotspotGambar konten={kontenHotspot} kunci={{ area_benar: ['a2'] }} />,
    )

    expect(html).toContain('src="/media/bentuk.png"')
    expect(html.match(/role="button"/g)).toHaveLength(2)
    expect(html).toContain('aria-label="Ketuk area a2"')
    expect(html).not.toContain('badge-kunci')
    expect(html).not.toContain('kunci"')

    const denganKunci = renderToStaticMarkup(
      <SoalHotspotGambar
        konten={kontenHotspot}
        kunci={{ area_benar: ['a2'] }}
        nilai={{ x: 0.1, y: 0.4 }}
        tampilkanKunci
      />,
    )
    // a1 terpilih (jawaban murid), a2 jadi jawaban benar — dua penanda berbeda.
    expect(denganKunci.match(/hotspot-area terpilih"/g)).toHaveLength(1)
    expect(denganKunci.match(/hotspot-area kunci"/g)).toHaveLength(1)
  })

  it('baca jam menggambar jarum dari pilihan murid', () => {
    expect(angkaJam('7', 0, 11)).toBe(7)
    expect(angkaJam(12, 0, 11)).toBeNull()
    expect(angkaJam(7.5, 0, 11)).toBeNull()

    const pukulTiga = ujungJarum(0, 10)
    expect(Math.round(pukulTiga.x)).toBe(100)

    const html = renderToStaticMarkup(
      <SoalBacaJam
        konten={{ teks: 'Tunjukkan pukul setengah delapan.' }}
        kunci={{ jam: 7, menit: 30 }}
        nilai={{ jam: 3, menit: 15 }}
        nama="s7"
      />,
    )

    expect(html).toContain('Tunjukkan pukul setengah delapan.')
    expect(html).toContain('value="3"')
    expect(html).toContain('value="15"')
    expect(html).not.toContain('badge-kunci')

    const denganKunci = renderToStaticMarkup(
      <SoalBacaJam konten={{ teks: 'Tunjukkan.' }} kunci={{ jam: 7, menit: 30 }} tampilkanKunci />,
    )
    expect(denganKunci).toContain('badge-kunci')
    expect(denganKunci).toContain('7:30')
  })

  it('tugas unggah menyebut jenis berkas dan menyembunyikan rubrik dari murid', () => {
    const konten = { teks: 'Unggah foto pekerjaanmu.', jenis_berkas: 'Foto JPG' }
    const kunci = { rubrik: [{ butir: 'Langkah lengkap', poin: 3 }] }

    expect(rubrikPenilaian(kunci.rubrik)).toEqual([{ butir: 'Langkah lengkap', poin: '3' }])

    const html = renderToStaticMarkup(<SoalTugasUnggah konten={konten} kunci={kunci} nama="s8" />)

    expect(html).toContain('Foto JPG')
    expect(html).toContain('<textarea')
    expect(html).toContain('id="s8-catatan"')
    expect(html).not.toContain('Langkah lengkap')

    const denganKunci = renderToStaticMarkup(
      <SoalTugasUnggah konten={konten} kunci={kunci} tampilkanKunci />,
    )
    expect(denganKunci).toContain('Langkah lengkap')
    expect(denganKunci).toContain('badge-kunci')
  })

  it('teka silang mengisi hanya kotak yang diisi murid', () => {
    const grid = [['', '', ''], ['#', '', '#']]
    const konten = {
      teks: 'Isi teka silang.',
      grid,
      mendatar: [{ nomor: 1, teks: 'Nama hewan mengeong.', sel: ['0,0', '0,1', '0,2'] }],
      menurun: [{ nomor: 2, teks: 'Tengah.', sel: ['0,1', '1,1'] }],
    }

    expect(gridSilang(grid)).toEqual(grid)
    expect(petunjukSilang(konten.mendatar)).toEqual([
      { nomor: '1', teks: 'Nama hewan mengeong.', sel: ['0,0', '0,1', '0,2'] },
    ])

    const html = renderToStaticMarkup(<SoalTekaSilangMini konten={konten} nama="s9" />)

    expect(html.match(/class="silang-isian"/g)).toHaveLength(4)
    expect(html.match(/silang-hitam/g)).toHaveLength(2)
    expect(html).toContain('aria-label="Huruf kotak 0,0"')
    expect(html).toContain('1.</strong> Nama hewan mengeong.')
    expect(html).not.toContain('badge-kunci')

    const denganKunci = renderToStaticMarkup(
      <SoalTekaSilangMini konten={konten} kunci={{ sel: { '0,0': 'k' } }} tampilkanKunci />,
    )
    expect(denganKunci).toContain('badge-kunci')
    expect(denganKunci).toContain('>k<')
  })
})
