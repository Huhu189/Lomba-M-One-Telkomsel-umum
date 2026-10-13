// @vitest-environment jsdom
/**
 * Halaman akun (/pengaturan) setelah dipersempit 13 Oktober 2026.
 *
 * Dua hal yang dijaga di sini:
 * 1. **Isinya akun**, bukan setelan ulangan: nama, kata sandi, tampilan, dan
 *    penunjuk bahwa proteksi/waktu/penilaian diatur per kuis. Salah satu
 *    pemeriksaan sengaja mencari kalimat penunjuk itu, karena justru di situlah
 *    guru dulu tersesat (mencari setelan ulangan di halaman akun).
 * 2. **Alur simpannya jujur**: nama yang tersimpan memperbarui sesi, sandi wajib
 *    menyertakan sandi lama, dan konfirmasi yang tidak sama ditahan di klien
 *    (tidak pernah dikirim ke server).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HalamanAkun from '../../../sections/settings/HalamanAkun.jsx'
import { useAuthStore } from '../../../sections/auth/authStore.js'
import { useTemaStore } from '../../../shared/store/tema.js'

vi.mock('../../../sections/settings/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, simpanNamaAkun: vi.fn(), gantiSandiAkun: vi.fn() }
})

const api = await import('../../../sections/settings/api.js')
const simpanNamaAkun = /** @type {import('vitest').Mock} */ (api.simpanNamaAkun)
const gantiSandiAkun = /** @type {import('vitest').Mock} */ (api.gantiSandiAkun)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

const guru = {
  id: 7,
  name: 'Guru Matematika',
  email: 'guru@sekolah.test',
  role: 'guru',
  status: 'aktif',
  statusLabel: 'Aktif',
  emailTerverifikasi: true,
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
          <HalamanAkun />
        </MemoryRouter>
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
 * Isi satu input seperti pengguna mengetik.
 * @param {string} pemilih
 * @param {string} nilai
 */
function isi(pemilih, nilai) {
  const input = /** @type {HTMLInputElement|null} */ (cari(pemilih))
  if (!input) throw new Error(`input ${pemilih} tidak ada`)
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, nilai)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
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
  simpanNamaAkun.mockReset()
  gantiSandiAkun.mockReset()
  useAuthStore.setState({ user: { ...guru } })
  useTemaStore.setState({ tema: 'terang' })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('HalamanAkun', () => {
  it('menampilkan akun, bukan setelan ulangan', async () => {
    pasang()

    expect(await tungguTeks('Kata sandi')).toBe(true)
    expect(wadah.textContent).toContain('Profil')
    expect(wadah.textContent).toContain('Tampilan')
    // Penunjuk jujur ke tempat setelan ulangan sekarang berada.
    expect(wadah.textContent).toContain('Setelan ulangan')
    expect(wadah.textContent).toContain('per ulangan')

    // Saklar anti-cheat tidak boleh ada lagi di sini.
    expect(wadah.querySelectorAll('input[role="switch"]').length).toBe(0)
  })

  it('mengisi nama dari sesi dan email hanya bisa dibaca', async () => {
    pasang()
    await tungguTeks('Profil')

    const inputNama = /** @type {HTMLInputElement} */ (cari('input[autocomplete="name"]'))
    const inputEmail = /** @type {HTMLInputElement} */ (cari('#akun-email'))

    expect(inputNama.value).toBe('Guru Matematika')
    expect(inputEmail.value).toBe('guru@sekolah.test')
    expect(inputEmail.readOnly).toBe(true)
  })

  it('menyimpan nama baru lewat /v1/akun dan memperbarui sesi', async () => {
    simpanNamaAkun.mockResolvedValue({ ...guru, name: 'Bu Matematika' })
    pasang()
    await tungguTeks('Profil')

    isi('input[autocomplete="name"]', 'Bu Matematika')
    await act(async () => {
      tombol('Simpan nama')?.click()
      await sleep(50)
    })

    // TanStack meneruskan konteks mutasi sebagai argumen kedua, jadi yang
    // diperiksa adalah argumen pertamanya (nama yang benar-benar dikirim).
    expect(simpanNamaAkun.mock.calls[0]?.[0]).toBe('Bu Matematika')
    expect(useAuthStore.getState().user?.name).toBe('Bu Matematika')
  })

  it('menahan konfirmasi kata sandi yang tidak sama sebelum menyentuh server', async () => {
    pasang()
    await tungguTeks('Kata sandi')

    isi('input[autocomplete="current-password"]', 'sandi-lama-aman-10')
    const baru = /** @type {HTMLInputElement[]} */ (
      [...wadah.querySelectorAll('input[autocomplete="new-password"]')]
    )
    isi('input[autocomplete="new-password"]', 'sandi-baru-aman-10')

    // Bidang "ulangi" adalah input kedua ber-autocomplete new-password.
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(baru[1], 'sandi-baru-beda-10')
      baru[1]?.dispatchEvent(new window.Event('input', { bubbles: true }))
    })

    await act(async () => {
      tombol('Ganti kata sandi')?.click()
      await sleep(50)
    })

    expect(gantiSandiAkun).not.toHaveBeenCalled()
    expect(wadah.textContent).toContain('Kata sandi baru belum sama.')
  })

  it('mengirim sandi lama + sandi baru ke server dan mengosongkan formulirnya', async () => {
    gantiSandiAkun.mockResolvedValue({
      message: 'Kata sandi diganti. Sesi di perangkat lain yang memakai akun ini sudah diakhiri.',
      user: { ...guru },
    })
    pasang()
    await tungguTeks('Kata sandi')

    isi('input[autocomplete="current-password"]', 'sandi-lama-aman-10')
    const baru = /** @type {HTMLInputElement[]} */ (
      [...wadah.querySelectorAll('input[autocomplete="new-password"]')]
    )
    isi('input[autocomplete="new-password"]', 'sandi-baru-aman-10')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(baru[1], 'sandi-baru-aman-10')
      baru[1]?.dispatchEvent(new window.Event('input', { bubbles: true }))
    })

    await act(async () => {
      tombol('Ganti kata sandi')?.click()
      await sleep(50)
    })

    expect(gantiSandiAkun.mock.calls[0]?.[0]).toEqual({
      sandiSekarang: 'sandi-lama-aman-10',
      sandiBaru: 'sandi-baru-aman-10',
    })

    const lama = /** @type {HTMLInputElement} */ (cari('input[autocomplete="current-password"]'))
    expect(lama.value).toBe('')
  })

  it('akun tamu diberi tahu bahwa setelan akun tidak berlaku untuknya', async () => {
    useAuthStore.setState({ user: { ...guru, name: 'Anak Tamu', isTamu: true } })
    pasang()

    expect(await tungguTeks('Kamu masuk sebagai siswa tamu')).toBe(true)
    expect(wadah.querySelector('input[autocomplete="name"]')).toBeNull()
    expect(wadah.textContent).toContain('Daftar sebagai murid')
  })
})
