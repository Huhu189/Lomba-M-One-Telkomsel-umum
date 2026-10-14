/**
 * Kartu "halaman ini belum bisa diunduh".
 *
 * Dipakai `MalasHalaman` saat modul sebuah halaman gagal diunduh — paling sering
 * karena koneksi putus di tengah pelajaran, tepat ketika murid menekan menu yang
 * halamannya belum pernah ia buka.
 *
 * Nada pesannya sengaja menenangkan: yang gagal hanya **halaman baru**, bukan
 * pekerjaannya. Karena itu kartunya menyebut terus terang bahwa jawaban yang
 * sudah diisi tetap tersimpan di perangkat ini — dan menyediakan satu tombol yang
 * benar-benar mencoba mengunduh ulang.
 */
import Banner from './Banner.jsx'
import { Tombol } from './Tombol.jsx'

/** @param {{ onCobaLagi?: () => void }} props */
export default function GagalMuatHalaman({ onCobaLagi }) {
  return (
    <div className="kartu-soft p-4">
      <Banner jenis="peringatan" judul="Halaman ini belum bisa diunduh">
        <p className="mb-2">
          Koneksi ke server sedang putus, jadi halaman yang belum pernah kamu buka belum bisa dimuat.
          Ulangan yang sedang kamu kerjakan <strong>tetap tersimpan di perangkat ini</strong> — kembali ke
          halaman ulangan lewat menu untuk melanjutkan.
        </p>
        <p className="teks-lembut small mb-3">
          Halaman ini akan memuat sendiri begitu koneksi kembali, atau tekan tombol di bawah untuk mencoba
          sekarang.
        </p>
        <Tombol onClick={onCobaLagi}>Coba lagi</Tombol>
      </Banner>
    </div>
  )
}
