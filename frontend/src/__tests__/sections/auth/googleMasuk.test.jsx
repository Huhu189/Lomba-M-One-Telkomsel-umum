// @vitest-environment jsdom
/**
 * Tombol "Masuk dengan Google" (14 Oktober 2026).
 *
 * Yang dijaga di sini — semuanya soal apa yang dilihat anak, bukan soal detail
 * GIS:
 * 1. sekolah yang belum menyalakan Google (`aktif: false`) → TIDAK ada tombol
 *    dan skrip Google pun tidak diunduh;
 * 2. sekolah yang menyalakannya → tombol dirender dengan id klien dari server
 *    (bukan dari bundel), dan `credential` yang dikirim Google diteruskan ke
 *    server lewat store (user langsung tersimpan + pemanggil diberi tahu);
 * 3. penolakan server tampil apa adanya, tanpa toast sukses palsu;
 * 4. `credential` kosong dari GIS tidak pernah dikirim ke server;
 * 5. skrip Google yang tidak bisa dimuat (jaringan sekolah memblokir
 *    accounts.google.com) pulang diam-diam — halaman tidak rusak.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GoogleMasuk from '../../../sections/auth/komponen/GoogleMasuk.jsx'
import { useAuthStore } from '../../../sections/auth/authStore.js'
import { useToastStore } from '../../../shared/ui/toast.jsx'

vi.mock('../../../sections/auth/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, ambilInfoGoogle: vi.fn(), masukGoogle: vi.fn() }
})

const api = await import('../../../sections/auth/api.js')
const ambilInfoGoogle = /** @type {import('vitest').Mock} */ (api.ambilInfoGoogle)
const masukGoogle = /** @type {import('vitest').Mock} */ (api.masukGoogle)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root
/** Konfigurasi GIS yang diberikan komponen (isi `callback`-nya yang kita panggil). */
let gis = /** @type {{ initialize: import('vitest').Mock, renderButton: import('vitest').Mock }} */ (
  /** @type {unknown} */ (null)
)

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

/** GIS tiruan: mencatat initialize/renderButton dan menyimpan callback-nya. */
function pasangGisPalsu() {
  gis = { initialize: vi.fn(), renderButton: vi.fn() }
  glob.google = { accounts: { id: gis } }
}

/**
 * @param {{ aktif?: boolean, client_id?: string }} info
 */
async function pasang(info) {
  ambilInfoGoogle.mockResolvedValue({ aktif: true, client_id: 'klien-uji', ...info })

  const klien = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  act(() => {
    root.render(
      <QueryClientProvider client={klien}>
        <GoogleMasuk berhasil={berhasilUji} />
      </QueryClientProvider>,
    )
  })

  // Query info + pemuatan skrip GIS (dua microtask/tick).
  await act(async () => {
    await sleep(30)
  })
}

const berhasilUji = vi.fn()

beforeEach(() => {
  ambilInfoGoogle.mockReset()
  masukGoogle.mockReset()
  berhasilUji.mockReset()
  pasangGisPalsu()

  useAuthStore.setState({ user: null, detikTunggu: 0 })
  useToastStore.setState({ toasts: [] })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  delete glob.google
})

describe('GoogleMasuk', () => {
  it('tidak menampilkan apa pun bila sekolah belum menyalakan Google', async () => {
    await pasang({ aktif: false, client_id: '' })

    expect(wadah.textContent).toBe('')
    expect(gis.initialize).not.toHaveBeenCalled()
  })

  it('merender tombol dengan id klien dari server lalu menyerahkan credential ke server', async () => {
    masukGoogle.mockResolvedValue({
      message: 'Berhasil masuk dengan Google.',
      baru: false,
      user: {
        id: 7,
        name: 'Rara',
        email: 'rara@sekolah.sch.id',
        role: 'murid',
        status: 'aktif',
        statusLabel: 'Aktif',
        emailTerverifikasi: true,
        isTamu: false,
        perluBuatSandi: false,
        punyaGoogle: true,
      },
    })

    await pasang({})

    // Id klien datang dari GET /v1/auth/google, bukan dari bundel frontend.
    expect(gis.initialize).toHaveBeenCalledTimes(1)
    expect(gis.initialize.mock.calls[0][0].client_id).toBe('klien-uji')
    expect(gis.renderButton).toHaveBeenCalledTimes(1)
    expect(wadah.textContent).toContain('Atau masuk dengan Google')

    const konfig = /** @type {{ callback: (r: {credential?: unknown}) => void }} */ (
      gis.initialize.mock.calls[0][0]
    )

    await act(async () => {
      konfig.callback({ credential: 'token-dari-google' })
      await sleep(20)
    })

    expect(masukGoogle).toHaveBeenCalledWith('token-dari-google')
    expect(useAuthStore.getState().user?.email).toBe('rara@sekolah.sch.id')
    expect(berhasilUji).toHaveBeenCalledTimes(1)
    expect(useToastStore.getState().toasts[0]?.jenis).toBe('sukses')
  })

  it('menampilkan penolakan server apa adanya tanpa membuka sesi', async () => {
    masukGoogle.mockRejectedValue({
      response: { status: 422, data: { message: 'Masuk dengan Google tidak bisa dipakai kali ini. Coba lagi ya.' } },
    })

    await pasang({})

    await act(async () => {
      /** @type {any} */ (gis.initialize.mock.calls[0][0]).callback({ credential: 'token-dari-google' })
      await sleep(20)
    })

    expect(wadah.textContent).toContain('Masuk dengan Google tidak bisa dipakai kali ini. Coba lagi ya.')
    expect(useAuthStore.getState().user).toBeNull()
    expect(berhasilUji).not.toHaveBeenCalled()
    const adaSukses = useToastStore
      .getState()
      .toasts.some((/** @type {import('../../../shared/ui/toast.jsx').Toast} */ t) => t.jenis === 'sukses')

    expect(adaSukses).toBe(false)
  })

  it('tidak menembak server bila Google tidak mengirim credential', async () => {
    await pasang({})

    await act(async () => {
      /** @type {any} */ (gis.initialize.mock.calls[0][0]).callback({})
      await sleep(20)
    })

    expect(masukGoogle).not.toHaveBeenCalled()
    expect(wadah.textContent).toContain('Google tidak mengirim data masuk')
  })

  /**
   * Terakhir di berkas ini dengan sengaja: skrip GIS dimuat sekali per halaman
   * (janji disimpan di modul), jadi kasus “skrip tidak bisa dimuat” tidak bisa
   * dicoba ulang setelah kasus lain memakai GIS tiruan di atas.
   */
  it('pulang diam-diam bila skrip Google tidak bisa dimuat (jaringan sekolah)', async () => {
    delete glob.google

    await pasang({})

    // Tidak ada tombol, tidak ada pemisah menggantung, dan tidak ada galat
    // menyala: jalur email + kata sandi tetap jadi andalan dan halaman tidak
    // terasa rusak.
    expect(wadah.textContent).toBe('')
    expect(masukGoogle).not.toHaveBeenCalled()
    expect(gis.initialize).not.toHaveBeenCalled()
  })
})
