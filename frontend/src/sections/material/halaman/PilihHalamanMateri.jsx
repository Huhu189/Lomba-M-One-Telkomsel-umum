/**
 * Rute /materi dipakai dua peran: guru menyusun materi, murid menempuhnya.
 * Server tetap penentu akhir (murid hanya boleh membuka materi terbit kelasnya).
 *
 * Sejak 15 Oktober 2026 rute ini juga menerima **tautan satu materi** —
 * `/materi/<id>`, alamat yang disalin tombol "Salin tautan materi" di editor:
 *
 * - **murid** membukanya dan langsung menempuh materi itu (id-nya diteruskan ke
 *   `HalamanMateriMurid`, yang juga memperbarui alamat saat murid memilih dari
 *   daftar — jadi tautannya selalu bisa dibagikan);
 * - **guru/admin** tidak perlu menempuh materinya, jadi dibawa ke **editornya**
 *   lewat pengalihan: tautan yang sama berguna untuk membagikan *dan* menyunting.
 */
import { Navigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/authStore.js'
import { ruteMateriEditor } from '../../../routes.js'
import HalamanMateri from './HalamanMateri.jsx'
import HalamanMateriMurid from './HalamanMateriMurid.jsx'

export default function PilihHalamanMateri() {
  const user = useAuthStore((s) => s.user)
  const { id } = useParams()
  const sebagaiGuru = user?.role === 'guru' || user?.role === 'admin'
  const idSah = /^\d+$/.test(String(id ?? '')) ? Number(id) : null

  if (sebagaiGuru) {
    return idSah === null ? <HalamanMateri /> : <Navigate to={ruteMateriEditor(idSah)} replace />
  }

  // `key` dari id tautan: membuka tautan materi lain mengganti komponennya,
  // bukan menimpa keadaan lama lewat efek — jadi murid selalu mulai dari materi
  // yang ada di alamatnya, tanpa pilihan materi sebelumnya yang tertinggal.
  return <HalamanMateriMurid key={idSah ?? 'daftar'} />
}
