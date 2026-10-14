// @vitest-environment jsdom
/**
 * Halaman "Buat kata sandimu" — lapisan sekali seumur akun untuk murid yang
 * masuk/daftar lewat Google (14 Oktober 2026).
 *
 * Yang dikunci di sini: isian yang terlalu pendek atau tidak sama ditolak
 * SEBELUM menembak server, penanda `perluBuatSandi` di store ikut padam setelah
 * server menerima sandinya (supaya gerbang halaman lain di klien ikut terbuka),
 * dan penolakan server (mis. rute ini sudah tidak boleh dipakai lagi) tampil apa
 * adanya tanpa toast sukses palsu.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import HalamanBuatSandi from '../../../sections/auth/HalamanBuatSandi.jsx'
import { useAuthStore } from '../../../sections/auth/authStore.js'
import { useToastStore } from '../../../shared/ui/toast.jsx'

vi.mock('../../../sections/auth/api.js', async (importOriginal) => {
  const asli = /** @type {Record<string, unknown>} */ (await importOriginal())
  return { ...asli, buatSandiPertama: vi.fn() }
})

const api = await import('../../../sections/auth/api.js')
const buatSandiPertama = /** @type {import('vitest').Mock} */ (api.buatSandiPertama)

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
 * Isi kolom kata sandi ke-`indeks` (0 = kata sandi, 1 = ulangi) — dicari lewat
 * urutan, bukan lewat id, karena id-nya dibuat otomatis oleh `Isian`.
 * @param {number} indeks
 * @param {string} nilai
 */
async function isi(indeks, nilai) {
  const input = /** @type {HTMLInputElement} */ (wadah.querySelectorAll('input')[indeks])
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, nilai)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Kirim formulir (setelah kolom-kolomnya terisi). */
async function kirim() {
  await act(async () => {
    /** @type {HTMLFormElement|null} */ (cari('form'))?.requestSubmit()
  })
}

const userBaru = {
  id: 21,
  name: 'Rara',
  email: 'rara@sekolah.sch.id',
  role: 'murid',
  status: 'aktif',
  statusLabel: 'Aktif',
  emailTerverifikasi: true,
  isTamu: false,
  perluBuatSandi: true,
  punyaGoogle: true,
}

beforeEach(() => {
  buatSandiPertama.mockReset()
  useAuthStore.setState({ user: { ...userBaru }, detikTunggu: 0 })
  useToastStore.setState({ toasts: [] })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('HalamanBuatSandi', () => {
  it('menolak sandi pendek atau isian ulang yang beda tanpa menembak server', async () => {
    pasang(<HalamanBuatSandi />)

    await isi(0, 'pendek')
    await isi(1, 'pendek')
    await kirim()

    expect(buatSandiPertama).not.toHaveBeenCalled()
    expect(wadah.textContent).toContain('Kata sandi minimal 10 karakter')

    await isi(0, 'rahasia-rara-2026')
    await isi(1, 'rahasia-rara-2027')
    await kirim()

    expect(buatSandiPertama).not.toHaveBeenCalled()
    expect(wadah.textContent).toContain('Kata sandi belum sama')
  })

  it('menyimpan sandi, memadamkan penanda di store, lalu memanggil berhasil', async () => {
    buatSandiPertama.mockResolvedValue({
      message: 'Kata sandimu tersimpan. Sekarang akunmu bisa dipakai di perangkat lain juga.',
      user: { ...userBaru, perluBuatSandi: false },
    })

    const berhasil = vi.fn()
    pasang(<HalamanBuatSandi nama="Rara" berhasil={berhasil} />)

    expect(wadah.textContent).toContain('Rara')

    await isi(0, 'rahasia-rara-2026')
    await isi(1, 'rahasia-rara-2026')
    await kirim()

    expect(buatSandiPertama).toHaveBeenCalledWith({ password: 'rahasia-rara-2026' })
    // Gerbang halaman lain membaca penanda ini — tanpa padam, murid dilempar
    // balik ke halaman ini terus.
    expect(useAuthStore.getState().user?.perluBuatSandi).toBe(false)
    expect(useToastStore.getState().toasts[0]?.jenis).toBe('sukses')
    expect(berhasil).toHaveBeenCalledTimes(1)
  })

  it('menampilkan penolakan server apa adanya dan tidak mengubah store', async () => {
    buatSandiPertama.mockRejectedValue({
      response: {
        status: 422,
        data: { message: 'Kata sandi akun ini sudah dibuat. Pakai "Ganti kata sandi" kalau mau menggantinya.' },
      },
    })

    const berhasil = vi.fn()
    pasang(<HalamanBuatSandi berhasil={berhasil} />)

    await isi(0, 'rahasia-rara-2026')
    await isi(1, 'rahasia-rara-2026')
    await kirim()

    expect(wadah.textContent).toContain('Kata sandi akun ini sudah dibuat')
    expect(useAuthStore.getState().user?.perluBuatSandi).toBe(true)
    expect(berhasil).not.toHaveBeenCalled()
    const adaSukses = useToastStore
      .getState()
      .toasts.some((/** @type {import('../../../shared/ui/toast.jsx').Toast} */ t) => t.jenis === 'sukses')

    expect(adaSukses).toBe(false)
  })
})
