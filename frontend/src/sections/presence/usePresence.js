/**
 * Presence hemat data (slice 07).
 *
 * Aturan dari chunk: klien **tidak** mengirim detak jantung terus-menerus.
 * Kehadiran diperbarui server setiap kali murid melakukan aktivitas normal
 * (memuat attempt, menyimpan jawaban). Hook ini hanya menambal celahnya:
 * satu ping kecil bila 15 detik berlalu tanpa request lain, dan satu
 * `sendBeacon` saat halaman ditinggalkan.
 *
 * Fail-open: ping yang gagal tidak pernah mengganggu ulangan.
 */
import { useEffect } from 'react'
import { pingKehadiran } from '../attempt/api.js'

/** Setelah sekian detik tanpa aktivitas lain, baru kirim ping (detik). */
export const JEDA_PING_DETIK = 15

/**
 * @param {{ attemptId: number, aktif: boolean, jam?: () => number }} opsi
 * @returns {void}
 */
export default function usePresence(opsi) {
  const { attemptId, aktif, jam = () => Date.now() } = opsi

  useEffect(() => {
    if (!aktif) return undefined

    let terakhirAktif = jam()
    let pingTerakhir = 0

    // Aktivitas apa pun berarti presence sudah diperbarui server; ping bisa
    // ditunda lagi.
    const tandaiAktif = () => {
      terakhirAktif = jam()
    }

    const id = window.setInterval(() => {
      const sekarang = jam()

      if (sekarang - terakhirAktif < JEDA_PING_DETIK * 1000) return
      if (sekarang - pingTerakhir < JEDA_PING_DETIK * 1000) return

      pingTerakhir = sekarang
      terakhirAktif = sekarang

      void pingKehadiran(attemptId).catch(() => {
        // diamkan: kehadiran bukan hal yang boleh mengganggu ulangan
      })
    }, 5000)

    const jenis = ['keydown', 'pointerdown', 'input']
    for (const satu of jenis) {
      window.addEventListener(satu, tandaiAktif, { passive: true })
    }

    // Saat murid menutup tab / pindah halaman, cookie sesi masih berlaku:
    // sendBeacon mengirim ping terakhir tanpa menunggu respons.
    const tanganiKeluar = () => {
      try {
        // Jalur API tidak memakai middleware CSRF web, jadi beacon tanpa header
        // tetap diterima; cookie sesi ikut terkirim karena satu origin.
        const data = new Blob([JSON.stringify({})], { type: 'application/json' })
        navigator.sendBeacon?.(`/api/v1/attempt/${attemptId}/hadir`, data)
      } catch {
        // abaikan
      }
    }

    window.addEventListener('pagehide', tanganiKeluar)

    return () => {
      window.clearInterval(id)
      for (const satu of jenis) {
        window.removeEventListener(satu, tandaiAktif)
      }
      window.removeEventListener('pagehide', tanganiKeluar)
    }
  }, [attemptId, aktif, jam])
}
