// @vitest-environment jsdom
/**
 * Sasaran ketuk & penggeser garis bilangan (14 Oktober 2026, temuan M3).
 *
 * Dulu yang bisa disentuh hanya garis tipis 24 unit + lingkaran jari-jari 5;
 * di HP (skala ±0,53) itu sasaran setinggi ±13 px — jauh di bawah target 44 px
 * yang dipegang aplikasi di tempat lain, dan anak sering salah mengetuk titik
 * tetangga. Kini tiap titik punya kotak sasaran bening setinggi bidang garis,
 * dan ada penggeser sebagai jalur kedua untuk garis yang padat.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SoalGarisBilangan from '../../../sections/question/render/SoalGarisBilangan.jsx'

const glob = /** @type {Record<string, unknown>} */ (globalThis)
glob.IS_REACT_ACT_ENVIRONMENT = true

const konten = { teks: 'Tandai angka 4.', min: 0, max: 10, langkah: 1 }

/** @type {HTMLElement} */
let wadah
/** @type {import('react-dom/client').Root} */
let root
/** @type {number|null} */
let terkirim = null

function pasang() {
  act(() => {
    root.render(
      <SoalGarisBilangan
        konten={konten}
        onUbah={(nilai) => (terkirim = /** @type {number} */ (nilai))}
      />,
    )
  })
}

beforeEach(() => {
  terkirim = null
  wadah = document.createElement('div')
  document.body.appendChild(wadah)
  root = createRoot(wadah)
})

afterEach(() => {
  act(() => root.unmount())
  wadah.remove()
})

describe('SoalGarisBilangan — sasaran jari', () => {
  it('setiap titik punya kotak sasaran bening setinggi bidang garis', () => {
    pasang()

    const sasaran = [...wadah.querySelectorAll('[data-sasaran]')]

    expect(sasaran).toHaveLength(11)

    for (const satu of sasaran) {
      const tinggi = Number(satu.getAttribute('height'))

      // 130 unit viewBox × skala ±0,53 di layar 340 px ≈ 69 px — di atas 44 px.
      expect(tinggi).toBe(130)
      expect(Number(satu.getAttribute('width'))).toBeGreaterThan(10)
      expect(satu.getAttribute('fill')).toBe('transparent')
    }
  })

  it('penggeser tersedia dan mengunci ke titik terdekat', () => {
    pasang()

    const geser = /** @type {HTMLInputElement} */ (wadah.querySelector('input[type="range"]'))

    expect(geser).not.toBeNull()
    expect(geser.max).toBe('10')

    // Nilai diisi lewat setter asli lalu event `input` dikirim: cara itulah yang
    // dikenali pelacak nilai React (menulis `geser.value` langsung tidak).
    act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
        geser,
        '4',
      )
      geser.dispatchEvent(new window.Event('input', { bubbles: true }))
    })

    expect(terkirim).toBe(4)
  })

  it('titik yang sudah ditandai dikenali dari jawaban lama', () => {
    act(() => {
      root.render(<SoalGarisBilangan konten={konten} nilai={4} />)
    })

    expect(wadah.textContent).toContain('Ditandai: 4')

    const geser = /** @type {HTMLInputElement} */ (wadah.querySelector('input[type="range"]'))

    expect(geser.value).toBe('4')
  })
})
