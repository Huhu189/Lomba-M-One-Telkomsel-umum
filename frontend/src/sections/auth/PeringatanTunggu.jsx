/**
 * Pemberitahuan jeda saat server membatasi percobaan (HTTP 429).
 * Hitung mundur datang dari store sesi (event auth:throttle).
 */
import Banner from '../../shared/ui/Banner.jsx'
import { useAuthStore } from './authStore.js'

export default function PeringatanTunggu() {
  const detik = useAuthStore((s) => s.detikTunggu)
  if (detik <= 0) return null

  return (
    <Banner jenis="peringatan" judul="Terlalu banyak percobaan">
      Istirahat dulu sebentar ya. Coba lagi dalam <strong>{detik} detik</strong>.
    </Banner>
  )
}
