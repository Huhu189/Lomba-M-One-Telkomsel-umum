// @vitest-environment jsdom
/**
 * Panel setelan satu ulangan (dulu di /pengaturan, sekarang di halaman kuis).
 *
 * Yang dijaga: panelnya **terikat pada kuis yang sedang dibuka** tanpa pemilih
 * lingkup (tidak ada lagi cara salah memilih ulangan), lapis kuis yang dikirim
 * ke server memang `kuis` + id kuisnya, dan saklar yang dikunci sekolah tidak
 * bisa diubah dari sini (mengubahnya hanya menyimpan nilai yang diabaikan).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PanelSetelanUlangan from '../../../sections/quiz/setelan/PanelSetelanUlangan.jsx'

vi.mock('../../../sections/settings/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilPengaturan: vi.fn(), simpanPengaturan: vi.fn() }
})

const api = await import('../../../sections/settings/api.js')
const ambilPengaturan = /** @type {import('vitest').Mock} */ (api.ambilPengaturan)
const simpanPengaturan = /** @type {import('vitest').Mock} */ (api.simpanPengaturan)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @param {string} kunci @param {object} info */
function nilai(kunci, info) {
  return [kunci, { tipe: 'boolean', kelompok: 'Anti-cheat', bawaan: false, sumber: 'bawaan', terkunci: false, ...info }]
}

const RESOLUSI = {
  sekolah_id: 1,
  kelas_id: null,
  kuis_id: 191,
  pengaturan: Object.fromEntries([
    nilai('anti_cheat', { nilai: true, label: 'Aktifkan anti-cheat', tampil: true }),
    nilai('block_paste', { nilai: false, label: 'Blokir tempel (paste) jawaban', tampil: true }),
    // Dikunci sekolah: nilai sekolah yang menang, saklarnya tidak bisa diubah.
    nilai('ranking', {
      nilai: true,
      label: 'Tampilkan peringkat',
      kelompok: 'Hasil & tampilan',
      sumber: 'sekolah',
      terkunci: true,
      tampil: true,
    }),
    // Setelan yang sengaja **tidak lagi ditawarkan** ke guru: server tetap
    // memakainya dengan nilai bawaannya, tetapi panel tidak menampilkannya
    // (lihat KunciPengaturan::tampil()).
    nilai('detect_window_resize', {
      nilai: true,
      label: 'Blur singkat saat ukuran jendela berubah',
      tampil: false,
    }),
  ]),
}

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

function pasang(kuisId = 191) {
  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PanelSetelanUlangan kuisId={kuisId} />
      </QueryClientProvider>,
    )
  })
}

/** @param {string} pemilih @returns {HTMLElement|null} */
function cari(pemilih) {
  return /** @type {HTMLElement|null} */ (wadah.querySelector(pemilih))
}

/**
 * Menunggu sampai layar memuat teks tertentu.
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

beforeEach(() => {
  ambilPengaturan.mockReset()
  simpanPengaturan.mockReset()
  ambilPengaturan.mockResolvedValue(RESOLUSI)
  simpanPengaturan.mockResolvedValue(RESOLUSI)

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('PanelSetelanUlangan', () => {
  it('memuat setelan kuis yang sedang dibuka, tanpa pemilih lingkup', async () => {
    pasang(191)

    expect(await tungguTeks('Blokir tempel jawaban')).toBe(true)
    // Hanya kuis ini yang diminta — tidak ada daftar ulangan untuk dipilih.
    expect(ambilPengaturan.mock.calls[0]?.slice(0, 2)).toEqual([null, 191])
    expect(cari('select')).toBeNull()
  })

  it('menandai nilai yang dikunci sekolah dan mematikan saklarnya', async () => {
    pasang()
    await tungguTeks('Anti-cheat')

    // Angka "n/m aktif" bukan urusan panel ini: ringkasannya ada di tombol
    // "Setelan ulangan" (dijaga di setelanUlanganTombol.test.jsx). Yang dijaga di
    // sini: nilai yang dikunci sekolah dijelaskan dan saklarnya mati.
    expect(wadah.textContent).toContain('Dikunci sekolah')

    const peringkat = /** @type {HTMLInputElement} */ (cari('#set-ranking'))
    expect(peringkat.disabled).toBe(true)
    expect(peringkat.checked).toBe(true)
  })

  it('menyimpan perubahan pada lapis kuis kuis ini', async () => {
    pasang(191)
    await tungguTeks('Anti-cheat')

    // React membaca perubahan kotak centang dari event `click`, bukan `change`.
    const tempel = /** @type {HTMLInputElement} */ (cari('#set-block_paste'))
    act(() => tempel.click())

    await act(async () => {
      await sleep(50)
    })

    expect(simpanPengaturan.mock.calls[0]?.[0]).toEqual({
      lingkup: 'kuis',
      lingkup_id: 191,
      kunci: 'block_paste',
      nilai: true,
      terkunci: false,
      kuis_id: 191,
    })
  })

  it('hanya menampilkan setelan yang diminta server', async () => {
    pasang()
    await tungguTeks('Anti-cheat')

    // Setelan `tampil: false` tetap berlaku di server dengan nilai bawaannya,
    // tetapi tidak lagi ditawarkan — panelnya tidak tenggelam di puluhan saklar.
    expect(cari('#set-detect_window_resize')).toBeNull()
    expect(wadah.textContent).not.toContain('Blur singkat saat ukuran jendela berubah')

    // Kontrol positif: setelan yang memang ditawarkan tidak ikut hilang.
    expect(cari('#set-anti_cheat')).not.toBeNull()
  })
})
