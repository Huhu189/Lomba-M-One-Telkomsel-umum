// @vitest-environment jsdom
/**
 * "Setelan ulangan" sebagai SATU tombol (14 Oktober 2026).
 *
 * Yang dijaga di sini: sebelum panelnya dibuka, halaman tidak memuat satu pun
 * saklar setelan — yang tampak hanya tombolnya berikut ringkasan angka aktif.
 * Setelah ditekan, isinya terbuka di `<dialog>` yang sama pola dengan panel
 * form lain (fokus terkunci, Esc menutup), dan ringkasan di tombol dihitung
 * dari resolusi server yang sama dengan bagian "Tinjau" di editor kuis.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SetelanUlangan from '../../../sections/quiz/setelan/SetelanUlangan.jsx'

vi.mock('../../../sections/settings/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilPengaturan: vi.fn(), simpanPengaturan: vi.fn() }
})

const api = await import('../../../sections/settings/api.js')
const ambilPengaturan = /** @type {import('vitest').Mock} */ (api.ambilPengaturan)

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
    nilai('anti_cheat', { nilai: true, label: 'Aktifkan anti-cheat' }),
    nilai('block_paste', { nilai: true, label: 'Blokir tempel (paste) jawaban' }),
    nilai('block_print', { nilai: false, label: 'Sembunyikan saat dicetak' }),
    nilai('izinkan_tamu', { nilai: true, label: 'Izinkan siswa tamu', kelompok: 'Akses' }),
    nilai('retry', { nilai: false, label: 'Ulangan ulang (retry)', kelompok: 'Nilai' }),
  ]),
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
        <SetelanUlangan kuisId={191} />
      </QueryClientProvider>,
    )
  })
}

/** @param {string} pemilih @returns {HTMLElement|null} */
function cari(pemilih) {
  return /** @type {HTMLElement|null} */ (wadah.querySelector(pemilih))
}

/** @param {string} teks @returns {HTMLButtonElement|null} */
function tombol(teks) {
  const semua = /** @type {HTMLButtonElement[]} */ ([...wadah.querySelectorAll('button')])
  return semua.find((satu) => satu.textContent?.includes(teks)) ?? null
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
  ambilPengaturan.mockResolvedValue(RESOLUSI)

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('SetelanUlangan (satu tombol)', () => {
  it('sebelum dibuka hanya tombolnya yang tampil, tanpa satu pun saklar', async () => {
    pasang()
    await tungguTeks('Setelan ulangan')

    expect(cari('input[role="switch"]')).toBeNull()
    expect(cari('dialog')).not.toBeNull()
    // Panel tertutup: dialog tidak `open` dan isinya belum dirender.
    expect(/** @type {HTMLDialogElement} */ (cari('dialog')).open).toBe(false)
  })

  it('tombolnya meringkas berapa saklar yang menyala', async () => {
    pasang()

    // Data uji: yang menyala hanya proteksi rinci "blokir tempel" dan izin tamu
    // = 2. Penyebutnya 7: saklar induk anti-cheat + izin tamu + 5 aturan sesi
    // (retry, ranking, mode tim, layar, rekam). Setelan yang tidak ditawarkan
    // (`tampil: false`) tidak ikut dihitung — jumlahnya bukan 12 lagi.
    expect(await tungguTeks('2/7 aktif')).toBe(true)
  })

  it('menekannya membuka panel berisi setelan, dan tombol tutup tersedia', async () => {
    pasang()
    await tungguTeks('2/7 aktif')

    act(() => tombol('Setelan ulangan')?.click())
    await tungguTeks('Blokir tempel jawaban')

    expect(cari('input#set-block_paste')).not.toBeNull()
    expect(cari('input#set-izinkan_tamu')).not.toBeNull()

    // Tombol tutup disediakan di kepala panel (fokus & Esc ditangani PanelForm).
    expect(tombol('Tutup setelan ulangan')).not.toBeNull()
  })

  it('jadi hanya-baca bila server bilang pengguna ini tidak boleh mengubahnya', async () => {
    // Kepala sekolah boleh MEMBACA resolusi ini, jadi panelnya tampil lengkap —
    // tetapi setiap simpan akan ditolak 403. Tanpa `boleh_ubah`, saklarnya
    // tampak bisa ditekan dan guru bertanya "apakah setelannya masuk?".
    ambilPengaturan.mockResolvedValue({ ...RESOLUSI, boleh_ubah: false })

    pasang()
    await tungguTeks('2/7 aktif')

    act(() => tombol('Setelan ulangan')?.click())
    await tungguTeks('Siswa tamu')

    const saklarTamu = /** @type {HTMLInputElement|null} */ (cari('input#set-izinkan_tamu'))
    const saklarAntiCheat = /** @type {HTMLInputElement|null} */ (cari('input#set-block_paste'))

    expect(saklarTamu).not.toBeNull()
    expect(saklarTamu?.disabled).toBe(true)
    expect(saklarAntiCheat?.disabled).toBe(true)
    // Nilainya tetap apa adanya dari server: hanya-baca, bukan dikosongkan.
    expect(saklarTamu?.checked).toBe(true)

    // Sebabnya ditulis, bukan hanya saklar mati tanpa keterangan.
    const teks = wadah.textContent ?? ''
    expect(teks).toContain('Hanya bisa dibaca')
    expect(teks).toContain('hanya bisa diubah guru pemilik kuis ini')

    // Saklar lain pun tidak terkecuali: seluruh panel memang hanya-baca.
    expect(/** @type {HTMLInputElement|null} */ (cari('input#set-anti_cheat'))?.disabled).toBe(true)

    // Kontrol positif: dengan `boleh_ubah` true, saklarnya hidup lagi.
    ambilPengaturan.mockResolvedValue(RESOLUSI)
    act(() => root.unmount())
    root = createRoot(wadah)
    pasang()
    await tungguTeks('2/7 aktif')
    act(() => tombol('Setelan ulangan')?.click())
    await tungguTeks('Siswa tamu')

    expect(/** @type {HTMLInputElement|null} */ (cari('input#set-izinkan_tamu'))?.disabled).toBe(false)
    expect(wadah.textContent).not.toContain('Hanya bisa dibaca')
  })

  it('menjelaskan kapan pintu tamu benar-benar terbuka', async () => {
    pasang()
    await tungguTeks('2/7 aktif')

    act(() => tombol('Setelan ulangan')?.click())
    await tungguTeks('Siswa tamu')

    // Guru yang mengeluh "sudah dinyalakan tapi murid tetap dipaksa masuk"
    // harus menemukan sebabnya di panel ini, bukan lewat bertanya.
    const teks = wadah.textContent ?? ''
    expect(teks).toContain('cukup menulis nama')
    expect(teks).toContain('Pintu tamu baru terbuka setelah kuis diterbitkan')
  })
})
