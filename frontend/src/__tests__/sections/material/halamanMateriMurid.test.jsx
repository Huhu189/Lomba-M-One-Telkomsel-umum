// @vitest-environment jsdom
/**
 * Layar materi murid: klip tautan (YouTube/Drive) dan latihan sisipan —
 * 14 Oktober 2026.
 *
 * Dua keluhan pemilik produk yang dijaga di sini:
 *
 * 1. Bahan ajar berupa **tautan YouTube** hanya muncul sebagai keterangan
 *    ("Video YouTube · www.youtube.com") tanpa videonya. Klip tautan harus
 *    benar-benar dipasang sebagai bingkai — alamat bingkainya dihitung SERVER
 *    (`media.sematan`), bukan disusun klien.
 * 2. Kuis yang disisipkan ke blok **teks** tak pernah bisa dibuka murid, padahal
 *    bagian itu tidak bisa ditutup selama kuis wajibnya belum selesai. Latihan
 *    seperti itu sekarang ditawarkan di bawah bacaan (bukan menumpuk di atas
 *    media, karena tidak ada yang diputar).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import HalamanMateriMurid from '../../../sections/material/halaman/HalamanMateriMurid.jsx'

vi.mock('../../../sections/material/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return {
    ...asli,
    materiSaya: vi.fn(),
    progresMateri: vi.fn(),
    bukaBlok: vi.fn(),
    selesaikanBlok: vi.fn(),
  }
})

const api = await import('../../../sections/material/api.js')
const materiSaya = /** @type {import('vitest').Mock} */ (api.materiSaya)
const progresMateri = /** @type {import('vitest').Mock} */ (api.progresMateri)
const bukaBlok = /** @type {import('vitest').Mock} */ (api.bukaBlok)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root
/** @type {QueryClient} */
let queryClient

/**
 * Baris progres satu blok, dengan bawaan yang jarang diubah uji.
 * @param {Record<string, unknown>} ubah
 */
function baris(ubah) {
  return {
    block_id: 1,
    urutan: 1,
    tipe: 'media',
    tipe_label: 'Media',
    wajib: true,
    status: 'belum',
    status_label: 'Belum',
    host_id: null,
    boleh_dibuka: true,
    ...ubah,
  }
}

/** Ringkasan progres materi: satu klip tautan, satu blok teks, satu kuis sisipan. */
function ringkasan() {
  return {
    materi: { id: 7, judul: 'Bagian Tumbuhan', deskripsi: null, mapel_nama: 'IPA', tema_nama: null },
    blok: [
      baris({ block_id: 1, urutan: 1 }),
      baris({ block_id: 2, urutan: 2, tipe: 'teks', tipe_label: 'Teks' }),
      baris({
        block_id: 3,
        urutan: 3,
        tipe: 'kuis',
        tipe_label: 'Kuis latihan',
        host_id: 2,
        boleh_dibuka: false,
      }),
    ],
    perjalanan: { langkah: [] },
    jumlah_blok: 3,
    selesai_wajib: 0,
    jumlah_wajib: 3,
    persen: 0,
  }
}

/**
 * Isi blok yang dikembalikan server saat satu bagian dibuka.
 * @param {number} blockId
 */
function isi(blockId) {
  if (blockId === 1) {
    return {
      ...baris({ block_id: 1, urutan: 1 }),
      media: {
        kode: null,
        keterangan: '',
        nama: 'www.youtube.com',
        kategori: 'tautan',
        kategori_label: 'Video YouTube',
        sajian: 'semat',
        // Alamat bingkai resmi hasil hitungan server.
        sematan: 'https://www.youtube-nocookie.com/embed/abc123',
        mime: null,
        ukuran_manusia: null,
        sumber: 'tautan',
        jenis: 'youtube',
        url: 'https://www.youtube.com/watch?v=abc123',
        tersedia: true,
      },
    }
  }

  if (blockId === 2) {
    return {
      ...baris({ block_id: 2, urutan: 2, tipe: 'teks', tipe_label: 'Teks' }),
      teks: 'Akar menyerap air dari dalam tanah.',
    }
  }

  return baris({ block_id: 3, urutan: 3, tipe: 'kuis', tipe_label: 'Kuis latihan', host_id: 2 })
}

/** @param {string} label @param {number} [urutan] */
async function klik(label, urutan = 0) {
  const semua = [...wadah.querySelectorAll('button')].filter(
    (satu) => (satu.textContent ?? '').trim() === label,
  )
  await act(async () => {
    semua[urutan]?.click()
  })
}

/** Pilih materi pertama, lalu tunggu ringkasan progresnya tergambar. */
async function pilihMateri() {
  // Daftar materi datang dari server (query), jadi ditunggu dulu sebelum diklik.
  await tungguSampai(() => (wadah.textContent ?? '').includes('IPA · 3 bagian'))

  const tombol = [...wadah.querySelectorAll('button')].find(
    (satu) => (satu.textContent ?? '').includes('Bagian Tumbuhan'),
  )
  await act(async () => {
    tombol?.click()
  })
  await tungguSampai(() => (wadah.textContent ?? '').includes('bagian wajib selesai'))
}

/** @param {() => boolean} cek */
async function tungguSampai(cek) {
  for (let i = 0; i < 40; i += 1) {
    if (cek()) return
    await act(async () => {
      await new Promise((selesai) => setTimeout(selesai, 5))
    })
  }
}

beforeEach(() => {
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  materiSaya.mockResolvedValue([
    {
      id: 7,
      judul: 'Bagian Tumbuhan',
      deskripsi: null,
      mapel_nama: 'IPA',
      tema_nama: null,
      jumlah_blok: 3,
    },
  ])
  progresMateri.mockResolvedValue(ringkasan())
  bukaBlok.mockImplementation(async (_materiId, blockId) => ({ blok: isi(blockId), attempt: null }))

  act(() => {
    // Halaman ini membaca alamatnya (`/materi/<id>` — tautan yang dibagikan
    // guru), jadi membutuhkan konteks router. Alamat awalnya `/materi` tanpa id:
    // yang diuji di sini daftar materinya, lalu murid memilih sendiri.
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/materi']}>
          <HalamanMateriMurid />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('HalamanMateriMurid · klip tautan', () => {
  it('memasang bingkai YouTube yang dihitung server, bukan sekadar keterangan', async () => {
    await pilihMateri()
    await klik('Buka')
    await tungguSampai(() => wadah.querySelector('iframe') !== null)

    const bingkai = /** @type {HTMLIFrameElement|null} */ (wadah.querySelector('iframe'))
    // Alamat dasar tetap dari server; klien hanya menambah parameter autoplay.
    const alamat = new URL(bingkai?.getAttribute('src') ?? '')
    expect(`${alamat.origin}${alamat.pathname}`).toBe('https://www.youtube-nocookie.com/embed/abc123')
    // Video langsung jalan: murid tidak perlu menekan logo YouTube dulu.
    expect(alamat.searchParams.get('autoplay')).toBe('1')
    expect(alamat.searchParams.get('mute')).toBe('1')
    expect(bingkai?.getAttribute('loading')).toBe('eager')
    expect(wadah.textContent ?? '').toContain('Video YouTube')
  })
})

describe('HalamanMateriMurid · latihan sisipan', () => {
  it('menawarkan latihan sisipan blok teks di bawah bacaannya', async () => {
    await pilihMateri()
    // Bagian 2 = blok teks (tombol "Buka" kedua pada daftar bagian).
    await klik('Buka', 1)
    await tungguSampai(() => (wadah.textContent ?? '').includes('Akar menyerap air'))

    const teks = wadah.textContent ?? ''
    expect(teks).toContain('Latihan di bagian ini')
    expect(teks).toContain('Kerjakan: Kuis latihan')
    // Latihan sisipan blok teks tidak menumpuk di atas media (tidak ada yang diputar).
    expect(wadah.querySelector('iframe')).toBeNull()
  })

  it('membuka kuis sisipan blok teks lewat servernya', async () => {
    await pilihMateri()
    await klik('Buka', 1)
    await tungguSampai(() => (wadah.textContent ?? '').includes('Kerjakan: Kuis latihan'))

    bukaBlok.mockClear()
    await klik('Kerjakan: Kuis latihan')

    expect(bukaBlok).toHaveBeenCalledWith(7, 3)
  })
})
