// @vitest-environment jsdom
/**
 * Denyut proteksi ber-nonce (2D) — sisi klien.
 *
 * Yang dijaga:
 * - tidak ada denyut sama sekali bila proteksi tidak menyala (`denyut` null)
 *   atau ulangan tidak berjalan — jangan menembak server tanpa alasan;
 * - nonce **dirotasi**: kiriman kedua memakai nonce dari respons pertama;
 * - nonce yang ditolak (409) memanggil pemanggil supaya payload attempt dimuat
 *   ulang dengan nonce segar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import useDenyutProteksi from '../../../sections/presence/useDenyutProteksi.js'

vi.mock('../../../sections/attempt/api.js', () => ({ denyutProteksi: vi.fn() }))

const api = await import('../../../sections/attempt/api.js')
const denyutProteksi = /** @type {import('vitest').Mock} */ (api.denyutProteksi)

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root

/**
 * @param {{ denyut: { nonce: string, interval_detik: number }|null, aktif: boolean, saatNonceKedaluwarsa?: () => void }} props
 */
function Percobaan({ denyut, aktif, saatNonceKedaluwarsa }) {
  useDenyutProteksi({ attemptId: 7, denyut, aktif, saatNonceKedaluwarsa })

  return <p>denyut</p>
}

beforeEach(() => {
  vi.useFakeTimers()
  denyutProteksi.mockReset()
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
  vi.useRealTimers()
})

describe('useDenyutProteksi', () => {
  it('tidak mengirim apa pun bila denyut null (proteksi mati)', async () => {
    act(() => root.render(<Percobaan denyut={null} aktif />))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000)
    })

    expect(denyutProteksi).not.toHaveBeenCalled()
  })

  it('tidak mengirim apa pun bila ulangan tidak berjalan', async () => {
    act(() => root.render(<Percobaan denyut={{ nonce: 'n1', interval_detik: 5 }} aktif={false} />))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000)
    })

    expect(denyutProteksi).not.toHaveBeenCalled()
  })

  it('mengirim nonce awal, lalu memakai nonce baru dari respons', async () => {
    denyutProteksi
      .mockResolvedValueOnce({ nonce: 'n2', interval_detik: 5 })
      .mockResolvedValueOnce({ nonce: 'n3', interval_detik: 5 })

    act(() => root.render(<Percobaan denyut={{ nonce: 'n1', interval_detik: 5 }} aktif />))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(denyutProteksi).toHaveBeenNthCalledWith(1, 7, 'n1')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    // Kiriman kedua memakai nonce hasil rotasi server, bukan yang lama.
    expect(denyutProteksi).toHaveBeenNthCalledWith(2, 7, 'n2')
  })

  it('memanggil saatNonceKedaluwarsa saat server menolak nonce (409)', async () => {
    denyutProteksi.mockRejectedValue({ response: { status: 409 } })
    const kedaluwarsa = vi.fn()

    act(() =>
      root.render(
        <Percobaan denyut={{ nonce: 'n1', interval_detik: 5 }} aktif saatNonceKedaluwarsa={kedaluwarsa} />,
      ),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(kedaluwarsa).toHaveBeenCalledTimes(1)
  })

  it('tidak melempar saat jaringan gagal (fail-open)', async () => {
    denyutProteksi.mockRejectedValue(new Error('jaringan mati'))
    const kedaluwarsa = vi.fn()

    act(() =>
      root.render(
        <Percobaan denyut={{ nonce: 'n1', interval_detik: 5 }} aktif saatNonceKedaluwarsa={kedaluwarsa} />,
      ),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    // Galat jaringan bukan tanda nonce kedaluwarsa.
    expect(kedaluwarsa).not.toHaveBeenCalled()
  })
})
