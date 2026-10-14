/**
 * Pembungkus rute malas: mengunduh modul halaman saat rutenya dibuka, dan
 * **tidak mematikan aplikasi** kalau unduhan itu gagal.
 *
 * Kenapa bukan `React.lazy` (yang dipakai sebelum ini): `lazy` menyimpan hasil
 * impornya untuk selamanya. Satu kegagalan — misalnya murid menekan menu
 * "Ulangan Saya" saat koneksinya putus, sehingga modul halaman itu belum pernah
 * terunduh — membuat rutenya menolak selamanya, dan kegagalannya naik sampai
 * batas galat aplikasi sehingga **seluruh aplikasi** berganti menjadi layar
 * "Ada yang tidak beres" — termasuk ulangan yang sedang dikerjakan murid.
 *
 * Pembungkus ini menyimpan keadaannya sendiri, jadi:
 *
 * - modul yang gagal hanya menampilkan kartu "belum bisa diunduh" **di dalam
 *   kerangka** — menu, sisi lain aplikasi, dan layar ulangan yang sudah terunduh
 *   tetap hidup (jawaban luring murid tetap di perangkatnya);
 * - tombol "Coba lagi" **benar-benar** mengunduh ulang modulnya (`resetErrorBoundary`
 *   pada `lazy` tidak bisa: hasil impornya sudah tersimpan, jadi galat yang sama
 *   langsung dilempar lagi);
 * - halaman itu memuat sendiri begitu peramban melaporkan koneksi kembali
 *   (`online`), tanpa murid harus tahu apa pun.
 *
 * Pemisahan bundel tetap terjaga: `pemuat` di `src/halaman.js` semuanya impor
 * dinamis, jadi tiap halaman tetap jadi berkasnya sendiri.
 */
import { useEffect, useState } from 'react'
import GagalMuatHalaman from './GagalMuatHalaman.jsx'
import MemuatHalaman from './MemuatHalaman.jsx'

/** @typedef {() => Promise<{ default: import('react').ElementType }>} PemuatModul */
/** @typedef {{ modul: import('react').ElementType } | { gagal: true }} Muatan */

/**
 * Bungkus satu pemuat modul jadi komponen rute yang tahan gagal unduh.
 *
 * Pemuatnya ditempelkan sebagai properti `pemuat` supaya tes bisa membuktikan
 * tiap halaman benar-benar diunduh terpisah (bukan ikut bundel awal, dan bukan
 * pemuat yang sama dipakai dua halaman karena salah tempel).
 *
 * Ditulis di berkas `.jsx` (bukan di `halaman.js`) karena membuat komponen di
 * sini butuh JSX, sedangkan `halaman.js` berkas `.js` tanpa JSX.
 *
 * Tipenya sengaja mempertahankan tipe komponen aslinya (`T`): `App.jsx` yang
 * merakit rutenya tetap tahu properti tiap halaman (mis. `berhasil` di halaman
 * daftar), persis seperti waktu masih memakai `React.lazy`.
 *
 * @template {import('react').ElementType} T
 * @param {() => Promise<{ default: T }>} pemuat
 * @returns {T & { pemuat: () => Promise<{ default: T }> }}
 */
export function malasHalaman(pemuat) {
  /** @param {Record<string, unknown>} props */
  const HalamanMalas = (props) => <MalasHalaman pemuat={pemuat} {...props} />

  return Object.assign(/** @type {T} */ (/** @type {unknown} */ (HalamanMalas)), { pemuat })
}

/**
 * @param {{
 *   pemuat: PemuatModul,
 *   penanda?: import('react').ReactNode,
 *   onCobaLagi?: () => void,
 *   [kunci: string]: unknown,
 * }} props
 */
export default function MalasHalaman({ pemuat, penanda, onCobaLagi, ...sisa }) {
  // Nomor percobaan: dinaikkan tombol "Coba lagi" dan event `online` untuk
  // memicu effect di bawah mengunduh ulang modulnya.
  const [percobaan, setPercobaan] = useState(0)
  // Muatan disimpan bersama nomor percobaannya: hasil lama yang tertinggal
  // otomatis terbaca sebagai "sedang memuat", jadi tidak perlu `setState` di
  // badan effect hanya untuk kembali ke keadaan memuat.
  const [muatan, setMuatan] = useState(
    /** @type {{ percobaan: number, isi: Muatan }|null} */ (null),
  )

  useEffect(() => {
    let batal = false

    pemuat()
      .then((modul) => {
        if (!batal) setMuatan({ percobaan, isi: { modul: modul.default } })
      })
      .catch(() => {
        // Termasuk kegagalan jaringan saat luring: bukan galat render, cukup
        // kartu "belum bisa diunduh" — jangan dilempar ke batas galat aplikasi.
        if (!batal) setMuatan({ percobaan, isi: { gagal: true } })
      })

    return () => {
      batal = true
    }
  }, [pemuat, percobaan])

  const isi = muatan !== null && muatan.percobaan === percobaan ? muatan.isi : null
  const gagal = isi !== null && 'gagal' in isi

  // Hanya saat gagal: koneksi kembali → unduh ulang sendiri.
  useEffect(() => {
    if (!gagal || typeof window === 'undefined') return undefined

    const saatDaring = () => setPercobaan((n) => n + 1)
    window.addEventListener('online', saatDaring)

    return () => window.removeEventListener('online', saatDaring)
  }, [gagal])

  if (isi !== null && !gagal) {
    const Halaman = isi.modul

    return <Halaman {...sisa} />
  }

  if (gagal) {
    return (
      <GagalMuatHalaman
        onCobaLagi={() => {
          onCobaLagi?.()
          setPercobaan((n) => n + 1)
        }}
      />
    )
  }

  return <>{penanda ?? <MemuatHalaman />}</>
}
