/**
 * Tes render statis panel kuis sisipan: tahap mengerjakan (kemajuan, navigasi,
 * tombol kumpulkan di soal terakhir) dan tahap hasil (skor + bintang tertulis,
 * tab hanya untuk yang dibuka guru).
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KuisSisipan from '../../../sections/material/KuisSisipan.jsx'

const attempt = /** @type {any} */ ({
  id: 9,
  soal: [
    { id: 1, nomor: 1, tipe: 'pilihan_ganda', tipe_label: 'Pilihan ganda', konten: { teks: 'Berapa 2 + 3?', opsi: [{ id: 'A', teks: '4' }, { id: 'B', teks: '5' }] } },
    { id: 2, nomor: 2, tipe: 'benar_salah', tipe_label: 'Benar / salah', konten: { teks: 'Langit biru.' } },
  ],
})

const hasil = /** @type {any} */ ({
  id: 9, skor: 3, skor_maksimal: 4, jumlah_benar: 1, jumlah_soal: 2, per_soal: [],
})

/** @param {Record<string, unknown>} lebih */
function render(lebih) {
  const klien = new QueryClient()

  return renderToStaticMarkup(
    <QueryClientProvider client={klien}>
      <KuisSisipan
        attempt={attempt}
        jawaban={{}}
        onUbahJawaban={() => {}}
        hasil={null}
        onKumpulkan={() => {}}
        materiId={1}
        blockId={5}
        labelLanjut="Lanjutkan video"
        onLanjut={() => {}}
        {...lebih}
      />
    </QueryClientProvider>,
  )
}

describe('KuisSisipan — mengerjakan', () => {
  it('menampilkan satu soal, kemajuan tertulis, dan navigasi', () => {
    const html = render({ judul: 'Penjumlahan', catatan: 'Video berhenti sampai kuis ini selesai.' })

    expect(html).toContain('Soal 1 dari 2')
    expect(html).toContain('0/2 terjawab')
    expect(html).toContain('Penjumlahan')
    expect(html).toContain('Berapa 2 + 3?')
    // Soal kedua belum dirender; tombolnya Berikutnya, bukan Kumpulkan.
    expect(html).not.toContain('Langit biru.')
    expect(html).toContain('Berikutnya')
    expect(html).not.toContain('Simpan jawaban &amp; kumpulkan')
    expect(html).toContain('role="progressbar"')
  })

  it('tombol Lewati hanya ada bila diberikan (kuis opsional)', () => {
    expect(render({})).not.toContain('Lewati kuis ini')
    expect(render({ onLewati: () => {} })).toContain('Lewati kuis ini')
  })
})

describe('KuisSisipan — hasil', () => {
  it('skor, persen, dan bintang tertulis sebagai teks', () => {
    const html = render({ hasil })

    expect(html).toContain('Skor 3 dari 4')
    expect(html).toContain('2 dari 3 bintang')
    expect(html).toContain('75 persen')
    expect(html).toContain('Lanjutkan video')
    expect(html).toContain('tidak masuk ranking ulangan')
  })

  it('tanpa saklar guru dan tanpa penjelasan: tidak ada tab sama sekali', () => {
    const html = render({ hasil, tampilan: { mode: 'jeda', tata: 'vertikal' } })

    expect(html).not.toContain('role="tablist"')
    expect(html).not.toContain('Kartu ingat')
  })

  it('dua layar terbuka: tablist muncul hanya untuk yang dibuka', () => {
    const html = render({ hasil, tampilan: { ringkasan: 1, kartu: 1, papan: 0 } })

    expect(html).toContain('role="tablist"')
    expect(html).toContain('Ringkasan soal')
    expect(html).toContain('Kartu ingat')
    expect(html).not.toContain('Peringkat')
  })

  it('penjelasan guru menjadi tab pertama bila ada layar lain', () => {
    const html = render({ hasil, tampilan: { kartu: 1 }, penjelasan: <p>Karena 2 + 3 = 5.</p> })

    expect(html.indexOf('Penjelasan')).toBeLessThan(html.indexOf('Kartu ingat'))
    expect(html).toContain('Karena 2 + 3 = 5.')
  })
})
