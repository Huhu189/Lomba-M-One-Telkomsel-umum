// @vitest-environment jsdom
/**
 * Navigator soal (papan 4): status tiap nomor harus terbaca tanpa warna, dan
 * nomor yang sedang dibuka ditandai aria-current="step".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import NavigatorSoal from '../../../shared/ui/NavigatorSoal.jsx'

/** @type {{ IS_REACT_ACT_ENVIRONMENT?: boolean }} */ (globalThis).IS_REACT_ACT_ENVIRONMENT = true

const soal = [
  { id: 11, nomor: 1 },
  { id: 12, nomor: 2 },
  { id: 13, nomor: 3 },
  { id: 14, nomor: 4 },
]

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

/** @param {{ jawaban?: Record<string, unknown>, ragu?: Record<string, boolean>, aktif?: number, onPilih?: (i: number) => void }} opsi */
function pasang({ jawaban = { 11: 'a' }, ragu = { 13: true }, aktif = 2, onPilih = () => {} } = {}) {
  act(() => {
    root.render(
      <NavigatorSoal soal={soal} jawaban={jawaban} ragu={ragu} aktif={aktif} onPilih={onPilih} />,
    )
  })
}

/** @param {number} nomor @returns {HTMLElement|null} */
function tombolNomor(nomor) {
  return /** @type {HTMLElement|null} */ (
    wadah.querySelector(`button[aria-label^="Soal ${nomor},"]`)
  )
}

describe('NavigatorSoal', () => {
  it('menyebut nomor dan statusnya, jadi status tidak bergantung pada warna', () => {
    pasang()
    expect(tombolNomor(1)?.getAttribute('aria-label')).toBe('Soal 1, sudah dijawab')
    expect(tombolNomor(3)?.getAttribute('aria-label')).toBe('Soal 3, ragu-ragu')
    expect(tombolNomor(2)?.getAttribute('aria-label')).toBe('Soal 2, belum dijawab')
  })

  it('memakai kelas status dan menandai soal aktif dengan aria-current=step', () => {
    pasang({ aktif: 3 })
    expect(tombolNomor(1)?.className).toContain('dijawab')
    expect(tombolNomor(3)?.className).toContain('ragu')
    expect(tombolNomor(4)?.getAttribute('aria-current')).toBe('step')
    expect(tombolNomor(1)?.hasAttribute('aria-current')).toBe(false)
  })

  it('menekan nomor memanggil onPilih dengan indeksnya', () => {
    const onPilih = vi.fn()
    pasang({ onPilih })

    act(() => tombolNomor(3)?.click())
    expect(onPilih).toHaveBeenCalledWith(2)
  })

  it('punya legenda berisi teks ketiga keadaan', () => {
    pasang()
    const legenda = wadah.querySelector('.navigator-legenda')
    expect(legenda?.textContent).toContain('Sudah dijawab')
    expect(legenda?.textContent).toContain('Ragu-ragu')
    expect(legenda?.textContent).toContain('Belum dijawab')
  })

  it('kisi diberi label supaya terbaca sebagai satu kelompok', () => {
    pasang()
    expect(wadah.querySelector('[role="group"][aria-label="Daftar soal"]')).not.toBeNull()
  })
})
