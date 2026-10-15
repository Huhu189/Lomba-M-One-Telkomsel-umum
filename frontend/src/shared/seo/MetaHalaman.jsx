/**
 * Pemasang meta per halaman.
 *
 * Kenapa komponen, bukan panggilan di `router.subscribe`: `useLocation`-nya
 * Router yang menjadi satu-satunya sumber jalur aktif — termasuk saat pengguna
 * menekan tombol back — sehingga meta tidak mungkin tertinggal di halaman
 * sebelumnya. Isinya sendiri hanya efek: tidak merender apa pun.
 *
 * Dipasang **sekali** di `App.jsx`, bukan di tiap halaman: dulu lima halaman
 * menulis `document.title` sendiri-sendiri (beranda, 404, kartu auth, dasbor
 * admin, kelola akun sekolah), dan halaman lain tidak menulis sama sekali
 * sehingga judulnya tertinggal dari halaman sebelumnya.
 */
import { useEffect } from 'react'
import { pasangMeta } from './meta.js'

/**
 * @param {{ jalur: string }} props jalur aktif (`location.pathname`)
 */
export default function MetaHalaman({ jalur }) {
  useEffect(() => {
    pasangMeta(jalur)
  }, [jalur])

  return null
}
