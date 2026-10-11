/**
 * Tes komponen peta perjalanan (render statis): prioritas latar (video guru →
 * adegan yang digambar sendiri → foto → gradien), mode "tanpa peta", daftar pos
 * sebagai teks (bukan hanya warna), dan label aksesibilitas.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PetaPerjalanan, {
  FOTO_ADEgan,
  adeganDigambar,
  fotoAdegan,
} from '../../../sections/material/PetaPerjalanan.jsx'

/**
 * @param {Partial<import('../../../sections/material/perjalanan.js').DataPerjalanan>} [ubah]
 * @returns {import('../../../sections/material/perjalanan.js').DataPerjalanan}
 */
function peta(ubah = {}) {
  return {
    kode: 'mendaki-gunung',
    nama: 'Mendaki Gunung',
    tanpa: false,
    adegan: 'gunung',
    satuan: 'pos',
    deskripsi: 'Naik dari basecamp ke puncak.',
    video_url: null,
    langkah: [
      { block_id: 1, nomor: 1, nama: 'Basecamp', ikon: 'tenda', warna: 'hijau', wajib: true, status: 'selesai', selesai: true },
      { block_id: 2, nomor: 2, nama: 'Sungai Deras', ikon: 'sungai', warna: 'biru', wajib: true, status: 'belum', selesai: false },
      { block_id: 3, nomor: 3, nama: 'Jalan Pintas', ikon: 'batu', warna: 'coklat', wajib: false, status: 'belum', selesai: false },
      { block_id: 4, nomor: 4, nama: 'Puncak', ikon: 'bendera', warna: 'jingga', wajib: true, status: 'belum', selesai: false },
    ],
    jumlah_langkah: 4,
    posisi: 2,
    selesai: 1,
    total: 3,
    persen: 33,
    tuntas: false,
    tingkat: { nomor: 2, nama: 'Pendaki Terlatih', min: 25, puncak: false },
    tingkat_berikut: { nomor: 3, nama: 'Penjelajah Lereng', min: 60, sisa: 27 },
    ...ubah,
  }
}

describe('PetaPerjalanan', () => {
  it('menggambar adegan gunung dari sudut pandang mendongak, bukan foto', () => {
    const html = renderToStaticMarkup(<PetaPerjalanan perjalanan={peta()} />)

    expect(html).toContain('data-latar="ilustrasi"')
    expect(html).toContain('jelajah-adegan')
    // Adegan digambar sendiri: tidak ada lagi foto pihak lain di panggung.
    expect(html).not.toContain('jelajah-foto')
    expect(html).not.toContain('/tema/gunung.jpg')
    // Unsur pembentuk sudut pandang dari bawah + bagian yang dianimasikan.
    expect(html).toContain('jelajah-matahari')
    expect(html).toContain('jelajah-awan')
    expect(html).toContain('jelajah-kabut')
    expect(html).toContain('jelajah-burung')
    expect(html).toContain('jelajah-lereng-depan')
    expect(html).toContain('preserveAspectRatio="xMidYMid slice"')
    // Empat pos = tiga ruas garis pada peta.
    expect(html.match(/jelajah-ruas/g)).toHaveLength(3)
    // Ruas pertama sudah dilewati, dua ruas sisa masih putus-putus.
    expect(html.match(/jelajah-ruas" data-status="dilewati"/g)).toHaveLength(1)
    expect(html.match(/jelajah-ruas" data-status="belum"/g)).toHaveLength(2)
  })

  it('memakai video latar bila guru mengunggahnya, bukan latar foto/SVG', () => {
    const html = renderToStaticMarkup(
      <PetaPerjalanan perjalanan={peta({ video_url: 'https://contoh.test/latar.mp4' })} />,
    )

    expect(html).toContain('jelajah-video')
    expect(html).toContain('muted')
    expect(html).toContain('playsInline')
    expect(html).not.toContain('jelajah-adegan')
    expect(html).not.toContain('jelajah-foto')
    expect(html).toContain('data-latar="video"')
  })

  it('tidak lagi memakai foto pihak lain: gunung jadi adegan yang digambar', () => {
    // Jalur foto tetap ada untuk tema berikutnya, tetapi kosong — foto gunung
    // sungguhan sudah dibuang dari repo.
    expect(FOTO_ADEgan.gunung).toBeUndefined()
    expect(fotoAdegan('gunung')).toBeNull()
    expect(fotoAdegan('polos')).toBeNull()
    expect(fotoAdegan(undefined)).toBeNull()

    expect(adeganDigambar('gunung')).toBe(true)
    expect(adeganDigambar('polos')).toBe(false)
    expect(adeganDigambar(undefined)).toBe(false)

    const html = renderToStaticMarkup(<PetaPerjalanan perjalanan={peta()} />)
    expect(html).toContain('data-latar="ilustrasi"')
    expect(html).not.toContain('jelajah-foto')
  })

  it('memakai latar gradien tenang bila tema tidak punya foto', () => {
    const html = renderToStaticMarkup(<PetaPerjalanan perjalanan={peta({ adegan: 'polos' })} />)

    expect(html).toContain('data-latar="gradien"')
    expect(html).not.toContain('jelajah-foto')
    expect(html).not.toContain('jelajah-adegan')
    // Panggung, jalur, dan pos tetap ada walau tanpa media.
    expect(html).toContain('jelajah-panggung')
    expect(html).toContain('jelajah-ruas')
  })

  it('mode tanpa peta tidak menggambar panggung, hanya kemajuan + daftar bagian', () => {
    const html = renderToStaticMarkup(
      <PetaPerjalanan
        perjalanan={peta({
          tanpa: true,
          satuan: 'bagian',
          tingkat: { nomor: 1, nama: '', min: 0, puncak: false },
        })}
      />,
    )

    expect(html).toContain('data-tanpa="true"')
    expect(html).toContain('Tanpa peta perjalanan')
    expect(html).not.toContain('jelajah-panggung')
    expect(html).not.toContain('jelajah-pos')
    expect(html).not.toContain('jelajah-foto')
    expect(html).not.toContain('jalur')
    expect(html).not.toContain('Tingkat')
    // Daftar bagian tetap ada, lengkap dengan status sebagai teks.
    expect(html).toContain('jelajah-daftar')
    expect(html).toContain('sudah dilewati')
    expect(html).toContain('1/3 bagian wajib selesai')
  })

  it('mode tanpa peta yang ringkas hanya menyisakan bilah kemajuan', () => {
    const html = renderToStaticMarkup(<PetaPerjalanan perjalanan={peta({ tanpa: true })} ringkas />)

    expect(html).toContain('data-tanpa="true"')
    expect(html).not.toContain('jelajah-daftar')
  })

  it('menyebut posisi, tingkat, dan pos berikutnya dalam teks', () => {
    const html = renderToStaticMarkup(<PetaPerjalanan perjalanan={peta()} />)

    expect(html).toContain('pos 2 dari 4')
    expect(html).toContain('Tingkat 2')
    expect(html).toContain('Pendaki Terlatih')
    expect(html).toContain('27% lagi untuk tingkat')
    expect(html).toContain('Penjelajah Lereng')
  })

  it('memberi status tiap pos sebagai teks, bukan hanya warna', () => {
    const html = renderToStaticMarkup(<PetaPerjalanan perjalanan={peta()} />)

    expect(html).toContain('sudah dilewati')
    expect(html).toContain('sedang ditempuh')
    expect(html).toContain('belum dibuka')
    expect(html).toContain('Jalan Pintas (opsional)')
  })

  it('menyediakan label aksesibilitas pada panggung peta', () => {
    const html = renderToStaticMarkup(<PetaPerjalanan perjalanan={peta()} />)

    expect(html).toContain('aria-label="Peta perjalanan Mendaki Gunung. pos 2 dari 4"')
    expect(html).toContain('Posisi kamu: Sungai Deras')
  })

  it('memakai nama tema ganti guru sebagai judul', () => {
    const html = renderToStaticMarkup(
      <PetaPerjalanan perjalanan={peta({ nama: 'Ekspedisi 3A' })} judul="Ekspedisi 3A" />,
    )

    expect(html).toContain('Ekspedisi 3A')
  })

  it('mode ringkas menyembunyikan daftar pos', () => {
    const penuh = renderToStaticMarkup(<PetaPerjalanan perjalanan={peta()} />)
    const ringkas = renderToStaticMarkup(<PetaPerjalanan perjalanan={peta()} ringkas />)

    expect(penuh).toContain('jelajah-daftar')
    expect(ringkas).not.toContain('jelajah-daftar')
    // Peta dan keterangannya tetap ada di mode ringkas.
    expect(ringkas).toContain('jelajah-panggung')
    expect(ringkas).toContain('pos 2 dari 4')
  })

  it('tidak menempelkan warna mentah di markup (warna dari kelas tema)', () => {
    const html = renderToStaticMarkup(<PetaPerjalanan perjalanan={peta()} />)

    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })

  it('menandai perjalanan tuntas tanpa menyisakan janji tingkat berikutnya', () => {
    const html = renderToStaticMarkup(
      <PetaPerjalanan
        perjalanan={peta({ persen: 100, tuntas: true, selesai: 3, tingkat_berikut: null })}
      />,
    )

    expect(html).toContain('Mendaki Gunung tuntas')
    expect(html).not.toContain('lagi untuk tingkat')
  })
})
