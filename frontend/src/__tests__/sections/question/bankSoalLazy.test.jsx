// @vitest-environment jsdom
/**
 * Bank soal dimuat **bertahap** — dua hal yang diuji di sini:
 *
 * 1. **Parameternya** (`paramSoal`): `per_page` selalu ikut, halaman diteruskan,
 *    filter mapel/tag/tipe dikirim apa adanya, dan kata kunci kosong TIDAK
 *    dikirim sebagai `q`.
 * 2. **Perilakunya di halaman**: permintaan pertama hanya 20 soal, sisa bank
 *    baru diambil saat tombol "Muat … berikutnya" ditekan (dan barisnya
 *    ditambahkan, bukan menggantikan), sedangkan pencarian membawa kata kunci
 *    ke server dan mengembalikan daftar ke halaman 1.
 *
 * Yang dijaga: halaman ini dulu memuat SELURUH bank soal dalam satu respons,
 * jadi sekolah dengan ratusan soal mengirim semuanya hanya untuk menampilkan
 * dua puluh baris pertama.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HalamanBankSoal from '../../../sections/question/halaman/HalamanBankSoal.jsx'
import { paramSoal } from '../../../sections/question/api.js'

vi.mock('../../../sections/question/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return {
    ...asli,
    ambilSoal: vi.fn(),
    ambilTag: vi.fn(),
    buatSoal: vi.fn(),
    ubahSoal: vi.fn(),
    hapusSoal: vi.fn(),
  }
})

vi.mock('../../../sections/school/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilMapel: vi.fn() }
})

const apiSoal = await import('../../../sections/question/api.js')
const apiSekolah = await import('../../../sections/school/api.js')
const ambilSoal = /** @type {import('vitest').Mock} */ (apiSoal.ambilSoal)
const ambilTag = /** @type {import('vitest').Mock} */ (apiSoal.ambilTag)
const ambilMapel = /** @type {import('vitest').Mock} */ (apiSekolah.ambilMapel)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @param {number} id */
function soal(id) {
  return {
    id,
    subject_id: 1,
    tag_id: null,
    tipe: 'pilihan_ganda',
    tipe_label: 'Pilihan ganda',
    objektif: true,
    konten: { teks: `Soal latihan nomor ${id}` },
    kunci: { jawaban: 'A' },
    pembahasan: null,
    skor: 1,
    aktif: true,
    mapel_nama: 'Matematika',
    tag_nama: null,
  }
}

/** 25 soal di bank: halaman 1 memuat 20, halaman 2 sisanya. */
const SELURUH = Array.from({ length: 25 }, (_, i) => soal(i + 1))

/**
 * Satu halaman balasan server (20 baris per halaman).
 * @param {number} halaman
 * @param {string} kata
 */
function balasan(halaman, kata = '') {
  const cocok = kata === '' ? SELURUH : SELURUH.filter((satu) => satu.konten.teks.includes(kata))

  const perHalaman = 20
  const mulai = (halaman - 1) * perHalaman
  const lastPage = Math.max(1, Math.ceil(cocok.length / perHalaman))

  return {
    data: cocok.slice(mulai, mulai + perHalaman),
    meta: { total: cocok.length, current_page: halaman, last_page: lastPage, per_page: perHalaman },
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
          <HalamanBankSoal />
        </MemoryRouter>
      </QueryClientProvider>,
    )
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

/** @param {string} teks @returns {HTMLButtonElement|null} */
function tombol(teks) {
  const semua = /** @type {HTMLButtonElement[]} */ ([...wadah.querySelectorAll('button')])
  return semua.find((satu) => satu.textContent?.includes(teks)) ?? null
}

/**
 * Mengetik di kotak cari seperti pengguna (React membaca event `input`).
 * @param {string} kata
 */
function ketik(kata) {
  const input = /** @type {HTMLInputElement|null} */ (wadah.querySelector('#cari-soal'))
  if (!input) throw new Error('kotak cari tidak ada')
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, kata)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  ambilSoal.mockReset()
  ambilTag.mockReset()
  ambilMapel.mockReset()

  ambilTag.mockResolvedValue([])
  ambilMapel.mockResolvedValue([{ id: 1, nama: 'Matematika' }])
  ambilSoal.mockImplementation(async (filter = {}) => balasan(filter.halaman ?? 1, filter.cari ?? ''))

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('paramSoal', () => {
  it('selalu menyertakan halaman dan jumlah per halaman', () => {
    expect(paramSoal({ halaman: 2, perHalaman: 20 })).toEqual({ page: 2, per_page: 20 })
  })

  it('mengirim filter yang dipilih dan kata kunci yang sudah dipotong', () => {
    expect(paramSoal({ subjectId: 3, tagId: 4, tipe: 'menjodohkan', cari: '  pecahan ' })).toEqual({
      page: 1,
      'filter[subject_id]': 3,
      'filter[tag_id]': 4,
      'filter[tipe]': 'menjodohkan',
      q: 'pecahan',
    })
  })

  it('tidak mengirim kata kunci kosong', () => {
    expect(paramSoal({ cari: '   ' })).toEqual({ page: 1 })
  })
})

describe('HalamanBankSoal — muat bertahap', () => {
  it('permintaan pertama hanya 20 soal, bukan seluruh bank', async () => {
    pasang()

    expect(await tungguTeks('Soal latihan nomor 1')).toBe(true)
    expect(ambilSoal).toHaveBeenCalledTimes(1)
    expect(ambilSoal).toHaveBeenCalledWith({
      subjectId: null,
      tagId: null,
      tipe: null,
      cari: '',
      halaman: 1,
      perHalaman: 20,
    })

    // Soal ke-21 belum diminta sama sekali.
    expect(wadah.textContent).not.toContain('Soal latihan nomor 21')
    expect(wadah.textContent).toContain('Menampilkan 20 dari 25 soal (dimuat bertahap)')
  })

  it('tombol "muat berikutnya" menambah baris, bukan menggantinya', async () => {
    pasang()
    await tungguTeks('Soal latihan nomor 1')

    const muat = tombol('Muat 20 soal berikutnya')
    expect(muat).not.toBeNull()

    act(() => muat?.click())
    expect(await tungguTeks('Soal latihan nomor 25')).toBe(true)

    expect(ambilSoal).toHaveBeenLastCalledWith({
      subjectId: null,
      tagId: null,
      tipe: null,
      cari: '',
      halaman: 2,
      perHalaman: 20,
    })
    // Baris halaman pertama tetap ada, dan tombol muatnya hilang karena habis.
    expect(wadah.textContent).toContain('Soal latihan nomor 1')
    expect(wadah.textContent).toContain('Menampilkan 25 dari 25 soal (dimuat bertahap)')
    expect(tombol('Muat 20 soal berikutnya')).toBeNull()
  })

  it('mencari di server lalu kembali ke halaman 1', async () => {
    pasang()
    await tungguTeks('Soal latihan nomor 1')

    const sebelum = ambilSoal.mock.calls.length
    ketik('nomor 21')
    // Ketikan digabung dulu (debounce), jadi pembaruan keadaannya dibungkus act().
    await act(async () => {
      await sleep(500)
    })
    expect(await tungguTeks('Tidak ada soal yang cocok', 200)).toBe(false)

    const sesudah = ambilSoal.mock.calls.slice(sebelum)
    expect(sesudah).toHaveLength(1)
    expect(sesudah[0][0]).toMatchObject({ cari: 'nomor 21', halaman: 1, perHalaman: 20 })
    expect(await tungguTeks('Menampilkan 1 dari 1 soal (dimuat bertahap)')).toBe(true)
  })

  it('kata kunci tanpa hasil memakai keadaan kosong pencarian beserta jalan keluarnya', async () => {
    pasang()
    await tungguTeks('Soal latihan nomor 1')

    ketik('zzz')
    expect(await tungguTeks('Tidak ada soal yang cocok dengan “zzz”')).toBe(true)

    const bersihkan = tombol('Bersihkan pencarian')
    expect(bersihkan).not.toBeNull()

    act(() => bersihkan?.click())
    expect(await tungguTeks('Soal latihan nomor 1')).toBe(true)
  })
})
