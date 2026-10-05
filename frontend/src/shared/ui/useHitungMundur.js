/**
 * Hitung mundur detik (untuk jeda kirim ulang). Hanya kenyamanan tampilan;
 * pembatasan sesungguhnya tetap di server (throttle).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * @param {number} [awal] detik awal (default 0 = tidak berjalan)
 * @returns {{ sisa: number, mulai: (detik: number) => void }}
 */
export function useHitungMundur(awal = 0) {
  const [sisa, setSisa] = useState(awal)
  const timer = useRef(/** @type {ReturnType<typeof setInterval>|null} */ (null))

  const bersihkan = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  const mulai = useCallback(
    (/** @type {number} */ detik) => {
      bersihkan()
      setSisa(Math.max(0, Math.floor(detik)))
      if (detik <= 0) return
      timer.current = setInterval(() => {
        setSisa((s) => {
          if (s <= 1) {
            bersihkan()
            return 0
          }
          return s - 1
        })
      }, 1000)
    },
    [bersihkan],
  )

  useEffect(() => bersihkan, [bersihkan])

  return { sisa, mulai }
}
