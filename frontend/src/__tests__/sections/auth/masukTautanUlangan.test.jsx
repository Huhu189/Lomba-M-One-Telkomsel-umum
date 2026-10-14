// @vitest-environment jsdom
/**
 * Halaman masuk yang dibuka dari TAUTAN ULANGAN (14 Oktober 2026).
 *
 * Keluhan nyata: "siswa tamu diizinkan, tapi tetap dipaksa ke /masuk". Memang
 * tautan ulangan tetap melewati halaman masuk (server yang memutuskan izin tamu,
 * jadi klien tidak boleh menebak), tetapi dulu yang tampil lebih dulu adalah
 * kolom email + kata sandi — anak yang tidak punya akun merasa diminta masuk
 * sebagai murid sekolah. Sekarang, bila tujuannya halaman kuis dan pintu tamu
 * terbuka: pintu tamu lebih dulu, formulir akun dilipat di bawahnya.
 *
 * Yang dikunci di sini:
 * 1. dari tautan kuis + pintu tamu terbuka → formulir tamu ada SEBELUM isian akun;
 * 2. isian akun tetap ada di halaman (dilipat, bukan disembunyikan dari DOM);
 * 3. tanpa tautan ulangan → urutan lama (akun dulu, tamu di bawah);
 * 4. pintu tamu tertutup → tidak ada formulir tamu sama sekali (server yang
 *    menentukan; klien tidak menawarkan pintu yang pasti ditolak).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HalamanMasuk from '../../../sections/auth/HalamanMasuk.jsx'
import { useAuthStore } from '../../../sections/auth/authStore.js'

vi.mock('../../../sections/auth/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  // Halaman masuk kini juga menanyakan info tombol Google (14 Oktober 2026):
  // dimatikan di sini supaya tes ini tidak menembak jaringan sungguhan.
  return { ...asli, ambilInfoTamu: vi.fn(), ambilInfoGoogle: vi.fn() }
})

const api = await import('../../../sections/auth/api.js')
const ambilInfoTamu = /** @type {import('vitest').Mock} */ (api.ambilInfoTamu)
const ambilInfoGoogle = /** @type {import('vitest').Mock} */ (api.ambilInfoGoogle)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

/**
 * @param {{ tujuan?: string, diizinkan?: boolean }} opsi
 */
async function pasang({ tujuan, diizinkan = true }) {
  ambilInfoTamu.mockResolvedValue({ diizinkan })
  ambilInfoGoogle.mockResolvedValue({ aktif: false, client_id: '' })

  const entri = tujuan === undefined ? ['/masuk'] : [{ pathname: '/masuk', state: { lanjut: tujuan } }]

  act(() => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={entri}>
          <HalamanMasuk />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })

  // Beri kesempatan query `tamu-info` selesai (menentukan urutan tampilannya).
  await act(async () => {
    await sleep(30)
  })
}

beforeEach(() => {
  ambilInfoTamu.mockReset()
  ambilInfoGoogle.mockReset()
  useAuthStore.setState({ user: null, detikTunggu: 0 })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('HalamanMasuk — datang dari tautan ulangan', () => {
  it('menaruh pintu tamu DI ATAS formulir akun sekolah', async () => {
    await pasang({ tujuan: '/kuis/abc123' })

    const html = wadah.innerHTML
    const posisiTamu = html.indexOf('auth-tamu')
    const posisiAkun = html.indexOf('type="email"')

    expect(posisiTamu).toBeGreaterThan(-1)
    expect(posisiAkun).toBeGreaterThan(-1)
    expect(posisiTamu).toBeLessThan(posisiAkun)

    // Judulnya menyebut ulangan, bukan "Selamat datang kembali!".
    expect(wadah.textContent).toContain('Ikut ulangan ini')
    expect(wadah.textContent).toContain('Ikut ulangan sebagai siswa tamu')
    expect(wadah.textContent).not.toContain('Selamat datang kembali!')
  })

  it('formulir akun tetap ada, tetapi dilipat', async () => {
    await pasang({ tujuan: '/kuis/abc123' })

    const lipat = wadah.querySelector('details.auth-lipat-akun')
    expect(lipat).not.toBeNull()
    expect(lipat?.hasAttribute('open')).toBe(false)
    expect(lipat?.querySelector('input[type="email"]')).not.toBeNull()
    expect(lipat?.querySelector('input[type="password"]')).not.toBeNull()
  })

  it('tanpa tautan ulangan, urutannya seperti semula (akun dulu)', async () => {
    await pasang({})

    const html = wadah.innerHTML
    expect(html.indexOf('type="email"')).toBeLessThan(html.indexOf('auth-tamu'))
    expect(wadah.textContent).toContain('Selamat datang kembali!')
    expect(wadah.querySelector('details.auth-lipat-akun')).toBeNull()
  })

  it('selagi pintu tamu belum dijawab server: kolom email tidak muncul lebih dulu', async () => {
    // Jawaban `GET /v1/tamu` sengaja tidak pernah datang (permintaan menggantung).
    ambilInfoTamu.mockReturnValue(new Promise(() => {}))

    act(() => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={[{ pathname: '/masuk', state: { lanjut: '/kuis/abc123' } }]}>
            <HalamanMasuk />
          </MemoryRouter>
        </QueryClientProvider>,
      )
    })

    // Anak dari tautan TIDAK melihat kolom email/kata sandi walau sedetik pun.
    expect(wadah.querySelector('input[type="email"]')).toBeNull()
    expect(wadah.querySelector('input[type="password"]')).toBeNull()
    expect(wadah.querySelector('section.auth-tamu')).toBeNull()
  })

  it('pintu tamu tertutup: tidak ada formulir tamu walau datang dari tautan ulangan', async () => {
    await pasang({ tujuan: '/kuis/abc123', diizinkan: false })

    expect(wadah.querySelector('section.auth-tamu')).toBeNull()
    // Tamu tertutup → halaman kembali ke bentuk biasa: akun dulu, tanpa
    // formulir tamu dan tanpa lipatan.
    expect(wadah.textContent).toContain('Selamat datang kembali!')
    expect(wadah.querySelector('details.auth-lipat-akun')).toBeNull()
    expect(wadah.querySelector('input[type="email"]')).not.toBeNull()
  })

  it('dari tautan ulangan dengan pintu tamu tertutup: sebabnya dikatakan, bukan dibiarkan menebak', async () => {
    // Anak (dan guru yang menguji tautannya sendiri) harus tahu bahwa yang
    // menutup pintu bukan aplikasinya, melainkan kuis itu belum dibuka untuk
    // tamu/diterbitkan. Sebab itu ditulis di halaman, bukan disimpulkan sendiri.
    await pasang({ tujuan: '/kuis/abc123', diizinkan: false })

    const teks = wadah.textContent ?? ''
    expect(teks).toContain('Ulangan ini belum dibuka untuk siswa tanpa akun')
    expect(teks).toContain('Izinkan siswa tamu')
    expect(teks).toContain('menerbitkan kuisnya')

    // Kontrol negatif: tanpa tautan ulangan catatan itu TIDAK muncul — halaman
    // masuk biasa tidak boleh menuduh ada kuis yang tertutup.
    act(() => root.unmount())
    wadah.innerHTML = ''
    root = createRoot(wadah)

    await pasang({})

    expect(wadah.textContent).not.toContain('Ulangan ini belum dibuka untuk siswa tanpa akun')
  })
})
