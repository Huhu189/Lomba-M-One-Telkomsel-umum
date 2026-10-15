// @vitest-environment jsdom
/**
 * Pencarian murid di halaman Murid — dua lapis:
 *
 * 1. **Parameternya** (`paramMurid`): kata kosong TIDAK dikirim sebagai filter,
 *    spasi di ujung dipotong, dan saringan kelas tetap ikut saat mencari.
 * 2. **Perilakunya di halaman**: ketikan cepat digabung jadi SATU permintaan
 *    (bukan satu per huruf), permintaannya membawa kata kunci, hasil kosong
 *    memakai keadaan kosong khusus pencarian, dan tombol bersihkan
 *    mengembalikan daftar penuh.
 *
 * Yang dijaga di sini adalah kesalahan yang paling mudah terjadi: menyaring di
 * klien (hanya mencari 50 baris yang tampil) dan menembak server tiap huruf
 * (hasil ketikan lama bisa tiba sesudah yang baru, jadi tabel berhenti di hasil
 * yang salah).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HalamanMurid from '../../../sections/school/halaman/HalamanMurid.jsx'
import { paramMurid } from '../../../sections/school/api.js'

vi.mock('../../../sections/school/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return {
    ...asli,
    ambilMurid: vi.fn(),
    ambilKelas: vi.fn(),
    buatMurid: vi.fn(),
    ubahMurid: vi.fn(),
    hapusMurid: vi.fn(),
  }
})

const api = await import('../../../sections/school/api.js')
const ambilMurid = /** @type {import('vitest').Mock} */ (api.ambilMurid)
const ambilKelas = /** @type {import('vitest').Mock} */ (api.ambilKelas)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

const rina = {
  id: 1,
  school_id: 1,
  class_id: 3,
  nis: '7001',
  nisn: null,
  nama: 'Rina Aulia',
  email: 'rina@murid.test',
  kelas_nama: '6A',
}
const budi = {
  id: 2,
  school_id: 1,
  class_id: 3,
  nis: '7002',
  nisn: null,
  nama: 'Budi Santoso',
  email: 'budi@murid.test',
  kelas_nama: '6A',
}

/** @param {typeof rina[]} data */
function halaman(data) {
  return {
    data,
    meta: { total: data.length, current_page: 1, last_page: 1, per_page: 50 },
  }
}

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

function pasang() {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <HalamanMurid />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
}

/** @param {string} pemilih @returns {HTMLElement|null} */
function cari(pemilih) {
  return /** @type {HTMLElement|null} */ (wadah.querySelector(pemilih))
}

/**
 * Mengetik di kotak cari seperti pengguna (React membaca event `input`).
 * @param {string} kata
 */
function ketik(kata) {
  const input = /** @type {HTMLInputElement|null} */ (cari('#cari-murid'))
  if (!input) throw new Error('kotak cari tidak ada')
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, kata)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

/**
 * Menunggu sampai layar memuat teks tertentu (paling lama `batas` ms).
 * @param {string} teks
 * @param {number} [batas]
 */
async function tungguTeks(teks, batas = 3000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batas) {
    if ((wadah.textContent ?? '').includes(teks)) return true
    await act(async () => {
      await sleep(50)
    })
  }
  return (wadah.textContent ?? '').includes(teks)
}

beforeEach(() => {
  ambilMurid.mockReset()
  ambilKelas.mockReset()
  ambilKelas.mockResolvedValue([{ id: 3, school_id: 1, nama: '6A', tingkat: 6, tahun_ajaran: null }])
  ambilMurid.mockImplementation(async (_kelasId, _halaman, kata = '') =>
    kata === '' ? halaman([rina, budi]) : kata.startsWith('rina') ? halaman([rina]) : halaman([]),
  )

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('paramMurid', () => {
  it('mengirim halaman saja saat tanpa saringan', () => {
    expect(paramMurid(null, 2)).toEqual({ page: 2 })
  })

  it('menyertakan filter kelas dan kata kunci yang sudah dipotong', () => {
    expect(paramMurid(3, 1, '  rina ')).toEqual({
      page: 1,
      'filter[class_id]': 3,
      'filter[cari]': 'rina',
    })
  })

  it('tidak mengirim filter cari untuk kata kosong', () => {
    expect(paramMurid(null, 1, '   ')).toEqual({ page: 1 })
  })
})

describe('HalamanMurid — kotak pencarian', () => {
  it('memuat daftar penuh lebih dulu, tanpa kata kunci', async () => {
    pasang()

    expect(await tungguTeks('Rina Aulia')).toBe(true)
    expect(wadah.textContent).toContain('Budi Santoso')
    expect(ambilMurid).toHaveBeenCalledWith(null, 1, '')
  })

  it('menggabungkan ketikan cepat jadi satu permintaan berisi kata terakhir', async () => {
    pasang()
    await tungguTeks('Rina Aulia')
    const sebelum = ambilMurid.mock.calls.length

    // Tiga huruf dalam satu jeda: hanya satu permintaan yang boleh lahir.
    act(() => {
      ketik('r')
      ketik('ri')
      ketik('rina')
    })
    // Jeda debounce berjalan di luar act(), jadi pembaruan keadaan yang
    // dipicunya harus dibungkus act() juga — kalau tidak, React mengeluh dan
    // hasil uji bisa berbeda dari yang dilihat pengguna.
    await act(async () => {
      await sleep(500)
    })

    const sesudah = ambilMurid.mock.calls.slice(sebelum)
    expect(sesudah).toHaveLength(1)
    expect(sesudah[0]).toEqual([null, 1, 'rina'])
  })

  it('menyaring di SERVER: hasil yang tampil hanya yang cocok', async () => {
    pasang()
    await tungguTeks('Rina Aulia')

    ketik('rina')
    expect(await tungguTeks('Menampilkan 1 dari 1 murid untuk “rina”')).toBe(true)
    expect(wadah.textContent).not.toContain('Budi Santoso')
  })

  it('menyorot bagian nama yang cocok dengan kata kunci', async () => {
    pasang()
    await tungguTeks('Rina Aulia')

    ketik('rina')
    expect(await tungguTeks('Menampilkan 1 dari 1 murid untuk “rina”')).toBe(true)

    const disorot = [...wadah.querySelectorAll('mark')].map((tanda) => tanda.textContent)
    expect(disorot).toContain('Rina')
  })

  it('hasil kosong memakai keadaan kosong pencarian beserta jalan keluarnya', async () => {
    pasang()
    await tungguTeks('Rina Aulia')

    ketik('zzz')
    // Keadaan kosong pencarian HANYA muncul untuk kata kunci yang tidak ditemukan.
    expect(await tungguTeks('Tidak ada murid yang cocok dengan “zzz”')).toBe(true)

    const bersihkanKosong = [...wadah.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Bersihkan pencarian'),
    )
    expect(bersihkanKosong).toBeDefined()

    act(() => bersihkanKosong?.click())
    expect(await tungguTeks('Rina Aulia')).toBe(true)
    expect(wadah.textContent).toContain('Budi Santoso')
  })

  it('tombol bersihkan mengembalikan daftar penuh tanpa kata kunci', async () => {
    pasang()
    await tungguTeks('Rina Aulia')

    ketik('rina')
    expect(await tungguTeks('Menampilkan 1 dari 1 murid untuk “rina”')).toBe(true)

    const tombolBersih = cari('button[aria-label="Bersihkan pencarian"]')
    expect(tombolBersih).not.toBeNull()

    act(() => tombolBersih?.click())
    expect(await tungguTeks('Budi Santoso')).toBe(true)
    const kotak = /** @type {HTMLInputElement|null} */ (cari('#cari-murid'))
    expect(kotak?.value).toBe('')
    // Kotak bersih, jadi tombol bersihkan tidak lagi ditawarkan.
    expect(cari('button[aria-label="Bersihkan pencarian"]')).toBeNull()
    expect(ambilMurid).toHaveBeenLastCalledWith(null, 1, '')
  })
})
