// @vitest-environment jsdom
/**
 * Panel lampiran terlipat di soal biasa (14 Oktober 2026, temuan M1).
 *
 * `HalamanKerjakan` dulu merender `<UnggahLampiran>` untuk SEMUA soal, dan
 * komponennya selalu terbuka: soal pilihan ganda pun menampilkan "Lampiran
 * jawaban", tombol rekam diri, dan centang izin merekam. Anak jadi ragu ("aku
 * harus rekam?") dan perhatiannya pecah dari soal. Kini hanya soal tugas unggah
 * yang membuka panelnya sendiri.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import UnggahLampiran from '../../../sections/attempt/komponen/UnggahLampiran.jsx'

vi.mock('../../../sections/attempt/lampiran.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, daftarLampiran: vi.fn(), unggahLampiran: vi.fn(), hapusLampiran: vi.fn() }
})

const api = await import('../../../sections/attempt/lampiran.js')
const daftarLampiran = /** @type {import('vitest').Mock} */ (api.daftarLampiran)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/** @param {{bukaOtomatis?: boolean, lampiran?: unknown[]}} opsi */
function pasang({ bukaOtomatis = true, lampiran = [] } = {}) {
  daftarLampiran.mockResolvedValue(lampiran)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <UnggahLampiran attemptId={7} soalId={3} sisaDetik={600} bukaOtomatis={bukaOtomatis} />
      </QueryClientProvider>,
    )
  })
}

/** @param {string} teks */
function tombol(teks) {
  return [...wadah.querySelectorAll('button')].find((satu) => (satu.textContent ?? '').includes(teks))
}

/**
 * Tunggu daftar lampiran selesai dimuat.
 *
 * React Query menyiarkan hasil kueri lewat batching `setTimeout`, jadi satu
 * flush microtask belum cukup untuk melihat lampiran yang sudah ada.
 */
async function tenang() {
  await act(async () => {
    await new Promise((lanjut) => window.setTimeout(lanjut, 0))
  })
}

/**
 * Tunggu sampai `teks` muncul di halaman.
 *
 * Satu tik `tenang()` TIDAK cukup dan tidak bisa diandalkan: React Query
 * menyiarkan hasil kueri di batching-nya sendiri, jadi kadang lampiran baru
 * terpasang beberapa tik kemudian. Dulu tes ini menunggu satu tik lalu langsung
 * memeriksa, sehingga di bawah beban (seluruh suite berjalan paralel) ia
 * sesekali gagal — kegagalan yang menyesatkan, karena aplikasinya baik-baik saja.
 * @param {string} teks
 */
async function tungguTeks(teks) {
  for (let tik = 0; tik < 50; tik += 1) {
    if ((wadah.textContent ?? '').includes(teks)) return

    await tenang()
  }

  throw new Error(`Teks "${teks}" tidak muncul di panel lampiran`)
}

beforeEach(() => {
  daftarLampiran.mockReset()
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('UnggahLampiran — terlipat di soal biasa', () => {
  it('soal biasa hanya menampilkan tombol "Tambah lampiran"', async () => {
    pasang({ bukaOtomatis: false })
    await tenang()

    expect(wadah.querySelector('[data-lampiran="terlipat"]')).not.toBeNull()
    expect(wadah.textContent).toContain('Tambah lampiran')
    // Tanpa panel terbuka tidak ada ajakan merekam diri di halaman soal itu.
    expect(wadah.textContent).not.toContain('Rekam diri')
    expect(wadah.querySelector('input[type="checkbox"]')).toBeNull()
  })

  it('panel penuh muncul setelah murid menekan "Tambah lampiran"', async () => {
    pasang({ bukaOtomatis: false })
    await tenang()

    await act(async () => {
      tombol('Tambah lampiran')?.click()
    })

    expect(wadah.textContent).toContain('Lampiran jawaban')
    expect(wadah.textContent).toContain('Rekam diri')
  })

  it('soal tugas unggah tetap terbuka sendiri', async () => {
    pasang({ bukaOtomatis: true })
    await tenang()

    expect(wadah.textContent).toContain('Lampiran jawaban')
    expect(tombol('Tambah lampiran')).toBeUndefined()
  })

  it('lampiran yang sudah ada membuat panel tetap terbuka walau soal biasa', async () => {
    pasang({
      bukaOtomatis: false,
      lampiran: [
        {
          kode: 'lmp-1',
          question_id: 3,
          jenis: 'gambar',
          status: 'selesai',
          nama_asli: 'jawaban.png',
          ukuran_manusia: '120 KiB',
          url: '/api/v1/berkas/lmp-1?signature=abc',
        },
      ],
    })

    await tungguTeks('jawaban.png')

    expect(wadah.textContent).toContain('jawaban.png')
  })
})
