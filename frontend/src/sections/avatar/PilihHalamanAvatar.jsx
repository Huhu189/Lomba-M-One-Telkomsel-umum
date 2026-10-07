/**
 * Rute /avatar dipakai dua peran: murid mengurus avatarnya sendiri, guru
 * meninjau laporan. Server tetap penentu akhir (policy), pemilihan di sini hanya
 * soal tampilan.
 */
import { useAuthStore } from '../auth/authStore.js'
import HalamanAvatar from './HalamanAvatar.jsx'
import HalamanModerasiAvatar from './HalamanModerasiAvatar.jsx'

export default function PilihHalamanAvatar() {
  const user = useAuthStore((s) => s.user)
  const sebagaiGuru = user?.role === 'guru' || user?.role === 'admin'

  return sebagaiGuru ? <HalamanModerasiAvatar /> : <HalamanAvatar />
}
