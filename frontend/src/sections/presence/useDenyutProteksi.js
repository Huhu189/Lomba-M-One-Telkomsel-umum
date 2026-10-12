/**
 * Denyut proteksi ber-nonce (2D).
 *
 * Server menerbitkan nonce saat kuis disajikan dengan proteksi menyala
 * (`denyut` di payload attempt). Hook ini mengirim denyut tiap
 * `interval_detik`, **membawa nonce terakhir**, lalu menyimpan nonce baru dari
 * respons. Kalau denyut berhenti (tab ditutup, sensor dimatikan, JS diblokir),
 * sapuan server akan mencatat `tamper_suspected` sebagai bahan tinjauan guru.
 *
 * Aturan yang dijaga:
 * - **tidak ada denyut** bila proteksi tidak menyala (`denyut === null`) atau
 *   ulangan sudah tidak berjalan — jadi tidak ada permintaan sia-sia;
 * - **fail-open**: denyut yang gagal tidak pernah mengganggu ulangan;
 * - nonce disimpan di ref, bukan state/dependensi efek, supaya pembaruan
 *   payload attempt (yang mengganti nonce) tidak menyetel ulang jeda denyut dan
 *   membuatnya tidak pernah sempat terkirim.
 */
import { useEffect, useRef } from 'react'
import { denyutProteksi } from '../attempt/api.js'

/**
 * @param {object} opsi
 * @param {number} opsi.attemptId
 * @param {{ nonce: string, interval_detik: number }|null|undefined} opsi.denyut
 * @param {boolean} opsi.aktif
 * @param {() => void} [opsi.saatNonceKedaluwarsa] dipanggil saat server menolak nonce (409)
 * @returns {void}
 */
export default function useDenyutProteksi(opsi) {
  const { attemptId, denyut, aktif, saatNonceKedaluwarsa } = opsi

  const nonceAwal = denyut?.nonce ?? null
  const interval = denyut?.interval_detik ?? 30

  /** @type {import('react').MutableRefObject<string|null>} */
  const nonceRef = useRef(nonceAwal)

  useEffect(() => {
    if (nonceAwal !== null) nonceRef.current = nonceAwal
  }, [nonceAwal])

  useEffect(() => {
    // Proteksi tidak menyala atau attempt tidak berjalan: tidak ada yang dijaga.
    if (!aktif || nonceRef.current === null) return undefined

    let batal = false

    const id = window.setInterval(() => {
      const nonce = nonceRef.current
      if (nonce === null) return

      void denyutProteksi(attemptId, nonce)
        .then((hasil) => {
          if (!batal) nonceRef.current = hasil.nonce
        })
        .catch((galat) => {
          // 409 = nonce tidak berlaku (halaman lama). Minta pemanggil memuat
          // ulang payload attempt supaya nonce segar; galat lain (jaringan)
          // dibiarkan — percobaan berikutnya menyusul.
          const status = /** @type {{ response?: { status?: number } }} */ (galat)?.response?.status

          if (!batal && status === 409) saatNonceKedaluwarsa?.()
        })
    }, Math.max(5, interval) * 1000)

    return () => {
      batal = true
      window.clearInterval(id)
    }
  }, [aktif, attemptId, interval, saatNonceKedaluwarsa])
}
