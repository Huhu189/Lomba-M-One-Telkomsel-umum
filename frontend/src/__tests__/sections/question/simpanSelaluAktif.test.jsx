// @vitest-environment jsdom
/**
 * Tombol Simpan selalu bisa ditekan (14 Oktober 2026, temuan P4).
 *
 * Dulu tombolnya `disabled` sampai SEMUA butir kelengkapan hijau — termasuk
 * "Mapel dipilih" yang kolomnya ada di kartu 3 paling bawah, sementara guru baru
 * mengisi kartu 1–2. Guru menekan tombol abu-abu itu berulang kali tanpa respons
 * apa pun dan menyimpulkan editornya rusak. Sekarang tombolnya aktif: bila ada
 * yang kurang, editor menyebut sebabnya, menggulir ke kolom pertama yang
 * bermasalah, dan butir kelengkapan yang belum bisa diketuk untuk melompat.
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

/** Pasang editor soal baru yang benar-benar kosong (mapel pun belum dipilih). */
function pasang() {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditorSoal
          soal={null}
          daftarMapel={[{ id: 1, nama: 'Matematika' }]}
          daftarTag={[]}
          sedangMenyimpan={false}
          onSimpan={() => {}}
          onBatal={() => {}}
        />
      </QueryClientProvider>,
    )
  })
}

/** @param {string} teks */
function tombol(teks) {
  const el = [...wadah.querySelectorAll('button')].find(
    (satu) => (satu.textContent ?? '').trim() === teks,
  )

  if (!el) throw new Error(`tombol "${teks}" tidak ada`)

  return el
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

describe('EditorSoal — Simpan selalu aktif', () => {
  it('tombol Simpan tidak pernah dinonaktifkan', () => {
    pasang()

    const simpan = /** @type {HTMLButtonElement} */ (tombol('Simpan soal'))

    expect(simpan.disabled).toBe(false)
  })

  it('menekan Simpan dengan data kurang menyebut sebabnya, bukan diam', () => {
    pasang()

    act(() => tombol('Simpan soal').click())

    const teks = wadah.textContent ?? ''

    expect(teks).toContain('Soal belum lengkap')
    expect(teks).toContain('Pilih mapel dulu.')
  })

  it('butir kelengkapan yang belum bisa diketuk untuk melompat ke kolomnya', () => {
    pasang()

    const lompat = wadah.querySelector('[data-lompat-kelengkapan]')

    expect(lompat).not.toBeNull()
    expect(lompat?.getAttribute('data-lompat-kelengkapan')).toBe('soal-mapel')

    // Kolom tujuan memang ada di editor.
    expect(wadah.querySelector('#soal-mapel')).not.toBeNull()
  })
})
