// @vitest-environment jsdom
/**
 * Tes interaksi (keyboard) untuk DialogKonfirmasi dan TombolIkon.
 *
 * Dialog memakai elemen <dialog> bawaan. jsdom belum menirukan penekanan Esc
 * pada dialog modal, jadi yang diuji adalah jalur yang dipakai browser saat
 * Esc ditekan: event `cancel` yang bisa dicegah. Handler komponen harus
 * memanggil onBatal dan tidak menutup dialog sendiri.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import DialogKonfirmasi from '../../../shared/ui/DialogKonfirmasi.jsx'
import { TombolIkon } from '../../../shared/ui/Tombol.jsx'
import { IkonTongSampah } from '../../../icons.jsx'

/** @type {{ IS_REACT_ACT_ENVIRONMENT?: boolean }} */ (globalThis).IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

beforeEach(() => {
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

/** @param {import('react').ReactNode} isi */
function pasang(isi) {
  act(() => root.render(isi))
}

/** @param {string} pemilih @returns {HTMLElement|null} */
function cari(pemilih) {
  return /** @type {HTMLElement|null} */ (wadah.querySelector(pemilih))
}

describe('DialogKonfirmasi', () => {
  it('tertutup saat buka=false dan terbuka saat buka=true', () => {
    pasang(<DialogKonfirmasi buka={false} judul="Hapus kelas 6A?" labelYa="Hapus kelas" onYa={() => {}} onBatal={() => {}} />)
    const dialog = /** @type {HTMLDialogElement} */ (cari('dialog'))
    expect(dialog.open).toBe(false)

    pasang(<DialogKonfirmasi buka judul="Hapus kelas 6A?" labelYa="Hapus kelas" onYa={() => {}} onBatal={() => {}} />)
    expect(/** @type {HTMLDialogElement} */ (cari('dialog')).open).toBe(true)
  })

  it('menandai dirinya alertdialog dan menghubungkan judul serta isi', () => {
    pasang(
      <DialogKonfirmasi buka judul="Hapus kelas 6A?" labelYa="Hapus kelas" onYa={() => {}} onBatal={() => {}}>
        31 murid akan dilepas dari kelas ini.
      </DialogKonfirmasi>,
    )
    const dialog = cari('dialog')
    expect(dialog?.getAttribute('role')).toBe('alertdialog')
    const idJudul = dialog?.getAttribute('aria-labelledby')
    expect(idJudul).toBeTruthy()
    expect(cari(`#${idJudul}`)?.textContent).toContain('Hapus kelas 6A?')
    expect(cari('#dialog-konfirmasi-isi')?.textContent).toContain('31 murid akan dilepas')
  })

  it('menekan Esc (event cancel) memanggil onBatal dan tidak membiarkan dialog tertutup sendiri', () => {
    const onBatal = vi.fn()
    pasang(<DialogKonfirmasi buka judul="Kumpulkan?" labelYa="Selesai" onYa={() => {}} onBatal={onBatal} />)

    const dialog = /** @type {HTMLDialogElement} */ (cari('dialog'))
    const acara = new Event('cancel', { cancelable: true })
    act(() => {
      dialog.dispatchEvent(acara)
    })

    expect(onBatal).toHaveBeenCalledTimes(1)
    expect(acara.defaultPrevented).toBe(true)
  })

  it('tombol Batal dan tombol ya memanggil handler masing-masing', () => {
    const onYa = vi.fn()
    const onBatal = vi.fn()
    pasang(<DialogKonfirmasi buka judul="Hapus?" labelYa="Hapus kelas" bahaya onYa={onYa} onBatal={onBatal} />)

    const tombolYa = [...wadah.querySelectorAll('button')].find((b) => b.textContent?.includes('Hapus kelas'))
    expect(tombolYa?.className).toContain('btn-bahaya')
    act(() => tombolYa?.click())
    expect(onYa).toHaveBeenCalledTimes(1)

    const tombolBatal = [...wadah.querySelectorAll('button')].find((b) => b.textContent?.includes('Batal'))
    act(() => tombolBatal?.click())
    expect(onBatal).toHaveBeenCalledTimes(1)
  })
})

describe('TombolIkon', () => {
  it('bisa diaktifkan dengan Enter dari keyboard (tombol asli, bukan div)', () => {
    const onClick = vi.fn()
    pasang(<TombolIkon label="Hapus kelas 6A" ikon={IkonTongSampah} onClick={onClick} />)

    const tombol = cari('button[aria-label="Hapus kelas 6A"]')
    expect(tombol?.tagName).toBe('BUTTON')
    act(() => tombol?.click())
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
