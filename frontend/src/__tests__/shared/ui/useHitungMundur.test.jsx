// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useHitungMundur } from '../../../shared/ui/useHitungMundur.js'

/** @type {{ IS_REACT_ACT_ENVIRONMENT?: boolean }} */ (globalThis).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Nilai hook terakhir ditangkap dari effect (bukan saat render), supaya
 * komponen uji tetap murni dan lolos aturan react-hooks/globals.
 * @type {{ sisa: number, mulai: (detik: number) => void } | null}
 */
let api = null
function Uji() {
  const nilai = useHitungMundur()
  useEffect(() => {
    api = nilai
  }, [nilai])
  return <span>{nilai.sisa}</span>
}

/** @returns {{ sisa: number, mulai: (detik: number) => void }} */
function ambilApi() {
  if (api === null) throw new Error('hook belum terpasang')
  return api
}

describe('useHitungMundur', () => {
  /** @type {import('react-dom/client').Root} */
  let root
  beforeEach(() => {
    vi.useFakeTimers()
    root = createRoot(document.createElement('div'))
    act(() => root.render(<Uji />))
  })
  afterEach(() => {
    act(() => root.unmount())
    api = null
    vi.useRealTimers()
  })

  it('berkurang tiap detik dan berhenti di 0', () => {
    act(() => ambilApi().mulai(3))
    expect(ambilApi().sisa).toBe(3)
    act(() => vi.advanceTimersByTime(1000))
    expect(ambilApi().sisa).toBe(2)
    act(() => vi.advanceTimersByTime(5000))
    expect(ambilApi().sisa).toBe(0)
  })

  it('mulai ulang menimpa hitungan lama (tidak bertumpuk)', () => {
    act(() => ambilApi().mulai(10))
    act(() => vi.advanceTimersByTime(2000))
    act(() => ambilApi().mulai(5))
    act(() => vi.advanceTimersByTime(1000))
    expect(ambilApi().sisa).toBe(4)
  })

  it('mulai(0) atau negatif tidak menjalankan timer', () => {
    act(() => ambilApi().mulai(-4))
    expect(ambilApi().sisa).toBe(0)
  })
})
