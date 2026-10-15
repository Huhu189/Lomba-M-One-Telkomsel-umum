// @vitest-environment jsdom
/**
 * Mapel baru dibuat langsung dari editor soal (14 Oktober 2026).
 *
 * Sebelumnya sekolah yang belum punya mapel terkunci dari bank soal: mapel wajib
 * saat menyimpan, tetapi satu-satunya jalan membuatnya ada di halaman Mapel —
 * guru harus keluar dari soal yang sedang ditulis. Sekarang tombol "Mapel baru"
 * di sebelah pemilih mapel membuka isian nama (+ kode opsional), dan mapel yang
 * tersimpan **langsung dipakai soal ini**.
 *
 * Yang dikunci di sini:
 * 1. isian mapel baru sudah terbuka sendiri saat sekolah belum punya mapel;
 * 2. yang dikirim ke server hanya nama (dan kode bila diisi) — spasi tepi dibuang;
 * 3. mapel yang baru dibuat benar-benar terpilih di soal, dan pemanggil diberi tahu
 *    supaya daftar mapelnya disegarkan;
 * 4. galat server (mis. nama sudah dipakai) terbaca di panelnya, bukan hilang.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EditorSoal from '../../../sections/question/editor/EditorSoal.jsx'
import { useToastStore } from '../../../shared/ui/toast.jsx'

vi.mock('../../../sections/school/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, buatMapel: vi.fn() }
})

const api = await import('../../../sections/school/api.js')
const buatMapel = /** @type {import('vitest').Mock} */ (api.buatMapel)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

/**
 * Panggung tiruan halaman bank soal: ia memegang daftar mapelnya sendiri dan
 * menyegarkannya saat editor melaporkan mapel baru — persis seperti kueri
 * `['mapel']` yang di-invalidate di aplikasi.
 * @param {{ adaAwal?: boolean, onDibuat?: () => void }} props
 */
function Panggung({ adaAwal = true, onDibuat }) {
  const [daftar, setDaftar] = useState(adaAwal ? [{ id: 1, nama: 'Matematika' }] : [])

  return (
    <EditorSoal
      soal={null}
      daftarMapel={daftar}
      daftarTag={[]}
      sedangMenyimpan={false}
      onSimpan={() => {}}
      onBatal={() => {}}
      onMapelDibuat={() => {
        setDaftar((lama) => [...lama, { id: 7, nama: 'Bahasa Indonesia' }])
        onDibuat?.()
      }}
    />
  )
}

/** @param {{ adaAwal?: boolean, onDibuat?: () => void }} [props] */
function pasang(props = {}) {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Panggung {...props} />
      </QueryClientProvider>,
    )
  })
}

/**
 * Isi `<input>` seperti pengguna mengetik (React membaca event `input`).
 * @param {string} pemilih
 * @param {string} nilai
 */
function isi(pemilih, nilai) {
  const input = /** @type {HTMLInputElement|null} */ (wadah.querySelector(pemilih))
  if (!input) throw new Error(`isian ${pemilih} tidak ada`)

  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, nilai)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

/** @param {string} teks */
function tombol(teks) {
  return [...wadah.querySelectorAll('button')].find((b) => b.textContent?.trim() === teks) ?? null
}

/** @param {number} [batas] */
async function tungguSimpanMapel(batas = 2000) {
  const mulai = Date.now()

  while (Date.now() - mulai < batas) {
    if (wadah.querySelector('#mapel-baru-nama') === null) return true
    await act(async () => {
      await sleep(25)
    })
  }

  return wadah.querySelector('#mapel-baru-nama') === null
}

beforeEach(() => {
  buatMapel.mockReset()
  useToastStore.setState({ toasts: [] })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('EditorSoal — mapel baru dari editor', () => {
  it('sekolah tanpa mapel: isian mapel baru sudah terbuka dan menjelaskan sebabnya', () => {
    pasang({ adaAwal: false })

    expect(wadah.querySelector('#mapel-baru-nama')).not.toBeNull()
    expect(wadah.textContent).toContain('Belum ada mapel di sekolah ini')
    expect(tombol('Simpan mapel')?.hasAttribute('disabled')).toBe(true)
  })

  it('menyimpan mapel baru: hanya nama yang dikirim, lalu mapelnya terpakai di soal ini', async () => {
    /** @type {number} */
    let laporan = 0
    pasang({ onDibuat: () => (laporan += 1) })

    buatMapel.mockResolvedValue({ id: 7, nama: 'Bahasa Indonesia', kode: null })

    // Sekolah yang sudah punya mapel membukanya lewat tombol "Mapel baru".
    expect(wadah.querySelector('#mapel-baru-nama')).toBeNull()
    act(() => tombol('Mapel baru')?.click())
    expect(wadah.querySelector('#mapel-baru-nama')).not.toBeNull()

    isi('#mapel-baru-nama', '  Bahasa Indonesia  ')
    act(() => tombol('Simpan mapel')?.click())

    expect(await tungguSimpanMapel()).toBe(true)

    // Spasi tepi dibuang, kode kosong tidak dikirim sebagai string kosong.
    expect(buatMapel).toHaveBeenCalledWith({ nama: 'Bahasa Indonesia', kode: undefined })
    // Panelnya menutup, pemanggil disegarkan, dan mapelnya langsung terpilih.
    const mapel = /** @type {HTMLSelectElement|null} */ (wadah.querySelector('#soal-mapel'))
    expect(mapel?.value).toBe('7')
    expect([...mapel?.options ?? []].map((o) => o.textContent)).toContain('Bahasa Indonesia')
    expect(laporan).toBe(1)
    expect(
      useToastStore.getState().toasts.map((/** @type {{ pesan: string }} */ satu) => satu.pesan),
    ).toContain('Mapel “Bahasa Indonesia” ditambahkan dan langsung dipakai soal ini.')
  })

  it('kode mapel ikut dikirim bila guru mengisinya', async () => {
    pasang({ adaAwal: false })
    buatMapel.mockResolvedValue({ id: 7, nama: 'IPA', kode: 'IPA' })

    isi('#mapel-baru-nama', 'IPA')
    isi('#mapel-baru-kode', 'IPA')
    act(() => tombol('Simpan mapel')?.click())

    expect(await tungguSimpanMapel()).toBe(true)
    expect(buatMapel).toHaveBeenCalledWith({ nama: 'IPA', kode: 'IPA' })
  })

  it('nama yang sudah dipakai: pesan server terbaca di panel dan isiannya tidak hilang', async () => {
    const pesan = 'Nama mapel ini sudah dipakai di sekolah ini.'
    pasang({ adaAwal: false })
    buatMapel.mockRejectedValue({
      response: { status: 422, data: { message: pesan, errors: { nama: [pesan] } } },
    })

    isi('#mapel-baru-nama', 'Matematika')
    act(() => tombol('Simpan mapel')?.click())

    await act(async () => {
      await sleep(60)
    })

    // Panel tetap terbuka, pesannya terbaca, dan yang diketik tidak dibuang.
    expect(wadah.textContent).toContain(pesan)
    const isian = /** @type {HTMLInputElement|null} */ (wadah.querySelector('#mapel-baru-nama'))
    expect(isian?.value).toBe('Matematika')
  })
})
