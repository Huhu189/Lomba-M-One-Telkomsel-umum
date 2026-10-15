import { describe, expect, it } from 'vitest'
import {
  SAJIAN,
  labelDokumen,
  namaBerkas,
  sajianBerkas,
} from '../../../sections/material/berkas/sajianBerkas.js'

describe('sajianBerkas', () => {
  it('memakai sajian dari server apa adanya', () => {
    for (const nilai of SAJIAN) {
      expect(sajianBerkas({ sajian: nilai, tampil_langsung: false })).toBe(nilai)
    }
  })

  it('menurunkan sajian dari tampil_langsung bila server belum mengirimnya', () => {
    // Kontrak lama: kategori umum hanya punya `tampil_langsung`.
    expect(sajianBerkas({ tampil_langsung: true })).toBe('semat')
    expect(sajianBerkas({ tampil_langsung: false })).toBe('unduh')
  })

  it('tidak menampilkan berkas yang tidak dikenal sebagai dokumen', () => {
    // Nilai sajian karangan dari server tidak dipercaya: yang tak dikenal jatuh
    // ke 'unduh', bukan diam-diam disajikan di halaman.
    expect(sajianBerkas({ sajian: 'gratis', tampil_langsung: false })).toBe('unduh')
    expect(sajianBerkas({ sajian: 'gratis', tampil_langsung: true })).toBe('semat')
  })

  it('menganggap berkas yang belum ada sebagai unduhan', () => {
    expect(sajianBerkas(null)).toBe('unduh')
    expect(sajianBerkas(undefined)).toBe('unduh')
    expect(sajianBerkas({})).toBe('unduh')
  })
})

describe('labelDokumen', () => {
  it('membaca jenis dokumen dari mime yang ditetapkan server', () => {
    expect(
      labelDokumen({
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ).toBe('Word')

    expect(
      labelDokumen({
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
    ).toBe('PowerPoint')

    expect(
      labelDokumen({
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    ).toBe('Excel')
  })

  it('memakai nama berkas sebagai cadangan bila mime tidak menjelaskan', () => {
    expect(labelDokumen({ nama_asli: 'Materi Pecahan.pptx' })).toBe('PowerPoint')
    expect(labelDokumen({ nama: 'Daftar Nilai.docx' })).toBe('Word')
    expect(labelDokumen({ nama: 'Rekap.xlsx' })).toBe('Excel')
    expect(labelDokumen({ nama: 'Berkas Lain.pdf' })).toBe('Dokumen')
    expect(labelDokumen({})).toBe('Dokumen')
  })
})

describe('namaBerkas', () => {
  it('mendahulukan nama asli guru, lalu kode unggahan', () => {
    expect(namaBerkas({ nama: 'Dari server', nama_asli: 'Asli.docx' })).toBe('Dari server')
    expect(namaBerkas({ nama_asli: 'Asli.docx' })).toBe('Asli.docx')
    expect(namaBerkas({ kode: 'abc123' })).toBe('abc123')
    expect(namaBerkas({})).toBe('berkas')
  })
})
