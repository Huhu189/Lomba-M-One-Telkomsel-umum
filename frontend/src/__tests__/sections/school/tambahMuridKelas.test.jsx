// @vitest-environment jsdom
/**
 * Menambah murid langsung dari halaman Kelas (14 Oktober 2026).
 *
 * Sebelumnya halaman Kelas hanya memuat daftar kelas: untuk menambah murid guru
 * harus pindah ke halaman Murid, dan di sana memilih lagi kelas yang barusan ia
 * lihat — padahal kelas tujuan sudah pasti. Sekarang tiap baris kelas punya
 * tombol \"Tambah murid\", dan kelasnya dibawa formulir itu (bukan dipilih ulang).
 *
 * Yang dikunci di sini:
 * 1. tombolnya ada di baris kelas dan panelnya menyebut kelas tujuannya;
 * 2. yang dikirim ke server memuat `class_id` kelas itu — bukan kelas lain;
 * 3. galat 422 dari server tetap terbaca di kolomnya (mis. email sudah dipakai).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HalamanKelas from '../../../sections/school/halaman/HalamanKelas.jsx'
import { useToastStore } from '../../../shared/ui/toast.jsx'

vi.mock('../../../sections/school/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return {
    ...asli,
    ambilKelas: vi.fn(),
    buatKelas: vi.fn(),
    ubahKelas: vi.fn(),
    hapusKelas: vi.fn(),
    buatMurid: vi.fn(),
  }
})

const api = await import('../../../sections/school/api.js')
const ambilKelas = /** @type {import('vitest').Mock} */ (api.ambilKelas)
const buatMurid = /** @type {import('vitest').Mock} */ (api.buatMurid)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

const kelas6A = {
  id: 1,
  school_id: 1,
  nama: '6A',
  tingkat: 6,
  tahun_ajaran: null,
  jumlah_murid: 3,
}

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

function pasang() {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <HalamanKelas />
        </MemoryRouter>
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

/**
 * Menunggu sampai teks muncul di layar (paling lama `batas` ms).
 * @param {string} teks
 * @param {number} [batas]
 */
async function tungguTeks(teks, batas = 2000) {
  const mulai = Date.now()

  while (Date.now() - mulai < batas) {
    if ((wadah.textContent ?? '').includes(teks)) return true
    await act(async () => {
      await sleep(25)
    })
  }

  return (wadah.textContent ?? '').includes(teks)
}

/** Formulir murid di halaman kelas (dikenali dari isian nama muridnya). */
function formMurid() {
  const isian = /** @type {HTMLInputElement|null} */ (wadah.querySelector('#nama-murid-kelas'))
  const form = isian?.closest('form')

  if (!form) throw new Error('formulir murid di halaman kelas tidak ada')
  return form
}

/** Kirim formulir murid. */
async function kirimMurid() {
  await act(async () => {
    formMurid().dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    await sleep(20)
  })
}

beforeEach(() => {
  ambilKelas.mockReset()
  buatMurid.mockReset()
  ambilKelas.mockResolvedValue([kelas6A])
  useToastStore.setState({ toasts: [] })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('HalamanKelas — tambah murid langsung dari baris kelas', () => {
  it('tombolnya ada di baris kelas dan panelnya menyebut kelas tujuannya', async () => {
    pasang()
    expect(await tungguTeks('6A')).toBe(true)

    const tombol = wadah.querySelector('button[aria-label="Tambah murid ke kelas 6A"]')
    expect(tombol).not.toBeNull()

    act(() => tombol?.dispatchEvent(new window.MouseEvent('click', { bubbles: true })))

    expect(await tungguTeks('Tambah murid ke 6A')).toBe(true)
    // Kelasnya TIDAK dipilih ulang: pemilih kelas di halaman Murid tidak dipakai di sini.
    expect(wadah.querySelector('#kelas-murid')).toBeNull()
  })

  it('mengirim murid baru dengan class_id kelas yang ditekan', async () => {
    buatMurid.mockResolvedValue({
      id: 12,
      nama: 'Ani',
      email: 'ani@sekolah.test',
      class_id: kelas6A.id,
      kelas_nama: '6A',
    })

    pasang()
    expect(await tungguTeks('6A')).toBe(true)

    act(() =>
      wadah
        .querySelector('button[aria-label="Tambah murid ke kelas 6A"]')
        ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true })),
    )
    expect(await tungguTeks('Tambah murid ke 6A')).toBe(true)

    isi('#nama-murid-kelas', 'Ani')
    isi('#email-murid-kelas', 'ani@sekolah.test')
    isi('#nis-murid-kelas', '1001')
    await kirimMurid()

    expect(buatMurid).toHaveBeenCalledWith({
      nama: 'Ani',
      email: 'ani@sekolah.test',
      class_id: kelas6A.id,
      nis: '1001',
      nisn: undefined,
    })
    expect(
      useToastStore.getState().toasts.map((/** @type {{ pesan: string }} */ satu) => satu.pesan),
    ).toContain('Murid ditambahkan ke kelas ini.')
  })

  it('email yang sudah dipakai: pesan server muncul di kolom emailnya', async () => {
    const pesan = 'Email ini sudah dipakai akun lain. Pakai email lain, misalnya email orang tua atau wali.'
    buatMurid.mockRejectedValue({
      response: { status: 422, data: { message: pesan, errors: { email: [pesan] } } },
    })

    pasang()
    expect(await tungguTeks('6A')).toBe(true)

    act(() =>
      wadah
        .querySelector('button[aria-label="Tambah murid ke kelas 6A"]')
        ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true })),
    )
    expect(await tungguTeks('Tambah murid ke 6A')).toBe(true)

    isi('#nama-murid-kelas', 'Ani')
    isi('#email-murid-kelas', 'ani@sekolah.test')
    await kirimMurid()

    expect(formMurid().textContent).toContain(pesan)
  })

  it('nama terlalu pendek ditolak sebelum dikirim ke server', async () => {
    pasang()
    expect(await tungguTeks('6A')).toBe(true)

    act(() =>
      wadah
        .querySelector('button[aria-label="Tambah murid ke kelas 6A"]')
        ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true })),
    )
    expect(await tungguTeks('Tambah murid ke 6A')).toBe(true)

    isi('#nama-murid-kelas', 'A')
    isi('#email-murid-kelas', 'ani@sekolah.test')
    await kirimMurid()

    expect(buatMurid).not.toHaveBeenCalled()
    expect(formMurid().textContent).toContain('Nama minimal 2 karakter.')
  })
})
