// @vitest-environment jsdom
/**
 * Tombol hapus pilihan jawaban selalu menjawab (14 Oktober 2026).
 *
 * Keluhan nyata: "tombol hapusnya itu ketika belum ditambahkan pilihan baru sama
 * sekali tidak bereaksi — begitu ditambah pilihan baru, baru bereaksi". Sebabnya
 * tombol itu `disabled` selama jumlah pilihan masih di batas minimum, dan
 * fungsinya juga `return` diam-diam. Guru yang menekannya tidak mendapat apa pun,
 * jadi tombolnya terasa rusak.
 *
 * Sekarang tombolnya aktif dan sebabnya diucapkan: pilihan yang ada tidak dibuang,
 * catatan muncul di barisnya ("Pilihan jawaban minimal 2 …"), dan begitu ada
 * pilihan tambahan, tombol yang sama benar-benar membuang barisnya.
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

const daftarMapel = [{ id: 1, nama: 'Matematika' }]

function pasang() {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditorSoal
          soal={null}
          daftarMapel={daftarMapel}
          daftarTag={[]}
          sedangMenyimpan={false}
          onSimpan={() => {}}
          onBatal={() => {}}
        />
      </QueryClientProvider>,
    )
  })
}

/**
 * Semua tombol hapus pilihan (ada satu per baris opsi).
 * @returns {HTMLButtonElement[]}
 */
function tombolHapus() {
  return /** @type {HTMLButtonElement[]} */ (
    [...wadah.querySelectorAll('button[aria-label^="Hapus pilihan"]')]
  )
}

/**
 * @param {string} teks
 * @returns {HTMLButtonElement|null}
 */
function tombolTeks(teks) {
  return (
    /** @type {HTMLButtonElement|undefined} */ (
      [...wadah.querySelectorAll('button')].find((b) => b.textContent?.trim() === teks)
    ) ?? null
  )
}

/** @param {string} teks */
function teksHalaman(teks) {
  return (wadah.textContent ?? '').includes(teks)
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('EditorSoal — tombol hapus pilihan jawaban', () => {
  it('tidak disabled saat pilihan masih di batas minimum', () => {
    pasang()

    const tombol = tombolHapus()
    expect(tombol.length).toBe(2)
    expect(tombol.every((b) => b.disabled === false)).toBe(true)
  })

  it('menekannya di batas minimum mengucapkan sebabnya, bukan diam', () => {
    pasang()

    act(() => tombolHapus()[0]?.click())

    // Pilihan yang ada TIDAK ikut terbuang.
    expect(tombolHapus().length).toBe(2)
    expect(teksHalaman('Pilihan jawaban minimal 2')).toBe(true)
    expect(
      useToastStore.getState().toasts.map((/** @type {{ pesan: string }} */ satu) => satu.pesan).join(' | '),
    ).toContain('Pilihan jawaban minimal 2')
  })

  it('setelah ada pilihan tambahan, tombol yang sama benar-benar membuang barisnya', () => {
    pasang()

    act(() => tombolTeks('Tambah pilihan')?.click())
    expect(tombolHapus().length).toBe(3)

    // Catatan dari percobaan sebelumnya hilang begitu pilihan benar-benar dibuang.
    act(() => tombolHapus()[0]?.click())

    expect(tombolHapus().length).toBe(2)
    expect(teksHalaman('Pilihan jawaban minimal 2')).toBe(false)
  })

  it('catatan lama tidak tertinggal setelah pilihan kembali ditambah', () => {
    pasang()

    act(() => tombolHapus()[0]?.click())
    expect(teksHalaman('Pilihan jawaban minimal 2')).toBe(true)

    act(() => tombolTeks('Tambah pilihan')?.click())
    expect(teksHalaman('Pilihan jawaban minimal 2')).toBe(false)
  })
})
