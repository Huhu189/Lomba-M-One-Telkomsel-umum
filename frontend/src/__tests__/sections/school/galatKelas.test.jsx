// @vitest-environment jsdom
/**
 * Formulir kelas: sebab kegagalan simpan harus terbaca di kolomnya sendiri.
 *
 * Guru yang menekan "Simpan kelas" dengan nama yang sudah dipakai mendapat 422.
 * Sebelumnya satu-satunya umpan balik adalah toast berisi pesan mentah dari
 * Laravel — "The nama has already been taken." — sementara nama contoh di
 * formulir ("6A") justru termasuk nama yang memang sudah ada di data bawaan.
 * Akibatnya halaman kelas terasa rusak padahal hanya namanya yang perlu diganti.
 *
 * Dua hal yang dikunci di sini:
 * 1. `galatKolom` memetakan `errors` dari 422 ke kolomnya (dan tidak mengarang
 *    pesan bila respons tidak punya `errors`, mis. 500);
 * 2. halaman Kelas menampilkan pesan itu di bawah isian yang salah, lalu guru
 *    bisa memperbaiki nama dan benar-benar tersimpan pada percobaan berikutnya.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HalamanKelas from '../../../sections/school/HalamanKelas.jsx'
import { galatKolom } from '../../../sections/auth/api.js'
import { useToastStore } from '../../../shared/ui/toast.jsx'

vi.mock('../../../sections/school/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return {
    ...asli,
    ambilKelas: vi.fn(),
    buatKelas: vi.fn(),
    ubahKelas: vi.fn(),
    hapusKelas: vi.fn(),
  }
})

const api = await import('../../../sections/school/api.js')
const ambilKelas = /** @type {import('vitest').Mock} */ (api.ambilKelas)
const buatKelas = /** @type {import('vitest').Mock} */ (api.buatKelas)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** Pesan yang dikirim server saat nama kelas sudah dipakai. */
const PESAN_DUPLIKAT = 'Nama kelas ini sudah dipakai di sekolah ini. Pakai nama lain, misalnya 6C.'

/** Kelas yang sudah ada (bawaan seeder) — sekaligus pemicu tabrakan nama. */
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
 * Pilih satu opsi pada `<select>` (event `change`).
 * @param {string} pemilih
 * @param {string} nilai
 */
function pilih(pemilih, nilai) {
  const select = /** @type {HTMLSelectElement|null} */ (wadah.querySelector(pemilih))
  if (!select) throw new Error(`pilihan ${pemilih} tidak ada`)

  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
    setter?.call(select, nilai)
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

/** Kirim formulir kelas (tombol "Simpan kelas" ber-submit). */
async function kirim() {
  const form = wadah.querySelector('dialog form')
  if (!form) throw new Error('formulir kelas tidak ada')

  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    await sleep(20)
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

/**
 * Daftar pesan toast yang sedang tampil.
 * @returns {string[]}
 */
function pesanToast() {
  return useToastStore
    .getState()
    .toasts.map((/** @type {{ pesan: string }} */ satu) => satu.pesan)
}

/**
 * Menunggu sampai satu pesan toast tampil (paling lama `batas` ms).
 * Toast diuji lewat store-nya: host toast dirender di root aplikasi, bukan di
 * wadah uji ini.
 * @param {string} pesan
 * @param {number} [batas]
 */
async function tungguToast(pesan, batas = 2000) {
  const mulai = Date.now()

  while (Date.now() - mulai < batas) {
    if (pesanToast().includes(pesan)) return true
    await act(async () => {
      await sleep(25)
    })
  }

  return pesanToast().includes(pesan)
}

beforeEach(() => {
  ambilKelas.mockReset()
  buatKelas.mockReset()
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

describe('galatKolom', () => {
  it('mengambil pesan pertama tiap kolom dari respons 422', () => {
    expect(
      galatKolom({
        response: {
          status: 422,
          data: { message: 'Salah isian.', errors: { nama: [PESAN_DUPLIKAT], tingkat: 'Tingkat 1–6.' } },
        },
      }),
    ).toEqual({ nama: PESAN_DUPLIKAT, tingkat: 'Tingkat 1–6.' })
  })

  it('respons tanpa errors (jaringan/500) tidak menghasilkan pesan kolom', () => {
    expect(galatKolom({ response: { status: 500, data: { message: 'Server bermasalah.' } } })).toEqual({})
    expect(galatKolom(new Error('network'))).toEqual({})
    expect(galatKolom(undefined)).toEqual({})
  })

  it('melewati entri yang bukan teks atau kosong', () => {
    expect(galatKolom({ response: { data: { errors: { nama: [], tingkat: ['', '  '] } } } })).toEqual({})
  })
})

describe('HalamanKelas — sebab gagal simpan tampil di kolomnya', () => {
  it('nama yang sudah dipakai: pesan server muncul di bawah isian nama', async () => {
    pasang()
    expect(await tungguTeks('6A')).toBe(true)

    buatKelas.mockRejectedValue({
      response: { status: 422, data: { message: PESAN_DUPLIKAT, errors: { nama: [PESAN_DUPLIKAT] } } },
    })

    const buka = [...wadah.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tambah kelas'),
    )
    act(() => buka?.click())

    isi('#nama-kelas', '6A')
    pilih('#tingkat-kelas', '6')
    await kirim()

    // Pesannya terbaca pada kolomnya (di dalam panel formulir), bukan hanya di toast.
    const panel = wadah.querySelector('dialog')
    expect(panel?.textContent).toContain(PESAN_DUPLIKAT)
    expect(pesanToast()).toContain(PESAN_DUPLIKAT)

    // Isian yang dikirim memang yang diisi guru: nama + tingkat, tahun ajaran kosong.
    expect(buatKelas).toHaveBeenCalledWith({ nama: '6A', tingkat: 6, tahun_ajaran: undefined })
  })

  it('sesudah nama diganti, kelas benar-benar tersimpan dan pesan lama hilang', async () => {
    pasang()
    expect(await tungguTeks('6A')).toBe(true)

    buatKelas.mockRejectedValueOnce({
      response: { status: 422, data: { message: PESAN_DUPLIKAT, errors: { nama: [PESAN_DUPLIKAT] } } },
    })
    buatKelas.mockResolvedValue({
      id: 9,
      school_id: 1,
      nama: '6C',
      tingkat: 6,
      tahun_ajaran: null,
      jumlah_murid: 0,
    })

    const buka = [...wadah.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tambah kelas'),
    )
    act(() => buka?.click())

    isi('#nama-kelas', '6A')
    pilih('#tingkat-kelas', '6')
    await kirim()
    expect(await tungguTeks(PESAN_DUPLIKAT)).toBe(true)

    isi('#nama-kelas', '6C')
    await kirim()

    expect(buatKelas).toHaveBeenLastCalledWith({ nama: '6C', tingkat: 6, tahun_ajaran: undefined })
    expect(await tungguToast('Kelas ditambahkan.')).toBe(true)
    // Panel ditutup, jadi pesan dari percobaan pertama tidak tertinggal.
    expect(wadah.querySelector('dialog')?.textContent).not.toContain(PESAN_DUPLIKAT)
  })

  it('galat tanpa errors (mis. 500) hanya jadi toast, tanpa mengarang galat kolom', async () => {
    pasang()
    expect(await tungguTeks('6A')).toBe(true)

    buatKelas.mockRejectedValue({
      response: { status: 500, data: { message: 'Terjadi kesalahan di server.' } },
    })

    const buka = [...wadah.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tambah kelas'),
    )
    act(() => buka?.click())

    isi('#nama-kelas', '6C')
    pilih('#tingkat-kelas', '6')
    await kirim()

    expect(pesanToast()).toContain('Terjadi kesalahan di server.')
    expect(wadah.querySelector('dialog p.status-salah')).toBeNull()
  })
})
