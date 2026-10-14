// @vitest-environment jsdom
/**
 * Mengurutkan lewat ketukan (14 Oktober 2026, temuan M2).
 *
 * Dulu tiap item punya kotak angka kecil yang harus diketik 1, 2, 3 … lewat
 * keyboard angka yang naik-turun, dan nomor kembar ("1,1,3") bisa terjadi tanpa
 * peringatan. Kini ketukan pertama jadi nomor 1, berikutnya 2, dan seterusnya —
 * nomornya diturunkan dari urutan daftar sehingga kembar tidak mungkin. Bentuk
 * nilai yang dikirim tetap `{idItem: "posisi"}` supaya penilaian server dan
 * jawaban lama tidak berubah.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SoalMengurutkan from '../../../sections/question/render/SoalMengurutkan.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

const konten = {
  teks: 'Urutkan dari yang terkecil.',
  item: [
    { id: 'I1', teks: '9' },
    { id: 'I2', teks: '2' },
    { id: 'I3', teks: '5' },
  ],
}

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root
/** @type {Record<string, string>|null} */
let terkirim = null

/**
 * Pasang dengan nilai awal (atau tanpa jawaban sama sekali).
 * @param {Record<string, string>|null} nilai
 */
function pasang(nilai = null) {
  act(() => {
    root.render(
      <SoalMengurutkan
        konten={konten}
        nilai={nilai}
        onUbah={(baru) => (terkirim = /** @type {Record<string, string>} */ (baru))}
      />,
    )
  })
}

/**
 * Pasang seperti dipakai halaman sungguhan: nilai jawaban disimpan pemanggil,
 * jadi ketukan berturut-turut benar-benar menumpuk (komponen ini terkendali).
 */
function pasangBerjalan() {
  /** @type {Record<string, string>|null} */
  let nilai = null

  function gambar() {
    root.render(
      <SoalMengurutkan
        konten={konten}
        nilai={nilai}
        onUbah={(baru) => {
          const barunya = /** @type {Record<string, string>} */ (baru)

          nilai = barunya
          terkirim = barunya
          act(() => gambar())
        }}
      />,
    )
  }

  act(() => gambar())
}

/** @param {string} pemilih */
function klik(pemilih) {
  const el = /** @type {HTMLElement|null} */ (wadah.querySelector(pemilih))

  if (!el) throw new Error(`${pemilih} tidak ada`)

  act(() => el.click())
}

beforeEach(() => {
  terkirim = null
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('SoalMengurutkan — ketuk untuk memberi nomor', () => {
  it('tidak ada kotak angka sama sekali', () => {
    pasang()

    expect(wadah.querySelectorAll('input[type="number"]')).toHaveLength(0)
  })

  it('ketukan berurutan memberi nomor 1, 2, 3', () => {
    pasangBerjalan()

    klik('[data-urut-pilih="I2"]')
    klik('[data-urut-pilih="I3"]')
    klik('[data-urut-pilih="I1"]')

    expect(terkirim).toEqual({ I2: '1', I3: '2', I1: '3' })
  })

  it('mengetuk item yang sudah berposisi membatalkannya', () => {
    pasangBerjalan()
    klik('[data-urut-pilih="I2"]')
    klik('[data-urut-pilih="I3"]')

    klik('[data-urut-pilih="I2"]')

    expect(terkirim).toEqual({ I3: '1' })
  })

  it('▲▼ menukar posisi dengan tetangganya', () => {
    pasang({ I2: '1', I1: '2', I3: '3' })

    klik('[data-urut-naik="I3"]')

    expect(terkirim).toEqual({ I2: '1', I3: '2', I1: '3' })
  })

  it('jawaban lama tetap terbaca di posisinya', () => {
    pasang({ I1: '2', I2: '1', I3: '3' })

    // Barisnya tetap urut mengikuti daftar item, tetapi nomornya menunjukkan
    // posisi yang tersimpan: I1 nomor 2, I2 nomor 1, I3 nomor 3.
    const nomor = [...wadah.querySelectorAll('[data-urut]')].map((satu) =>
      satu.getAttribute('data-urut'),
    )

    expect(nomor).toEqual(['2', '1', '3'])
    expect(wadah.textContent).toContain('3 dari 3 item sudah diberi nomor')
  })
})
