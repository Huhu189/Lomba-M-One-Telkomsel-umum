/**
 * Batas panjang jawaban teks (15 Oktober 2026, perbaikan 422 uraian panjang).
 *
 * Kenapa ada: murid yang menulis uraian lebih dari 2.000 karakter kena 422 dari
 * server, tetapi kotak teksnya sama sekali tidak membatasi — jadi tulisan yang
 * kelihatan tersimpan (lokal, di antrean autosave) sebenarnya ditolak server.
 * Batasnya kini 10.000 karakter di KEDUA sisi, dan yang dijaga di sini adalah
 * angka itu benar-benar sama: `BATAS_URAIAN` di renderer dan `jawaban.teks_maks`
 * di backend. Angka yang berbeda di salah satu sisi mengembalikan bug yang sama
 * perlahan-lahan.
 *
 * Markup statis (`renderToStaticMarkup`) sudah cukup: yang diperiksa atribut
 * `maxLength` dan penghitung karakternya, tanpa perlu klien interaktif.
 *
 * Kesamaan angka dengan `backend/config/jawaban.php` diperiksa di sana (PEST),
 * bukan di sini — membaca berkas lintas folder dari tes frontend hanya menambah
 * ketergantungan yang tidak perlu.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BatasKarakter from '../../../sections/question/render/BatasKarakter.jsx'
import SoalIsianSingkat from '../../../sections/question/render/SoalIsianSingkat.jsx'
import SoalUraian from '../../../sections/question/render/SoalUraian.jsx'
import {
  BATAS_ISIAN_SINGKAT,
  BATAS_URAIAN,
  keadaanBatas,
} from '../../../sections/question/render/batasJawaban.js'

describe('keadaanBatas', () => {
  it('aman, hampir, lalu habis', () => {
    expect(keadaanBatas(0, 100)).toBe('aman')
    expect(keadaanBatas(90, 100)).toBe('hampir')
    expect(keadaanBatas(100, 100)).toBe('habis')
    // Lewat batas (mis. teks lama dari sebelum batas ini ada) tetap “habis”,
    // tidak pernah kembali “aman”.
    expect(keadaanBatas(120, 100)).toBe('habis')
  })
})

describe('BatasKarakter', () => {
  it('hanya berisik saat mendekati batas', () => {
    const aman = renderToStaticMarkup(<BatasKarakter id="x" panjang={10} batas={1000} />)
    const hampir = renderToStaticMarkup(<BatasKarakter id="x" panjang={950} batas={1000} />)

    // Di bawah 90%: tidak diumumkan ke pembaca layar (tiap ketikan akan ramai).
    expect(aman).not.toContain('role="status"')
    expect(aman).toContain('10 / 1.000 karakter')
    expect(hampir).toContain('role="status"')
  })

  it('mengatakan batas tercapai, bukan hanya menghitung', () => {
    const habis = renderToStaticMarkup(<BatasKarakter id="x" panjang={1000} batas={1000} />)

    expect(habis).toContain('tercapai')
    expect(habis).toContain('1.000')
  })
})

describe('renderer jawaban panjang', () => {
  it('kotak uraian dibatasi 10.000 karakter dan lebih tinggi dari dulu', () => {
    const html = renderToStaticMarkup(
      <SoalUraian konten={{ teks: 'Jelaskan' }} nilai="abc" onUbah={() => {}} />,
    )

    expect(html).toContain('aria-label="Jawaban uraian"')
    // React menuliskan atributnya sebagai `maxLength` di markup statis.
    expect(html).toContain(`maxLength="${BATAS_URAIAN}"`)
    expect(html).toContain('rows="6"')
  })

  it('isian singkat tetap pendek — batas 200 karakter', () => {
    const html = renderToStaticMarkup(
      <SoalIsianSingkat konten={{ teks: 'Siapa?' }} nilai="Budi" onUbah={() => {}} />,
    )

    expect(html).toContain(`maxLength="${BATAS_ISIAN_SINGKAT}"`)
  })
})
