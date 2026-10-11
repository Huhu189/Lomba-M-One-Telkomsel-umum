// @vitest-environment jsdom
/**
 * Formulir masuk siswa tamu (mode tamu tanpa login).
 *
 * Yang dijaga di sini: identitas tamu hanya nama (tanpa kata sandi), nama
 * dirapikan sebelum dikirim, isian yang terlalu pendek ditolak SEBELUM menembak
 * server, dan pesan penolakan server (mis. guru belum membuka kuis untuk tamu)
 * muncul apa adanya — bukan toast sukses palsu.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import MasukTamu from '../../../sections/auth/MasukTamu.jsx'
import { useAuthStore } from '../../../sections/auth/authStore.js'
import { useToastStore } from '../../../shared/ui/toast.jsx'

vi.mock('../../../sections/auth/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, masukTamu: vi.fn() }
})

const api = await import('../../../sections/auth/api.js')
const masukTamu = /** @type {import('vitest').Mock} */ (api.masukTamu)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/** @param {import('react').ReactNode} isi */
function pasang(isi) {
  act(() => root.render(isi))
}

/** @param {string} pemilih @returns {HTMLElement|null} */
function cari(pemilih) {
  return /** @type {HTMLElement|null} */ (wadah.querySelector(pemilih))
}

/**
 * Isi kolom nama dan kirim formulirnya.
 * @param {string} nama
 */
async function kirimNama(nama) {
  const input = /** @type {HTMLInputElement} */ (cari('input#nama-input') ?? cari('input'))
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, nama)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  await act(async () => {
    /** @type {HTMLFormElement|null} */ (cari('form'))?.requestSubmit()
  })
}

beforeEach(() => {
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
  useAuthStore.setState({ user: null, detikTunggu: 0 })
  useToastStore.setState({ toasts: [] })
  masukTamu.mockReset()
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('MasukTamu', () => {
  it('mengirim nama yang dirapikan, membuka sesi, lalu memanggil berhasil', async () => {
    const berhasil = vi.fn()
    masukTamu.mockResolvedValue({
      id: 9,
      name: 'Rara',
      email: 'tamu+rara@tamu.invalid',
      role: 'murid',
      status: 'aktif',
      statusLabel: 'Aktif',
      emailTerverifikasi: true,
      isTamu: true,
    })

    pasang(<MasukTamu berhasil={berhasil} />)
    await kirimNama('  Rara  ')

    // Nama dirapikan klien (server tetap merapikan lagi sebagai pengaman).
    expect(masukTamu).toHaveBeenCalledWith('Rara')
    expect(useAuthStore.getState().user?.isTamu).toBe(true)
    expect(berhasil).toHaveBeenCalledTimes(1)
    expect(useToastStore.getState().toasts[0]?.jenis).toBe('sukses')
  })

  it('tidak menembak server bila nama terlalu pendek', async () => {
    pasang(<MasukTamu />)
    await kirimNama('A')

    expect(masukTamu).not.toHaveBeenCalled()
    expect(wadah.textContent).toContain('Nama minimal 2 karakter')
  })

  it('menampilkan pesan penolakan server apa adanya (mis. kuota tamu belum dibuka)', async () => {
    masukTamu.mockRejectedValue({
      response: { status: 422, data: { message: 'Sekolah ini belum membuka masuk sebagai siswa tamu.' } },
    })

    const berhasil = vi.fn()
    pasang(<MasukTamu berhasil={berhasil} />)
    await kirimNama('Rara')

    expect(wadah.textContent).toContain('Sekolah ini belum membuka masuk sebagai siswa tamu.')
    expect(useAuthStore.getState().user).toBeNull()
    expect(berhasil).not.toHaveBeenCalled()
    // Gagal = tidak boleh ada toast sukses.
    const adaSukses = useToastStore
      .getState()
      .toasts.some((/** @type {import('../../../shared/ui/toast.jsx').Toast} */ t) => t.jenis === 'sukses')

    expect(adaSukses).toBe(false)
  })
})
