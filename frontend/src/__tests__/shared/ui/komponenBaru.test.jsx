/**
 * Tes render komponen fondasi baru (papan Standar): HeaderHalaman, KosongData,
 * Skeleton, TabelData, dan TombolIkon. Semua lewat renderToStaticMarkup supaya
 * tidak butuh DOM; tes interaksi ada di berkas jsdom terpisah.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import HeaderHalaman from '../../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../../shared/ui/KosongData.jsx'
import Skeleton, { SkeletonKartu } from '../../../shared/ui/Skeleton.jsx'
import TabelData from '../../../shared/ui/TabelData.jsx'
import { TombolIkon, Tombol } from '../../../shared/ui/Tombol.jsx'
import { IkonTongSampah, IkonPensil } from '../../../icons.jsx'

function AksiTambah() {
  return <Tombol>Tambah kelas</Tombol>
}

describe('HeaderHalaman', () => {
  it('menyediakan satu h1 berisi judul, jejak, deskripsi, dan slot aksi', () => {
    const html = renderToStaticMarkup(
      <HeaderHalaman judul="Kelas" deskripsi="7 kelas" jejak="Data induk / Kelas">
        <AksiTambah />
      </HeaderHalaman>,
    )
    expect(html.match(/<h1/g)?.length).toBe(1)
    expect(html).toContain('Kelas')
    expect(html).toContain('Data induk / Kelas')
    expect(html).toContain('7 kelas')
    expect(html).toContain('kepala-halaman-aksi')
  })
})

describe('KosongData', () => {
  it('menampilkan judul, penjelasan, dan satu tindakan', () => {
    const html = renderToStaticMarkup(
      <KosongData judul="Belum ada kelas" aksi={<AksiTambah />}>
        Kelas dipakai untuk mengelompokkan murid.
      </KosongData>,
    )
    expect(html).toContain('Belum ada kelas')
    expect(html).toContain('Kelas dipakai untuk mengelompokkan murid.')
    expect(html).toContain('Tambah kelas')
    expect(html).toContain('<svg')
  })

  it('memakai ikon bawaan saat ikon tidak diberikan', () => {
    const html = renderToStaticMarkup(<KosongData judul="Belum ada data" />)
    expect(html).toContain('kosong-data-ikon')
    expect(html).toContain('<svg')
  })
})

describe('Skeleton', () => {
  it('memakai role=status dan hanya membacakan label, bukan kotak kosongnya', () => {
    const html = renderToStaticMarkup(<Skeleton baris={2} label="Memuat kelas…" />)
    expect(html).toContain('role="status"')
    expect(html).toContain('Memuat kelas…')
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(2)
  })

  it('SkeletonKartu membuat satu blok per kartu', () => {
    const html = renderToStaticMarkup(<SkeletonKartu jumlah={3} />)
    expect(html.match(/skeleton-kartu/g)?.length).toBe(3)
  })
})

describe('TabelData', () => {
  const kolom = [
    { kunci: 'nama', judul: 'Kelas' },
    { kunci: 'murid', judul: 'Murid' },
    {
      kunci: 'aksi',
      judul: 'Aksi',
      aksi: true,
      sel: () => <TombolIkon label="Hapus kelas 6A" ikon={IkonTongSampah} varian="bahaya" />,
    },
  ]
  const baris = [{ id: 1, nama: 'Kelas 6A', murid: 31 }]

  it('judul kolom dipindah ke data-label supaya terbaca saat jadi kartu di HP', () => {
    const html = renderToStaticMarkup(
      <TabelData label="Daftar kelas" kolom={kolom} baris={baris} kunciBaris={(b) => b.id} />,
    )
    expect(html).toContain('aria-label="Daftar kelas"')
    expect(html).toContain('data-label="Kelas"')
    expect(html).toContain('data-label="Murid"')
    expect(html).toContain('Hapus kelas 6A')
  })

  it('kolom aksi tidak diberi data-label tetapi tetap punya kelas kolom-aksi', () => {
    const html = renderToStaticMarkup(
      <TabelData label="Daftar kelas" kolom={kolom} baris={baris} kunciBaris={(b) => b.id} />,
    )
    expect(html).not.toContain('data-label="Aksi"')
    expect(html).toContain('kolom-aksi')
  })
})

describe('TombolIkon', () => {
  it('label wajib menjadi aria-label dan teks pembaca layar', () => {
    const html = renderToStaticMarkup(<TombolIkon label="Hapus kelas 6A" ikon={IkonTongSampah} />)
    expect(html).toContain('aria-label="Hapus kelas 6A"')
    expect(html).toContain('sr-saja')
    expect(html).toContain('<svg')
    expect(html).toContain('btn-ikon')
  })

  it('memakai judul sama dengan label bila title tidak diberikan', () => {
    const html = renderToStaticMarkup(<TombolIkon label="Ubah kelas 6A" ikon={IkonPensil} />)
    expect(html).toContain('title="Ubah kelas 6A"')
  })
})

describe('varian dan ukuran Tombol', () => {
  it('varian bahaya memakai kelas btn-bahaya', () => {
    expect(renderToStaticMarkup(<Tombol varian="bahaya">Hapus kelas</Tombol>)).toContain('btn-bahaya')
  })

  it('ukuran sedang memakai kelas btn-sedang, ukuran besar tetap btn-besar', () => {
    expect(renderToStaticMarkup(<Tombol ukuran="sedang">Ubah</Tombol>)).toContain('btn-sedang')
    expect(renderToStaticMarkup(<Tombol besar>Kirim</Tombol>)).toContain('btn-besar')
    expect(renderToStaticMarkup(<Tombol>Biasa</Tombol>)).not.toContain('btn-sedang')
  })
})
