/**
 * Halaman Perlu verifikasi — ditampilkan setelah daftar / dari tautan di
 * halaman masuk. Email diteruskan lewat router state (divalidasi Zod); bila
 * tidak ada (buka langsung), murid mengetik emailnya.
 */
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { skemaEmail } from './validasi.js'
import { useAuthStore } from './authStore.js'
import Langkah from '../../shared/ui/Langkah.jsx'
import { IlustrasiSurat } from '../../shared/ui/Maskot.jsx'
import { Tombol, TombolTaut } from '../../shared/ui/Tombol.jsx'
import { IkonPanahKiri } from '../../icons.jsx'
import { RUTE } from '../../routes.js'
import KartuAuth from './KartuAuth.jsx'
import KirimUlangVerifikasi from './KirimUlangVerifikasi.jsx'

export default function HalamanPerluVerifikasi() {
  const lokasi = useLocation()
  const navigate = useNavigate()
  const emailSesi = useAuthStore((s) => s.user?.email ?? '')
  const keluar = useAuthStore((s) => s.keluar)

  const dariState = skemaEmail.safeParse(
    /** @type {{ email?: unknown }|null} */ (lokasi.state)?.email ?? '',
  )
  const email = dariState.success ? dariState.data : emailSesi
  // Baru daftar: server baru saja mengirim email, beri jeda sebelum kirim ulang.
  const baruDaftar = dariState.success

  return (
    <KartuAuth judul="Satu langkah lagi!" tengah>
      <Langkah langkah={['Daftar', 'Cek email', 'Aktif']} sekarang={1} />
      <IlustrasiSurat className="mb-3" />

      {email ? (
        <p>
          Kami mengirim tautan aktivasi ke <strong className="text-break">{email}</strong>. Buka
          emailnya, lalu tekan tautan di dalamnya.
        </p>
      ) : (
        <p>
          Buka tautan aktivasi yang kami kirim ke emailmu. Belum menerima? Masukkan email akunmu
          di bawah.
        </p>
      )}
      <p className="teks-lembut small mb-4">Tidak ketemu? Lihat juga folder spam.</p>

      <div className="text-start">
        <KirimUlangVerifikasi emailAwal={email} jedaAwal={baruDaftar ? 30 : 0} />
      </div>

      {emailSesi !== '' ? (
        <p className="small teks-lembut mt-3 mb-0">
          Kamu sudah masuk sebagai <strong className="text-break">{emailSesi}</strong>.
        </p>
      ) : (
        <div className="d-grid mt-3">
          <TombolTaut to={RUTE.masuk} varian="teks" ikon={IkonPanahKiri}>
            Kembali ke halaman masuk
          </TombolTaut>
        </div>
      )}

      {emailSesi !== '' && (
        <div className="d-grid mt-2">
          <Tombol
            varian="teks"
            ikon={IkonPanahKiri}
            onClick={async () => {
              await keluar()
              navigate(RUTE.masuk, { replace: true })
            }}
          >
            Keluar dari akun ini
          </Tombol>
        </div>
      )}
      {email && (
        <p className="small teks-lembut mt-2 mb-0">
          Salah email? <Link to={RUTE.daftar}>Daftar ulang</Link>
        </p>
      )}
    </KartuAuth>
  )
}
