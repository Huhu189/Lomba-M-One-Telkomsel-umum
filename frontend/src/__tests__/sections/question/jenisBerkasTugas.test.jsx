// @vitest-environment jsdom
/**
 * Jenis berkas yang boleh diunggah pada tugas unggah (14 Oktober 2026).
 *
 * Permintaan pemilik produk: "jenis berkas yang boleh diunggah itu jangan buat
 * manual diketik, buat opsi banyak … pakai itu, makanya boleh semua, hingga
 * tertentu saja". Dulu guru mengetik teks bebas ("Foto JPG atau PNG") yang tidak
 * pernah diperiksa terhadap apa yang benar-benar bisa diunggah murid; sekarang
 * jenisnya dipilih dari daftar yang dicerminkan dari unggahan murid
 * (`sections/attempt/komponen/UnggahLampiran.jsx`) dan klasifikasi isi berkas di server
 * (`Sections/Material/Services/KlasifikasiBerkas.php`).
 *
 * Dua hal diuji di sini: helper murni yang menentukan kalimat `jenis_berkas`,
 * dan **apa yang benar-benar dikirim** saat guru menyimpan lewat editor.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EditorSoal from '../../../sections/question/editor/EditorSoal.jsx'
import {
  JENIS_BERKAS_TUGAS,
  MAKS_JENIS_BERKAS,
  centangJenisBerkas,
  pilihanJenisBerkas,
  teksJenisBerkas,
} from '../../../sections/question/tipeSoal.js'
import { useToastStore } from '../../../shared/ui/toast.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

describe('pilihanJenisBerkas (membaca teks tersimpan)', () => {
  it('teks kosong tidak mencentang apa pun', () => {
    expect(pilihanJenisBerkas('')).toEqual([])
    expect(pilihanJenisBerkas(null)).toEqual([])
  })

  it('"Semua jenis berkas" mencentang pilihan semua saja', () => {
    expect(pilihanJenisBerkas('Semua jenis berkas')).toEqual(['semua'])
    expect(pilihanJenisBerkas('semua berkas boleh')).toEqual(['semua'])
  })

  it('soal lama berbahasa bebas tetap terbaca: "Foto JPG atau PNG" → gambar', () => {
    expect(pilihanJenisBerkas('Foto JPG atau PNG')).toEqual(['gambar'])
    expect(pilihanJenisBerkas('foto')).toEqual(['gambar'])
    expect(pilihanJenisBerkas('PDF dan video')).toEqual(['pdf', 'video'])
    expect(pilihanJenisBerkas('rekaman suara')).toEqual(['suara'])
  })

  it('teks yang tidak dikenali tidak diam-diam jadi "semua"', () => {
    // Diam-diam memperlonggar aturan justru berbahaya: guru mempersempit ke
    // sesuatu yang tak terbaca, lalu semua berkas diterima tanpa ia sadari.
    expect(pilihanJenisBerkas('daun pisang')).toEqual([])
  })
})

describe('teksJenisBerkas (kalimat yang dibaca murid)', () => {
  it('menyusun kalimat dari pilihan, urut seperti daftarnya', () => {
    expect(teksJenisBerkas(['pdf', 'gambar'])).toBe('Foto (JPG/PNG), Dokumen PDF')
    expect(teksJenisBerkas(['semua'])).toBe('Semua jenis berkas')
    expect(teksJenisBerkas([])).toBe('')
  })

  it('semua pilihan sekaligus masih di bawah batas server', () => {
    const penuh = teksJenisBerkas(JENIS_BERKAS_TUGAS.filter((satu) => satu.nilai !== 'semua').map((satu) => satu.nilai))

    expect(penuh.length).toBeGreaterThan(0)
    expect(penuh.length).toBeLessThanOrEqual(MAKS_JENIS_BERKAS)
  })
})

describe('centangJenisBerkas (aturan centang)', () => {
  it('"semua" menggantikan pilihan lain, dan pilihan lain melepas "semua"', () => {
    expect(centangJenisBerkas(['gambar', 'pdf'], 'semua')).toEqual(['semua'])
    expect(centangJenisBerkas(['semua'], 'pdf')).toEqual(['pdf'])
  })

  it('mencentang dua kali melepas centangnya', () => {
    expect(centangJenisBerkas(['pdf'], 'pdf')).toEqual([])
    expect(centangJenisBerkas(['gambar'], 'pdf')).toEqual(['gambar', 'pdf'])
    expect(centangJenisBerkas(['semua'], 'semua')).toEqual([])
  })
})

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root
/** Muatan tersimpan dari `onSimpan`. */
let tersimpan = /** @type {any} */ (null)

/** Pasang editor untuk soal baru bertipe tugas unggah. */
function pasang() {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditorSoal
          soal={null}
          daftarMapel={[{ id: 1, nama: 'Matematika' }]}
          daftarTag={[]}
          sedangMenyimpan={false}
          mapelAwal="1"
          jenisAwal="tugas_unggah"
          onSimpan={(muatan) => {
            tersimpan = muatan
          }}
          onBatal={() => {}}
        />
      </QueryClientProvider>,
    )
  })
}

/** @param {string} id */
function centang(id) {
  const el = /** @type {HTMLInputElement|null} */ (wadah.querySelector(`#${id}`))

  if (!el) throw new Error(`centang ${id} tidak ada`)

  act(() => el.click())
}

/** @param {string} teks */
function tombolTeks(teks) {
  const el = [...wadah.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === teks)

  if (!el) throw new Error(`tombol "${teks}" tidak ada`)

  return el
}

/** @param {string} pemilih @param {string} nilai */
function isi(pemilih, nilai) {
  const el = /** @type {HTMLInputElement|HTMLTextAreaElement|null} */ (wadah.querySelector(pemilih))

  if (!el) throw new Error(`isian ${pemilih} tidak ada`)

  const proto = el instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype

  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, nilai)
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  tersimpan = null
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('pilihan jenis berkas di editor', () => {
  it('menampilkan pilihan jenis berkas, bukan isian teks bebas', () => {
    pasang()

    const kotak = wadah.querySelectorAll('.pilihan-jenis-berkas input[type="checkbox"]')

    expect(kotak.length).toBe(JENIS_BERKAS_TUGAS.length)
    // Isian teks bebas yang lama sudah tidak ada.
    expect(wadah.querySelector('#tugas-jenis')).toBeNull()
  })

  it('tugas unggah baru sudah memilih "Semua jenis berkas"', () => {
    pasang()

    const semua = /** @type {HTMLInputElement} */ (wadah.querySelector('#tugas-jenis-semua'))

    expect(semua.checked).toBe(true)
    expect(wadah.textContent ?? '').toContain('Semua jenis berkas')
  })

  it('memilih PDF saja mengganti "semua" dan menyimpan kalimatnya', () => {
    pasang()

    isi('#soal-teks', 'Unggah hasil kerjamu.')
    // Rubrik wajib terisi sebelum soal boleh disimpan (cermin server).
    isi('[aria-label="Butir rubrik 1"]', 'Langkah pengerjaan lengkap')
    centang('tugas-jenis-pdf')

    const semua = /** @type {HTMLInputElement} */ (wadah.querySelector('#tugas-jenis-semua'))
    const pdf = /** @type {HTMLInputElement} */ (wadah.querySelector('#tugas-jenis-pdf'))

    expect(semua.checked).toBe(false)
    expect(pdf.checked).toBe(true)

    act(() => tombolTeks('Simpan soal')?.click())

    expect(tersimpan).toBeTruthy()
    expect(tersimpan.konten.jenis_berkas).toBe('Dokumen PDF')
  })

  it('menambahkan pilihan lain menggabungkan kalimatnya', () => {
    pasang()

    centang('tugas-jenis-pdf')
    centang('tugas-jenis-suara')

    // "Murid membaca" memperlihatkan kalimat yang benar-benar sampai ke murid.
    expect(wadah.textContent ?? '').toContain('Dokumen PDF, Suara (MP3/WAV)')

    // Mencentang "gambar" menyisipkannya di depan (urut sesuai daftar pilihan).
    centang('tugas-jenis-gambar')

    expect(wadah.textContent ?? '').toContain('Foto (JPG/PNG), Dokumen PDF, Suara (MP3/WAV)')
  })
})

describe('soal lama dengan jenis berkas teks bebas', () => {
  /** @param {string} jenis */
  function pasangLama(jenis) {
    act(() => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <EditorSoal
            soal={{
              id: 9,
              subject_id: 1,
              tag_id: null,
              tipe: 'tugas_unggah',
              tipe_label: 'Tugas unggah',
              objektif: false,
              konten: { teks: 'Unggah fotonya.', jenis_berkas: jenis },
              kunci: { rubrik: [{ butir: 'Rapi', poin: 2 }] },
              pembahasan: null,
              skor: 5,
              aktif: true,
            }}
            daftarMapel={[{ id: 1, nama: 'Matematika' }]}
            daftarTag={[]}
            sedangMenyimpan={false}
            mapelAwal="1"
            onSimpan={(muatan) => {
              tersimpan = muatan
            }}
            onBatal={() => {}}
          />
        </QueryClientProvider>,
      )
    })
  }

  it('teks lama yang terbaca dicentang ulang tanpa mengubah kalimatnya', () => {
    pasangLama('Foto JPG atau PNG')

    const gambar = /** @type {HTMLInputElement} */ (wadah.querySelector('#tugas-jenis-gambar'))

    expect(gambar.checked).toBe(true)
  })

  it('teks lama yang tidak terbaca diminta dipilih ulang, bukan diam-diam jadi semua', () => {
    pasangLama('coretan pensil')

    const semua = /** @type {HTMLInputElement} */ (wadah.querySelector('#tugas-jenis-semua'))

    expect(semua.checked).toBe(false)
    expect(wadah.textContent ?? '').toContain('Pilih ulang jenis berkasnya')
    expect(wadah.textContent ?? '').toContain('coretan pensil')
  })
})
