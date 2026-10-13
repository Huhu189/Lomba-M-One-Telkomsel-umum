// @vitest-environment jsdom
/**
 * Shell navigasi: tombol hamburger hanya muncul saat ada menu, laci dibuka
 * tombol itu, dan setiap tautan bagian membawa ikon (bukan hanya teks).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import KerangkaUmum from '../../../shared/layout/KerangkaUmum.jsx'
import { pemuatHalaman } from '../../../halaman.js'
import { RUTE } from '../../../routes.js'
import { useAuthStore } from '../../../sections/auth/authStore.js'
import { klienQuery } from '../../../shared/store/klienQuery.js'

/** @type {{ IS_REACT_ACT_ENVIRONMENT?: boolean }} */ (globalThis).IS_REACT_ACT_ENVIRONMENT = true

/** @type {{ id: number, name: string, email: string, role: string, status: string, statusLabel: string, emailTerverifikasi: boolean }} */
const akun = {
  id: 1,
  name: 'Bu Guru',
  email: 'guru@sekolah.test',
  role: 'guru',
  status: 'aktif',
  statusLabel: 'Aktif',
  emailTerverifikasi: true,
}

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/** @param {typeof akun | null} user */
function pasang(user) {
  useAuthStore.setState({ user })
  act(() => {
    root.render(
      <QueryClientProvider client={klienQuery}>
        <MemoryRouter>
          <KerangkaUmum />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
}

/** @param {string} pemilih @returns {HTMLElement|null} */
function cari(pemilih) {
  return /** @type {HTMLElement|null} */ (wadah.querySelector(pemilih))
}

beforeEach(() => {
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  useAuthStore.setState({ user: null })
})

describe('KerangkaUmum — navigasi hamburger', () => {
  it('menampilkan tombol hamburger untuk guru, terhubung ke laci', () => {
    pasang(akun)

    const tombol = cari('button[aria-label="Buka menu"]')
    expect(tombol).not.toBeNull()
    expect(tombol?.getAttribute('aria-controls')).toBe('laci-navigasi')
    expect(tombol?.getAttribute('aria-expanded')).toBe('false')
  })

  it('menekan hamburger membuka laci berisi tautan bagian', () => {
    pasang(akun)
    expect(cari('#laci-navigasi')).toBeNull()

    act(() => cari('button[aria-label="Buka menu"]')?.click())

    const laci = cari('#laci-navigasi')
    expect(laci).not.toBeNull()
    expect(laci?.textContent).toContain('Bank Soal')
    // Menu akun: halaman /pengaturan kini berisi setelan akun sendiri, jadi
    // namanya "Akun" — bukan lagi "Pengaturan" (setelan ulangan pindah ke
    // halaman kuis masing-masing).
    expect(laci?.textContent).toContain('Akun')
    expect(laci?.querySelector('a[href="/pengaturan"]')).not.toBeNull()
    // Tombol berubah menjadi penutup.
    expect(cari('button[aria-label="Tutup menu"]')).not.toBeNull()
  })

  it('tautan bagian membawa ikon (svg) beserta labelnya', () => {
    pasang(akun)

    const taut = cari('nav.papan-nav a[href="/kelas"]')
    expect(taut).not.toBeNull()
    expect(taut?.querySelector('svg')).not.toBeNull()
    expect(taut?.textContent).toContain('Kelas')
  })

  it('murid memakai menunya sendiri, termasuk akun pribadinya', () => {
    pasang({ ...akun, role: 'murid', name: 'Murid A' })

    const nav = cari('nav.papan-nav')
    expect(nav?.textContent).toContain('Ulangan Saya')
    expect(nav?.textContent).not.toContain('Bank Soal')
    // Setelan akun milik semua pengguna, bukan hanya guru.
    expect(nav?.querySelector('a[href="/pengaturan"]')).not.toBeNull()
  })

  it('menu guru dikelompokkan, bukan sembilan pil datar (temuan 07)', () => {
    pasang(akun)

    const judulGrup = [...(cari('nav.papan-nav')?.querySelectorAll('.papan-grup-judul') ?? [])].map(
      (el) => el.textContent,
    )
    expect(judulGrup).toEqual(['Ringkasan', 'Ujian', 'Data induk', 'Belajar'])
    // Kelompok yang sama juga dipakai laci di layar sempit.
    act(() => cari('button[aria-label="Buka menu"]')?.click())
    expect(cari('#laci-navigasi')?.querySelectorAll('.papan-grup-judul').length).toBe(4)
  })

  it('Beranda ada di menu dan setiap menu punya ikonnya sendiri', () => {
    pasang(akun)
    const nav = cari('nav.papan-nav')
    expect(nav?.querySelector('a[href="/"]')).not.toBeNull()

    // Kuis dan Bank Soal tidak boleh lagi memakai gambar ikon yang sama.
    const d = (/** @type {string} */ href) =>
      [...(nav?.querySelector(`a[href="${href}"]`)?.querySelectorAll('path') ?? [])]
        .map((p) => p.getAttribute('d'))
        .join('|')
    expect(d('/kuis')).not.toBe(d('/bank-soal'))
    expect(d('/kuis')).not.toBe('')
  })

  it('tamu tidak punya menu bagian, jadi tanpa hamburger', () => {
    pasang(null)

    expect(cari('button[aria-label="Buka menu"]')).toBeNull()
    expect(cari('#laci-navigasi')).toBeNull()
  })

  it('setiap tautan menu punya modul halaman yang bisa dipramuat', () => {
    pasang(akun)

    const taut = [...(cari('nav.papan-nav')?.querySelectorAll('a[href]') ?? [])]
    expect(taut.length).toBeGreaterThan(5)

    for (const a of taut) {
      const jalur = a.getAttribute('href') || ''
      // Beranda sengaja ikut bundel awal, jadi tidak perlu pemuat sendiri.
      if (jalur === RUTE.beranda) continue
      expect(typeof pemuatHalaman(jalur), `pemuat untuk ${jalur}`).toBe('function')
    }
  })
})

describe('KerangkaUmum — rute malas', () => {
  /**
   * Pasang halaman `React.lazy` sebagai isi rute, dengan janjinya kita kendalikan
   * sendiri supaya urutannya pasti: penanda memuat dulu, isi halaman setelah
   * modulnya benar-benar siap (bukan bergantung timing impor sungguhan).
   */
  function pasangMalas() {
    /** @type {{ selesai: () => Promise<void> }} */
    const kendali = { selesai: async () => {} }
    /** @type {(nilai: { default: import('react').ComponentType }) => void} */
    let selesaikan = () => {}

    const Malas = lazy(
      () =>
        new Promise((/** @type {(nilai: { default: import('react').ComponentType }) => void} */ resolve) => {
          selesaikan = resolve
        }),
    )

    useAuthStore.setState({ user: akun })
    act(() => {
      root.render(
        <QueryClientProvider client={klienQuery}>
          <MemoryRouter initialEntries={['/uji']}>
            <Routes>
              <Route element={<KerangkaUmum />}>
                <Route path="/uji" element={<Malas />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      )
    })

    kendali.selesai = async () => {
      await act(async () => {
        selesaikan({ default: () => <p>Isi halaman uji</p> })
      })
    }
    return kendali
  }

  it('penanda memuat hanya menempati area konten, kerangka tetap utuh', async () => {
    const kendali = pasangMalas()

    const penanda = cari('.memuat-halaman')
    expect(penanda).not.toBeNull()
    expect(penanda?.getAttribute('role')).toBe('status')
    // Menu, kepala, dan kaki halaman tidak ikut hilang saat halaman diunduh.
    expect(cari('header.kepala-app')).not.toBeNull()
    expect(cari('nav.papan-nav')).not.toBeNull()
    expect(cari('footer.kaki-app')).not.toBeNull()
    expect(cari('#konten')?.textContent).not.toContain('Isi halaman uji')

    await kendali.selesai()

    expect(cari('.memuat-halaman')).toBeNull()
    expect(cari('#konten')?.textContent).toContain('Isi halaman uji')
  })
})
