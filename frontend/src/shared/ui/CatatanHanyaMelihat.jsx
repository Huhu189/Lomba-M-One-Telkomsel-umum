/**
 * Catatan kecil di halaman yang hanya bisa **dilihat** kepala sekolah.
 *
 * Tanpa catatan ini, halaman yang tampil tanpa tombol tambah/ubah/hapus terlihat
 * seperti aplikasi yang rusak — padahal tombolnya memang sengaja tidak ada karena
 * server akan menolaknya. Untuk peran lain komponen ini tidak menampilkan apa
 * pun, jadi halaman tidak perlu tahu peran penggunanya sendiri.
 */
import { useAuthStore } from '../../sections/auth/authStore.js'
import { hanyaMelihat } from '../akses.js'

/**
 * @param {{ children?: import('react').ReactNode }} props
 */
export default function CatatanHanyaMelihat({ children }) {
  const user = useAuthStore((s) => s.user)

  if (!hanyaMelihat(user)) return null

  return (
    <p className="catatan-hanya-melihat">
      <strong>Hanya melihat.</strong>{' '}
      {children ??
        'Menyusun dan mengubah ulangan, materi, serta data induk dikerjakan guru. Kepala sekolah memantau dan mengelola akun.'}
    </p>
  )
}
