// @vitest-environment jsdom
/**
 * Mode layar "Papan peringkat" di perangkat murid (14 Oktober 2026).
 *
 * Yang dijaga di sini adalah janji yang membuat mode ini aman dipakai di depan
 * kelas: **papan di HP murid tidak boleh berbeda dari papan di halaman
 * peringkatnya sendiri**. Karena itu pengujiannya membandingkan dua hal yang
 * dirender dari payload yang sama:
 *
 * 1. isi tabel papan di panel layar kelas = isi tabel papan di halaman peringkat
 *    murid (dibandingkan langsung, bukan ditebak dari potongan teks);
 * 2. panel meminta `top` yang sama dengan halaman murid (20), dan tidak satu pun
 *    jejak guru ikut: kolom "Catatan guru", kata "dibantu", maupun nomor
 *    peringkat di luar N% teratas.
 *
 * Modul API di-mock supaya berkas ini menguji panelnya, bukan jaringannya.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PanelLayarMurid from '../../../sections/presence/komponen/PanelLayarMurid.jsx'
import HalamanPeringkat from '../../../sections/report/halaman/HalamanPeringkat.jsx'
import { useAuthStore } from '../../../sections/auth/authStore.js'

vi.mock('../../../sections/report/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilPeringkat: vi.fn() }
})

vi.mock('../../../sections/presence/layar.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilLayar: vi.fn(), terbitkanTiketLayar: vi.fn() }
})

const apiPeringkat = await import('../../../sections/report/api.js')
const ambilPeringkat = /** @type {import('vitest').Mock} */ (apiPeringkat.ambilPeringkat)
const apiLayar = await import('../../../sections/presence/layar.js')
const ambilLayar = /** @type {import('vitest').Mock} */ (apiLayar.ambilLayar)
const terbitkanTiketLayar = /** @type {import('vitest').Mock} */ (apiLayar.terbitkanTiketLayar)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** Satu baris papan sesuai kontrak server untuk murid (tanpa jejak bonus). */
function baris(/** @type {Record<string, unknown>} */ ubah) {
  return {
    peringkat: 1,
    attempt_id: 1,
    murid_id: 1,
    tim_id: null,
    tim_nama: null,
    anggota: [],
    nama: 'Ani',
    skor: 10,
    skor_maksimal: 10,
    persen: 100,
    jumlah_benar: 10,
    jumlah_soal: 10,
    dikumpulkan_at: '2026-10-14T03:00:00.000Z',
    ...ubah,
  }
}

/**
 * Payload papan untuk murid yang nomornya belum dibuka (di luar N% teratas):
 * dua baris teratas terlihat, dirinya sendiri hanya lewat `detail_saya`.
 */
function papanMurid(/** @type {Record<string, unknown>} */ ubah = {}) {
  return {
    kuis_id: 7,
    judul_kuis: 'Ulangan Operasi Hitung',
    mode_tim: false,
    tampil: true,
    guru: false,
    total: 5,
    top: 20,
    terbuka_persen: 30,
    terbuka_jumlah: 2,
    bonus_aktif: false,
    bonus_bawah_persen: 50,
    bonus_maks_persen: 15,
    peringkat: [
      baris({ peringkat: 1, attempt_id: 1, murid_id: 1, nama: 'Ani' }),
      baris({ peringkat: 2, attempt_id: 2, murid_id: 2, nama: 'Budi', skor: 8, persen: 80, jumlah_benar: 8 }),
    ],
    peringkat_saya: null,
    detail_saya: {
      nama: 'Dedi',
      skor: 7,
      skor_maksimal: 10,
      persen: 70,
      peringkat: null,
      di_luar_terbuka: true,
    },
    ...ubah,
  }
}

/** Keadaan layar seperti diterima perangkat murid saat guru menyiarkan papan. */
function layarPeringkat(/** @type {number} */ versi) {
  return {
    kuis_id: 7,
    aktif: true,
    mode: 'peringkat',
    mode_label: 'Papan peringkat',
    judul: null,
    isi: null,
    soal: null,
    versi,
    diperbarui_at: '2026-10-14T03:05:00.000Z',
  }
}

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

/** @type {Array<{ root: import('react-dom/client').Root, wadah: HTMLElement }>} */
let terpasang = []

/**
 * Pasang satu komponen di wadahnya sendiri. Halaman peringkat butuh rute yang
 * punya `:slug`; panel layar kelas tidak butuh rute sama sekali.
 *
 * @param {import('react').ReactElement} element
 * @param {string} jalur
 * @returns {HTMLElement}
 */
function pasang(element, jalur) {
  const wadah = document.createElement('div')
  document.body.appendChild(wadah)
  const root = createRoot(wadah)

  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[jalur]}>
          <Routes>
            <Route path="/kuis/:slug/peringkat" element={element} />
            <Route path="*" element={element} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })

  terpasang.push({ root, wadah })

  return wadah
}

/**
 * Menunggu sampai layar memuat teks tertentu.
 * @param {HTMLElement} wadah
 * @param {string} teks
 * @param {number} [batas]
 */
async function tungguTeks(wadah, teks, batas = 2000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batas) {
    if ((wadah.textContent ?? '').includes(teks)) return true
    await act(async () => {
      await sleep(25)
    })
  }
  return (wadah.textContent ?? '').includes(teks)
}

/** Teks tabel papan di satu wadah (null bila papannya belum tergambar). */
function teksPapan(/** @type {HTMLElement} */ wadah) {
  return wadah.querySelector('table')?.textContent?.replace(/\s+/g, ' ').trim() ?? null
}

beforeEach(() => {
  ambilPeringkat.mockReset()
  ambilLayar.mockReset()
  terbitkanTiketLayar.mockReset()
  // SSE tidak perlu hidup di uji ini: hook-nya jatuh ke polling, dan yang diuji
  // adalah papannya, bukan jalur siarannya.
  terbitkanTiketLayar.mockRejectedValue(new Error('tanpa SSE di uji ini'))
  useAuthStore.setState({ user: { id: 9, name: 'Dedi', role: 'murid' } })
})

afterEach(() => {
  for (const { root, wadah } of terpasang) {
    act(() => root.unmount())
    wadah.remove()
  }
  terpasang = []
})

describe('mode layar papan peringkat', () => {
  it('murid melihat papan yang sama persis dengan halaman peringkatnya sendiri', async () => {
    ambilPeringkat.mockResolvedValue(papanMurid())
    ambilLayar.mockResolvedValue(layarPeringkat(2))

    const halaman = pasang(<HalamanPeringkat />, '/kuis/abcd/peringkat')
    expect(await tungguTeks(halaman, 'Ani')).toBe(true)

    const panel = pasang(<PanelLayarMurid kuisId={7} />, '/')
    expect(await tungguTeks(panel, 'Dari guru')).toBe(true)
    expect(await tungguTeks(panel, 'Ani')).toBe(true)

    // Janji intinya: baris dan angka di HP murid identik dengan halamannya.
    const papanHalaman = teksPapan(halaman)
    const papanPanel = teksPapan(panel)
    expect(papanHalaman).not.toBeNull()
    expect(papanPanel).toBe(papanHalaman)

    // Aturan yang sama juga dijelaskan dengan kalimat yang sama.
    expect(panel.textContent).toContain('dibuka untuk 2 murid teratas')
    expect(panel.textContent).toContain('Nomor peringkatmu belum dibuka')
    expect(panel.textContent).toContain('7 / 10 (70%)')

    // Panel meminta papan yang sama panjang dengan halaman murid (20 baris),
    // dan dengan identitas kuis yang dipakai layar kelas (id, bukan slug).
    const topDiminta = ambilPeringkat.mock.calls.map((satu) => satu[1])
    expect(topDiminta.every((satu) => satu === 20)).toBe(true)
    expect(ambilPeringkat.mock.calls.some((satu) => satu[0] === 7)).toBe(true)
  })

  it('papan yang disiarkan tidak membawa jejak guru maupun nomor di luar N% teratas', async () => {
    ambilPeringkat.mockResolvedValue(papanMurid())
    ambilLayar.mockResolvedValue(layarPeringkat(3))

    const panel = pasang(<PanelLayarMurid kuisId={7} />, '/')
    expect(await tungguTeks(panel, 'Ani')).toBe(true)

    const kolom = [...panel.querySelectorAll('th')].map((th) => th.textContent)

    expect(kolom).toEqual(['#', 'Nama', 'Skor', 'Benar'])
    expect(panel.textContent).not.toContain('Catatan guru')
    expect(panel.textContent).not.toContain('dibantu')
    expect(panel.textContent).not.toContain('peringkat asli')
    // Nomor peringkat Dedi tidak muncul di mana pun — hanya skornya sendiri.
    expect(panel.textContent).not.toContain('Dedi')
    // Panel memberi tahu bahwa ia hanya melihat, bukan memblokir ulangan.
    expect(panel.textContent).toContain('jawabanmu di halaman ini tidak berubah')
  })

  it('layar kosong berarti tidak ada papan di perangkat murid — dan tanpa permintaan sia-sia', async () => {
    ambilLayar.mockResolvedValue({ ...layarPeringkat(4), mode: 'kosong', mode_label: 'Kosong (ulangan biasa)' })

    const panel = pasang(<PanelLayarMurid kuisId={7} />, '/')
    await act(async () => {
      await sleep(120)
    })

    expect(panel.textContent).toBe('')
    expect(ambilPeringkat).not.toHaveBeenCalled()
  })

  it('ranking yang dimatikan guru diucapkan apa adanya, bukan papan kosong', async () => {
    ambilPeringkat.mockResolvedValue(papanMurid({ tampil: false, peringkat: [], total: 0 }))
    ambilLayar.mockResolvedValue(layarPeringkat(5))

    const panel = pasang(<PanelLayarMurid kuisId={7} />, '/')
    expect(await tungguTeks(panel, 'Ranking sedang dimatikan guru')).toBe(true)

    expect(panel.textContent).toContain('Gurumu mematikan tampilan peringkat untuk kelas ini.')
    expect(panel.textContent).not.toContain('dibantu')
  })
})
