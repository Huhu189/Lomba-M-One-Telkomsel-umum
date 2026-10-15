// @vitest-environment jsdom
/**
 * Tautan materi di UI (15 Oktober 2026).
 *
 * Beda dari `tautanSiswa.test.jsx`, tombol di sini **menyalin langsung**: satu
 * klik = tautan ada di klip papan. Karena itu yang dijaga:
 * 1. materi yang belum punya id → tombol mati dengan alasan jelas, tanpa kotak
 *    kosong yang membingungkan;
 * 2. materi tersimpan → sekali tekan benar-benar menulis `/materi/<id>` ke klip
 *    papan, dan kotaknya terbuka supaya guru bisa melihat apa yang tersalin;
 * 3. peramban menolak klip papan → dikatakan apa adanya dan tautannya tetap bisa
 *    disalin manual dari kotak itu.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import TautanMateri from '../../../sections/material/editor/TautanMateri.jsx'
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

describe('TautanMateri', () => {
  it('memadamkan tombol selama materinya belum punya alamat', () => {
    pasang(<TautanMateri id={0} status="draf" kelas="4A" />)

    const salin = tombol('Salin tautan materi')

    expect(salin).toBeTruthy()
    expect(salin?.disabled).toBe(true)
    expect(wadah.textContent).toContain('belum punya alamat')
    expect(wadah.querySelector('input')).toBeNull()
  })

  it('menyalin alamat /materi/<id> sekali tekan dan membuka kotaknya', async () => {
    pasang(<TautanMateri id={12} status="publikasi" kelas="4A" />)

    expect(wadah.querySelector('input')).toBeNull()

    await act(async () => {
      tombol('Salin tautan materi')?.click()
    })

    const alamat = `${window.location.origin}/materi/12`

    expect(tulisKlip).toHaveBeenCalledWith(alamat)
    expect(useToastStore.getState().toasts[0]?.jenis).toBe('sukses')

    // Kotak hanya-baca: tautan tidak boleh “diperbaiki” guru lalu dibagikan salah.
    const kotak = /** @type {HTMLInputElement} */ (wadah.querySelector('input'))

    expect(kotak.value).toBe(alamat)
    expect(kotak.readOnly).toBe(true)
    expect(wadah.textContent).toContain('murid kelas 4A')
  })

  it('mengatakan apa adanya bila peramban menolak salin otomatis, kotaknya tetap terbuka', async () => {
    Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true })

    pasang(<TautanMateri id={12} status="publikasi" kelas="4A" />)

    await act(async () => {
      tombol('Salin tautan materi')?.click()
    })

    const toast = useToastStore.getState().toasts[0]

    expect(toast?.jenis).toBe('info')
    expect(toast?.pesan).toContain('Salin tautannya dari kotak')
    expect(/** @type {HTMLInputElement} */ (wadah.querySelector('input')).value).toBe(
      `${window.location.origin}/materi/12`,
    )
  })

  it('memakai kalimat catatan yang sama dengan modul murninya', async () => {
    pasang(<TautanMateri id={12} status="draf" kelas="" />)

    await act(async () => {
      tombol('Salin tautan materi')?.click()
    })

    // Draf: guru diberi tahu bahwa murid belum bisa membukanya — tanpa ini
    // tautan “terkirim ke grup kelas” terasa sudah cukup padahal belum.
    expect(wadah.textContent).toContain('belum terbit')
    expect(wadah.textContent).toContain('yang sudah masuk dengan akunnya')
  })
})
