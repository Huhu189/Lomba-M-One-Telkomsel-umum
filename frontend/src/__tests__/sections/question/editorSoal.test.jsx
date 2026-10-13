/**
 * Tes render EditorSoal — kartu soal pilihan ganda (13 Oktober 2026).
 *
 * Memakai renderToStaticMarkup supaya tidak butuh DOM: yang diperiksa adalah
 * URUTAN dan bentuk markup kartu soal sesuai permintaan pemilik produk —
 * pertanyaan di paling atas, pilihan jawaban menempel langsung di bawahnya
 * sebagai baris dengan lingkaran kunci di kiri, dan poin di kanan atas.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EditorSoal from '../../../sections/question/EditorSoal.jsx'

const daftarMapel = [{ id: 1, nama: 'Matematika' }]

function render() {
  return renderToStaticMarkup(
    <EditorSoal
      soal={null}
      daftarMapel={daftarMapel}
      daftarTag={[]}
      sedangMenyimpan={false}
      onSimpan={() => {}}
      onBatal={() => {}}
    />,
  )
}

describe('EditorSoal — kartu soal pilihan ganda', () => {
  it('menaruh pertanyaan di atas, lalu pilihan sebagai baris berlingkaran kunci', () => {
    const html = render()

    const teks = html.indexOf('id="soal-teks"')
    const baris = html.indexOf('baris-opsi')
    expect(teks).toBeGreaterThan(-1)
    // Pertanyaan muncul sebelum baris pilihan.
    expect(teks).toBeLessThan(baris)

    // Tiap pilihan punya lingkaran kunci (radio) di kiri + huruf opsi.
    expect(html).toContain('pilih-opsi')
    expect(html).toContain('id="kunci-A"')
    expect(html).toContain('id="kunci-B"')
    expect(html).toContain('Tandai A sebagai jawaban benar')

    // Opsi pertama ('A') ditandai sebagai kunci pada state kosong.
    expect(html).toContain('baris-opsi kunci')
  })

  it('menempelkan Poin di kanan atas dan Mapel di kartu pengaturan (bawah pilihan)', () => {
    const html = render()

    // Poin ada dan berada sebelum pilihan.
    expect(html).toContain('id="soal-skor"')
    expect(html.indexOf('id="soal-skor"')).toBeLessThan(html.indexOf('baris-opsi'))

    // Mapel tidak lagi di atas pertanyaan: ia duduk SETELAH pilihan.
    expect(html.indexOf('baris-opsi')).toBeLessThan(html.indexOf('id="soal-mapel"'))
  })

  it('melipat pemilih jenis jadi satu chip supaya pertanyaan cepat dijangkau', () => {
    const html = render()

    // Pemilih jenis adalah <details> yang TERTUTUP secara bawaan (tanpa `open`).
    expect(html).toContain('class="pemilih-jenis"')
    expect(html).not.toMatch(/<details[^>]*\sopen/)
    // Chip menampilkan jenis aktif dan menyebut 22 jenis di baliknya.
    expect(html).toContain('pemilih-jenis-terpilih')
    expect(html).toContain('Ketuk untuk ganti jenis soal')
    // Jenis soal tetap di ATAS formulir.
    expect(html.indexOf('id="soal-judul-1"')).toBeLessThan(html.indexOf('id="soal-teks"'))
  })

  it('meringkas kunci di bawah soal', () => {
    const html = render()
    const ringkas = html.indexOf('ringkas-kunci-soal')
    expect(ringkas).toBeGreaterThan(-1)
    expect(html.indexOf('baris-opsi')).toBeLessThan(ringkas)
  })
})
