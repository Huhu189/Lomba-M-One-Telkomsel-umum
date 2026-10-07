/**
 * Rute /materi dipakai dua peran: guru menyusun materi, murid menempuhnya.
 * Server tetap penentu akhir (murid hanya boleh membuka materi terbit kelasnya).
 */
import { useAuthStore } from '../auth/authStore.js'
import HalamanMateri from './HalamanMateri.jsx'
import HalamanMateriMurid from './HalamanMateriMurid.jsx'

export default function PilihHalamanMateri() {
  const user = useAuthStore((s) => s.user)
  const sebagaiGuru = user?.role === 'guru' || user?.role === 'admin'

  return sebagaiGuru ? <HalamanMateri /> : <HalamanMateriMurid />
}
