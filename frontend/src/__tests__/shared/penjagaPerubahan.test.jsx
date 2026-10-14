// @vitest-environment jsdom
/**
 * Penjaga "belum tersimpan" (14 Oktober 2026, temuan K3).
 *
 * Dulu tidak ada `beforeunload` maupun `useBlocker` di seluruh aplikasi:
 * menutup tab, menyegarkan halaman, atau menekan Batal membuang pekerjaan guru
 * tanpa peringatan apa pun. Tes ini menjaga dua hal: peringatan peramban
 * terpasang HANYA saat ada perubahan tertahan, dan dilepas kembali setelahnya.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PESAN_BELUM_TERSIMPAN, usePenjagaSebelumTutup } from '../../shared/penjagaPerubahan.js'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {import('react-dom/client').Root|null} */
let root = null
/** @type {HTMLElement|null} */
let wadah = null

afterEach(() => {
  if (root !== null) act(() => /** @type {import('react-dom/client').Root} */ (root).unmount())
  wadah?.remove()
  root = null
  wadah = null
})

/** Komponen uji: cuma memasang penjaganya. @param {{aktif: boolean}} props */
function Uji({ aktif }) {
  usePenjagaSebelumTutup(aktif)

  return <p>{aktif ? 'kotor' : 'bersih'}</p>
}

/** @param {boolean} aktif */
function pasang(aktif) {
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)

  act(() => {
    /** @type {import('react-dom/client').Root} */ (root).render(<Uji aktif={aktif} />)
  })
}

/** Kirim `beforeunload` dan laporkan apakah peramban akan bertanya. */
function kirimSebelumTutup() {
  const peristiwa = new window.Event('beforeunload', { cancelable: true })

  window.dispatchEvent(peristiwa)

  return peristiwa.defaultPrevented
}

describe('usePenjagaSebelumTutup', () => {
  it('meminta konfirmasi peramban saat ada perubahan tertahan', () => {
    pasang(true)

    expect(kirimSebelumTutup()).toBe(true)
  })

  it('tidak mengganggu saat tidak ada perubahan tertahan', () => {
    pasang(false)

    expect(kirimSebelumTutup()).toBe(false)
  })

  it('melepas penjaganya saat perubahan sudah tersimpan', () => {
    pasang(true)
    expect(kirimSebelumTutup()).toBe(true)

    act(() => {
      /** @type {import('react-dom/client').Root} */ (root).render(<Uji aktif={false} />)
    })

    expect(kirimSebelumTutup()).toBe(false)
  })

  it('pesan yang dipakai dialog menyebut akibatnya dengan jelas', () => {
    expect(PESAN_BELUM_TERSIMPAN).toContain('hilang')
  })
})
