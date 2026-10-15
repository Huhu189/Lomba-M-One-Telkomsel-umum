// @vitest-environment jsdom
/**
 * Penyusun soal lewat grid di dalam editor (14 Oktober 2026).
 *
 * Pemilik produk: "pada pembuatan soal tabel itu sangat buruk … mungkin soal
 * lain juga, buat pembuatannya lebih baik, buat dalam GUI spesifik". Sebelumnya
 * guru mengetik BENTUK TEKS penyusun soal — nama kolom tabel sebagai teks
 * berkoma, grid teka silang sebagai 'kucing\n#n#i#t', dan sinonim uraian sebagai
 * baris 'kata = alias' — sehingga bentuk soalnya baru terlihat setelah disimpan.
 *
 * Berkas ini menguji jalan yang dipakai guru: mengisi grid, menekan tombol
 * tambah/hapus, dan **menyimpan** — muatan yang diterima halaman bank soal
 * diperiksa langsung, jadi bukan hanya tampilannya yang terbukti.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EditorSoal from '../../../sections/question/editor/EditorSoal.jsx'
import { useToastStore } from '../../../shared/ui/toast.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root
/** Muatan tersimpan dari `onSimpan` (null selama belum disimpan). */
let tersimpan = /** @type {any} */ (null)

const daftarMapel = [{ id: 1, nama: 'Matematika' }]

/** @param {string} jenis */
function pasang(jenis) {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditorSoal
          soal={null}
          daftarMapel={daftarMapel}
          daftarTag={[]}
          sedangMenyimpan={false}
          mapelAwal="1"
          jenisAwal={jenis}
          onSimpan={(muatan) => {
            tersimpan = muatan
          }}
          onBatal={() => {}}
        />
      </QueryClientProvider>,
    )
  })
}

/**
 * Kotak isian/kotak pilihan berdasarkan aria-label.
 * @param {string} label
 * @returns {HTMLInputElement}
 */
function isian(label) {
  const el = /** @type {HTMLInputElement|null} */ (wadah.querySelector(`[aria-label="${label}"]`))

  if (!el) throw new Error(`isian "${label}" tidak ada`)

  return el
}

/**
 * Tombol berdasarkan aria-label.
 * @param {string} label
 * @returns {HTMLButtonElement}
 */
function tombol(label) {
  const el = /** @type {HTMLButtonElement|null} */ (wadah.querySelector(`button[aria-label="${label}"]`))

  if (!el) throw new Error(`tombol "${label}" tidak ada`)

  return el
}

/**
 * Tombol berdasarkan teksnya (mis. "Tambah kolom").
 * @param {string} teks
 * @returns {HTMLButtonElement}
 */
function tombolTeks(teks) {
  const el = [...wadah.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === teks)

  if (!el) throw new Error(`tombol "${teks}" tidak ada`)

  return el
}

/**
 * Ketik ke dalam `<input>`/`<textarea>` seperti pengguna mengetik.
 * @param {string} pemilih
 * @param {string} nilai
 */
function isi(pemilih, nilai) {
  const el = /** @type {HTMLInputElement|HTMLTextAreaElement|null} */ (wadah.querySelector(pemilih))

  if (!el) throw new Error(`isian ${pemilih} tidak ada`)

  const prototipe =
    el instanceof window.HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype

  act(() => {
    Object.getOwnPropertyDescriptor(prototipe, 'value')?.set?.call(el, nilai)
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

/** @param {string} label @param {string} teks */
function ketik(label, teks) {
  isi(`[aria-label="${label}"]`, teks)
}

/** @param {string} label */
function klik(label) {
  const el = tombol(label)

  act(() => el.click())
}

/** @param {string} teks */
function klikTeks(teks) {
  const el = tombolTeks(teks)

  act(() => el.click())
}

/** @param {string} teks */
function adaTeks(teks) {
  return (wadah.textContent ?? '').includes(teks)
}

/** @returns {number} */
function jumlahKepalaKolom() {
  return wadah.querySelectorAll('input[aria-label^="Nama kolom"]').length
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

describe('grid tabel isian', () => {
  it('menampilkan tabel sebagai grid: kepala kolom & sel bisa langsung diketik', () => {
    pasang('tabel_isian')

    // Kepala kolom bawaan sudah bernama — tabel tanpa nama kolom ditolak server.
    expect(isian('Nama kolom 1').value).toBe('Soal')
    expect(isian('Nama kolom 2').value).toBe('Jawaban')
    expect(isian('Teks baris 1 kolom 1')).toBeTruthy()

    // Nama kolom tidak lagi diketik sebagai teks berkoma.
    expect(wadah.querySelector('#tabel-kolom')).toBeNull()
    expect(adaTeks('pisahkan dengan koma')).toBe(false)
  })

  it('sel kosong punya kotak jawaban diterima; sel berisi teks tidak dinilai', () => {
    pasang('tabel_isian')

    expect(isian('Jawaban diterima baris 1 kolom 1')).toBeTruthy()

    ketik('Teks baris 1 kolom 1', '3 x 4')
    expect(wadah.querySelector('[aria-label="Jawaban diterima baris 1 kolom 1"]')).toBeNull()
  })

  it('sel kosong tanpa jawaban diterima ditandai di selnya', () => {
    pasang('tabel_isian')

    expect(wadah.querySelectorAll('.tabel-editor-sel.perlu-kunci').length).toBe(2)

    ketik('Jawaban diterima baris 1 kolom 2', '12')
    expect(wadah.querySelectorAll('.tabel-editor-sel.perlu-kunci').length).toBe(1)
  })

  it('tambah kolom & baris memperluas grid, bukan menambah teks', () => {
    pasang('tabel_isian')

    klikTeks('Tambah kolom')
    expect(jumlahKepalaKolom()).toBe(3)
    expect(isian('Nama kolom 3').value).toBe('Kolom 3')
    expect(isian('Teks baris 1 kolom 3')).toBeTruthy()

    klikTeks('Tambah baris')
    expect(isian('Teks baris 2 kolom 3')).toBeTruthy()

    // Ringkasan bentuk tabel mengikuti grid.
    expect(adaTeks('Tabel 3 kolom × 2 baris')).toBe(true)
  })

  it('hapus kolom membuangnya dari kepala tabel dan dari tiap baris', () => {
    pasang('tabel_isian')

    klik('Hapus kolom 1')

    expect(jumlahKepalaKolom()).toBe(1)
    expect(isian('Nama kolom 1').value).toBe('Jawaban')
    // Kolom pertama (r1c1) benar-benar hilang dari barisnya, bukan hanya disembunyikan.
    expect(wadah.querySelector('[aria-label="Teks baris 1 kolom 2"]')).toBeNull()
  })

  it('kolom terakhir tidak hilang diam-diam: sebabnya diucapkan', () => {
    pasang('tabel_isian')

    klik('Hapus kolom 1')
    klik('Hapus kolom 1')

    expect(jumlahKepalaKolom()).toBe(1)
    expect(adaTeks('Tabel wajib punya minimal satu kolom.')).toBe(true)
  })

  it('menyimpan tabel: kolom, baris, dan kunci sel dikirim dari grid', () => {
    pasang('tabel_isian')

    isi('#soal-teks', 'Isi tabel hasil perkalian.')
    ketik('Nama kolom 1', 'Soal')
    ketik('Teks baris 1 kolom 1', '3 x 4')
    ketik('Jawaban diterima baris 1 kolom 2', '12, dua belas')
    klikTeks('Simpan soal')

    expect(tersimpan).toBeTruthy()
    expect(tersimpan.konten).toEqual({
      teks: 'Isi tabel hasil perkalian.',
      kolom: ['Soal', 'Jawaban'],
      baris: [{ id: 'R1', sel: [{ kode: 'r1c1', teks: '3 x 4' }, { kode: 'r1c2' }] }],
    })
    expect(tersimpan.kunci).toEqual({ sel: { r1c2: ['12', 'dua belas'] } })
  })
})

describe('grid teka silang', () => {
  it('huruf diketik langsung di kotaknya, satu huruf per kotak', () => {
    pasang('teka_silang_mini')

    expect(wadah.querySelector('#silang-grid')).toBeNull()

    ketik('Huruf jawaban baris 1 kolom 1', 'k')
    expect(isian('Huruf jawaban baris 1 kolom 1').value).toBe('k')

    // Ketikan kedua mengganti hurufnya (bukan menumpuk) dan huruf kecil disimpan apa adanya.
    ketik('Huruf jawaban baris 1 kolom 1', 'ka')
    expect(isian('Huruf jawaban baris 1 kolom 1').value).toBe('a')
  })

  it('kotak bisa dijadikan kotak hitam dan dikembalikan lagi', () => {
    pasang('teka_silang_mini')

    // Lewat tombol ■ di kotaknya.
    klik('Jadikan kotak hitam baris 2 kolom 3')
    expect(wadah.querySelector('[aria-label="Huruf jawaban baris 2 kolom 3"]')).toBeNull()

    klik('Kotak hitam baris 2 kolom 3 — kembalikan jadi kotak huruf')
    expect(isian('Huruf jawaban baris 2 kolom 3')).toBeTruthy()

    // Lewat ketikan '#' juga, untuk yang lebih suka keyboard.
    ketik('Huruf jawaban baris 1 kolom 1', '#')
    expect(wadah.querySelector('[aria-label="Huruf jawaban baris 1 kolom 1"]')).toBeNull()
  })

  it('tambah & hapus baris/kolom mengubah bentuk grid', () => {
    pasang('teka_silang_mini')

    klikTeks('Tambah kolom')
    expect(isian('Huruf jawaban baris 1 kolom 4')).toBeTruthy()
    expect(isian('Huruf jawaban baris 3 kolom 4')).toBeTruthy()

    klikTeks('Tambah baris')
    expect(isian('Huruf jawaban baris 4 kolom 4')).toBeTruthy()

    klik('Hapus kolom 2')
    expect(wadah.querySelector('[aria-label="Huruf jawaban baris 1 kolom 4"]')).toBeNull()

    klik('Hapus baris 4')
    expect(wadah.querySelector('[aria-label="Huruf jawaban baris 4 kolom 3"]')).toBeNull()
  })

  it('kotak tidak bisa dikurangi sampai di bawah 2 × 2, dan sebabnya diucapkan', () => {
    pasang('teka_silang_mini')

    klik('Hapus kolom 3')
    klik('Hapus kolom 2')
    klik('Hapus kolom 1')

    expect(adaTeks('Teka silang wajib punya minimal 2 kolom.')).toBe(true)
    expect(isian('Huruf jawaban baris 1 kolom 2')).toBeTruthy()
  })

  it('menyimpan teka silang: grid dan huruf jawaban dikirim dari kotaknya', () => {
    pasang('teka_silang_mini')

    const huruf = ['k', 'u', 'c', 'i', 'n', 'g', 'm', 'a', 'u']

    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        ketik(`Huruf jawaban baris ${r + 1} kolom ${c + 1}`, huruf[r * 3 + c])
      }
    }

    isi('#soal-teks', 'Isi teka silang berikut.')
    ketik('Teks petunjuk mendatar 1', 'hewan yang mengeong')
    klikTeks('Simpan soal')

    expect(tersimpan).toBeTruthy()
    // Bentuk kotaknya yang dikirim ke murid: huruf jawaban TIDAK ikut (ada di kunci).
    expect(tersimpan.konten.grid).toEqual([
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ])
    expect(tersimpan.konten.mendatar).toEqual([
      { nomor: 1, teks: 'hewan yang mengeong', sel: ['0,0', '0,1', '0,2'] },
    ])
    expect(tersimpan.kunci.sel).toEqual({
      '0,0': 'k',
      '0,1': 'u',
      '0,2': 'c',
      '1,0': 'i',
      '1,1': 'n',
      '1,2': 'g',
      '2,0': 'm',
      '2,1': 'a',
      '2,2': 'u',
    })
  })
})

describe('sinonim uraian', () => {
  it('disusun sebagai baris kata + alias, bukan teks "kata = alias"', () => {
    pasang('uraian')

    expect(wadah.querySelector('#soal-sinonim-uraian')).toBeNull()
    expect(adaTeks('Belum ada sinonim')).toBe(true)

    klikTeks('Tambah sinonim')
    expect(isian('Kata kunci sinonim 1')).toBeTruthy()
    expect(adaTeks('Belum ada sinonim')).toBe(false)
  })

  it('spasi di dalam kata tetap utuh saat diketik', () => {
    pasang('uraian')

    klikTeks('Tambah sinonim')
    ketik('Kata kunci sinonim 1', 'fotosintesis')
    ketik('Sinonim kata kunci 1', 'rambut ')

    expect(isian('Sinonim kata kunci 1').value).toBe('rambut ')

    ketik('Sinonim kata kunci 1', 'rambut getar, silia')
    expect(isian('Sinonim kata kunci 1').value).toBe('rambut getar, silia')
  })

  it('menambah & menghapus baris sinonim', () => {
    pasang('uraian')

    klikTeks('Tambah sinonim')
    ketik('Kata kunci sinonim 1', 'fotosintesis')
    klikTeks('Tambah sinonim')
    ketik('Kata kunci sinonim 2', 'klorofil')

    klik('Hapus sinonim 1')

    expect(isian('Kata kunci sinonim 1').value).toBe('klorofil')
    expect(wadah.querySelector('[aria-label="Kata kunci sinonim 2"]')).toBeNull()
  })
})
