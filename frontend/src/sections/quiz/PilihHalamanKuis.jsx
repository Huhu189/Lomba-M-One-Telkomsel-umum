/**
 * Rute /kuis dipakai dua peran: guru mengelola, murid melihat daftar
 * ulangannya. Server tetap penentu akhir (bank soal guru tertutup bagi murid).
 */
import { useAuthStore } from '../auth/authStore.js'
import HalamanKuis from './HalamanKuis.jsx'
import HalamanKuisMurid from './HalamanKuisMurid.jsx'

export default function PilihHalamanKuis() {
  const user = useAuthStore((s) => s.user)
  const sebagaiGuru = user?.role === 'guru' || user?.role === 'admin'

  return sebagaiGuru ? <HalamanKuis /> : <HalamanKuisMurid />
}
