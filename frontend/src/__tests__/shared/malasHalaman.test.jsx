// @vitest-environment jsdom
/**
 * Pagar pembungkus rute malas (`MalasHalaman`).
 *
 * Yang dijaga di sini adalah cacat yang ditemukan smoke luring (14 Okt 2026):
 * dengan `React.lazy`, satu modul halaman yang gagal diunduh — misalnya murid
 * menekan menu saat koneksinya putus, sehingga modulnya belum pernah terunduh —
 * melempar galat ke batas galat aplikasi dan menutup **seluruh** aplikasi,
 * termasuk layar ulangan yang sedang dikerjakan. Tiga sifat yang diuji:
 *
 * 1. kegagalan berhenti di halamannya sendiri (kartu "belum bisa diunduh",
 *    aplikasi tidak dilempar ke batas galat);
 * 2. tombol "Coba lagi" benar-benar mengunduh ulang (bukan sekadar membuang
 *    galat yang tersimpan seperti `resetErrorBoundary` pada `lazy`);
 * 3. halaman memuat sendiri saat peramban melaporkan koneksi kembali (`online`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import MalasHalaman from '../../shared/ui/MalasHalaman.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/** Komponen halaman palsu yang berhasil diunduh. */
function HalamanPalsu() {
  return <p>HALAMAN BERHASIL DIUNDUH</p>
}

/** @param {number} ms */
const sleep = (ms) => new Promise((selesai) => setTimeout(selesai, ms))

/**
 * Menunggu sampai teks muncul di wadah (paling lama `batas` ms).
 * @param {string} teks
 * @param {number} [batas]
 */
async function tungguTeks(teks, batas = 2000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batas) {
    if ((wadah.textContent ?? '').includes(teks)) return true
    await act(async () => {
      await sleep(20)
    })
  }
  return (wadah.textContent ?? '').includes(teks)
}

/** @param {string} teks @returns {HTMLButtonElement|null} */
function tombol(teks) {
  const semua = /** @type {HTMLButtonElement[]} */ ([...wadah.querySelectorAll('button')])
  return semua.find((satu) => satu.textContent?.includes(teks)) ?? null
}

/**
 * Merender pembungkusnya dengan satu pemuat modul.
 * @param {() => Promise<{ default: import('react').ElementType }>} pemuat
 */
function pasang(pemuat) {
  act(() => {
    root.render(<MalasHalaman pemuat={pemuat} />)
  })
}

beforeEach(() => {
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('MalasHalaman', () => {
  it('menampilkan penanda memuat selama modulnya belum selesai', async () => {
    pasang(() => new Promise(() => {}))

    expect(await tungguTeks('Memuat halaman…', 1000)).toBe(true)
    // Belum ada kartu galat dan belum ada halaman.
    expect(wadah.textContent ?? '').not.toContain('belum bisa diunduh')
  })

  it('modul yang gagal diunduh hanya menampilkan kartu coba lagi, bukan galat aplikasi', async () => {
    pasang(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))

    expect(await tungguTeks('Halaman ini belum bisa diunduh')).toBe(true)
    // Pesannya menenangkan dan menyebut pekerjaan murid tetap aman.
    expect(wadah.textContent ?? '').toContain('tetap tersimpan di perangkat ini')
    expect(tombol('Coba lagi')).not.toBeNull()
  })

  it('"Coba lagi" benar-benar mengunduh ulang modulnya', async () => {
    const pemuat = vi
      .fn()
      .mockRejectedValueOnce(new Error('koneksi putus'))
      .mockResolvedValue({ default: HalamanPalsu })

    pasang(pemuat)
    expect(await tungguTeks('belum bisa diunduh')).toBe(true)
    expect(pemuat).toHaveBeenCalledTimes(1)

    const cobaLagi = tombol('Coba lagi')
    expect(cobaLagi).not.toBeNull()
    act(() => cobaLagi?.click())

    expect(await tungguTeks('HALAMAN BERHASIL DIUNDUH')).toBe(true)
    expect(pemuat).toHaveBeenCalledTimes(2)
  })

  it('memuat sendiri begitu koneksi kembali (event online)', async () => {
    const pemuat = vi
      .fn()
      .mockRejectedValueOnce(new Error('koneksi putus'))
      .mockResolvedValue({ default: HalamanPalsu })

    pasang(pemuat)
    expect(await tungguTeks('belum bisa diunduh')).toBe(true)

    act(() => {
      window.dispatchEvent(new window.Event('online'))
    })

    expect(await tungguTeks('HALAMAN BERHASIL DIUNDUH')).toBe(true)
  })

  it('halaman yang berhasil diunduh menerima properti dari rutenya', async () => {
    /** @param {{ nama?: string }} props */
    function HalamanBernama({ nama }) {
      return <p>HALAMAN {nama}</p>
    }

    act(() => {
      root.render(<MalasHalaman pemuat={() => Promise.resolve({ default: HalamanBernama })} nama="KELAS" />)
    })

    expect(await tungguTeks('HALAMAN KELAS')).toBe(true)
  })
})
