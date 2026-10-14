// @vitest-environment jsdom
/**
 * Tautan siswa (14 Oktober 2026, keluhan: “untuk mendapat link pembagiannya saja
 * harus scroll jauh”).
 *
 * Komponen ini sekarang dipakai di **bar lengket** halaman susun kuis dan di
 * **baris aksi detail kuis**, jadi yang dijaga di sini adalah perilaku yang
 * berlaku di keduanya:
 * 1. kuis yang belum punya slug → tombol mati + alasan yang jelas (bukan tombol
 *    yang ditekan lalu diam);
 * 2. kuis berslug → kotak tautannya muncul saat diminta, isinya alamat slug
 *    (bukan id), dan tombol Salin benar-benar menulis ke klip papan;
 * 3. peramban tanpa izin salin → dikatakan apa adanya, kotaknya tetap terbuka
 *    supaya tautannya bisa disalin manual;
 * 4. catatan draf & catatan siswa tamu mengikuti keadaan kuisnya.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import TautanSiswa from '../../../sections/quiz/TautanSiswa.jsx'
import { useToastStore } from '../../../shared/ui/toast.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root
/** @type {import('vitest').Mock} */
let tulisKlip

/** @param {import('react').ReactNode} isi */
function pasang(isi) {
  act(() => root.render(isi))
}

/** @param {string} teks @returns {HTMLButtonElement|undefined} */
function tombol(teks) {
  return /** @type {HTMLButtonElement|undefined} */ (
    [...wadah.querySelectorAll('button')].find((satu) => (satu.textContent ?? '').includes(teks))
  )
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  tulisKlip = vi.fn().mockResolvedValue(undefined)

  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: tulisKlip },
    configurable: true,
  })

  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('TautanSiswa', () => {
  it('memadamkan tombol dengan alasan jelas selama kuisnya belum punya slug', () => {
    pasang(<TautanSiswa slug="" status="draf" />)

    const buka = tombol('Tautan siswa')

    expect(buka).toBeTruthy()
    expect(buka?.disabled).toBe(true)
    expect(wadah.textContent).toContain('Simpan draf dulu')
    // Tombol mati = tidak boleh ada kotak tautan kosong yang membingungkan.
    expect(wadah.querySelector('input')).toBeNull()
  })

  it('menampilkan alamat slug saat diminta dan menyalinnya sekali tekan', async () => {
    pasang(<TautanSiswa slug="unu5k" status="publikasi" />)

    expect(wadah.querySelector('input')).toBeNull()

    await act(async () => {
      tombol('Tautan siswa')?.click()
    })

    const kotak = /** @type {HTMLInputElement} */ (wadah.querySelector('input'))

    expect(kotak.value).toBe(`${window.location.origin}/kuis/unu5k`)
    // Kotak hanya-baca: tautan tidak boleh "diperbaiki" guru lalu dibagikan salah.
    expect(kotak.readOnly).toBe(true)

    await act(async () => {
      tombol('Salin')?.click()
    })

    expect(tulisKlip).toHaveBeenCalledWith(`${window.location.origin}/kuis/unu5k`)
    expect(useToastStore.getState().toasts[0]?.jenis).toBe('sukses')
  })

  it('mengatakan apa adanya bila peramban menolak salin otomatis, dan tetap membuka kotaknya', async () => {
    Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true })

    pasang(<TautanSiswa slug="unu5k" status="publikasi" />)

    await act(async () => {
      tombol('Tautan siswa')?.click()
    })
    await act(async () => {
      tombol('Salin')?.click()
    })

    const toast = useToastStore.getState().toasts[0]

    expect(toast?.jenis).toBe('info')
    expect(toast?.pesan).toContain('Salin tautannya dari kotak')
    // Tanpa kotak yang tetap terbuka, guru tidak punya cara menyalin sama sekali.
    expect(/** @type {HTMLInputElement} */ (wadah.querySelector('input')).value).toBe(
      `${window.location.origin}/kuis/unu5k`,
    )
  })

  it('menyebut keadaan draf dan izin siswa tamu apa adanya', async () => {
    pasang(<TautanSiswa slug="unu5k" status="draf" tamuAktif />)

    await act(async () => {
      tombol('Tautan siswa')?.click()
    })

    expect(wadah.textContent).toContain('masih draf')
    expect(wadah.textContent).toContain('pintu tamu baru terbuka setelah kuis diterbitkan')

    // Kuis terbit + izin tamu: kalimatnya berubah jadi "boleh ikut". Kotaknya
    // tidak perlu dibuka lagi — tombol ini pelipat, dan menekannya sekali lagi
    // justru menutupnya (yang memang perilaku yang diinginkan).
    await act(async () => {
      root.render(<TautanSiswa slug="unu5k" status="publikasi" tamuAktif />)
    })

    expect(wadah.textContent).toContain('Siswa tamu boleh ikut')
    expect(wadah.textContent).not.toContain('masih draf')
  })

  it('labelnya bisa diganti supaya cocok dengan tempat pemasangannya', () => {
    pasang(<TautanSiswa slug="unu5k" status="draf" label="Buat tautan siswa" />)

    expect(tombol('Buat tautan siswa')).toBeTruthy()
  })
})
