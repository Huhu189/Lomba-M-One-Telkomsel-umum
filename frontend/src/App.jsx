/**
 * Kerangka aplikasi + router.
 * - KerangkaAuth: halaman masuk/daftar/dll (panel + formulir).
 * - KerangkaUmum: beranda, data induk, dan halaman lain (header + footer).
 * Sesi dipulihkan saat dimuat agar refresh tidak "mengeluarkan" pengguna.
 */
import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { ToastHost, tampilkanToast } from './shared/ui/toast.jsx'
import KerangkaAuth from './shared/layout/KerangkaAuth.jsx'
import KerangkaUmum from './shared/layout/KerangkaUmum.jsx'
import { RUTE } from './routes.js'
import Beranda from './sections/home/Beranda.jsx'
import HalamanTidakDitemukan from './sections/home/HalamanTidakDitemukan.jsx'
import HalamanMasuk from './sections/auth/HalamanMasuk.jsx'
import HalamanDaftar from './sections/auth/HalamanDaftar.jsx'
import HalamanLupaSandi from './sections/auth/HalamanLupaSandi.jsx'
import HalamanAturUlangSandi from './sections/auth/HalamanAturUlangSandi.jsx'
import HalamanVerifikasiEmail from './sections/auth/HalamanVerifikasiEmail.jsx'
import HalamanPerluVerifikasi from './sections/auth/HalamanPerluVerifikasi.jsx'
import HalamanKelas from './sections/school/HalamanKelas.jsx'
import HalamanBankSoal from './sections/question/HalamanBankSoal.jsx'
import HalamanTag from './sections/question/HalamanTag.jsx'
import HalamanKuisDetail from './sections/quiz/HalamanKuisDetail.jsx'
import PilihHalamanKuis from './sections/quiz/PilihHalamanKuis.jsx'
import BatasGalatUlangan from './sections/attempt/BatasGalatUlangan.jsx'
import HalamanKerjakan from './sections/attempt/HalamanKerjakan.jsx'
import HalamanHasil from './sections/attempt/HalamanHasil.jsx'
import HalamanMapel from './sections/school/HalamanMapel.jsx'
import HalamanMurid from './sections/school/HalamanMurid.jsx'
import HalamanImporMurid from './sections/school/HalamanImporMurid.jsx'
import HalamanPengaturan from './sections/settings/HalamanPengaturan.jsx'
import HalamanPeringkat from './sections/report/HalamanPeringkat.jsx'
import HalamanLaporan from './sections/report/HalamanLaporan.jsx'
import HalamanBadge from './sections/report/HalamanBadge.jsx'
import HalamanProgresTema from './sections/report/HalamanProgresTema.jsx'
import { pasangListenerSesi, useAuthStore } from './sections/auth/authStore.js'

/** Layar tunggu singkat selama sesi diperiksa (mencegah kilatan tampilan tamu). */
function LayarMemuat() {
  return (
    <div className="d-flex min-vh-100 align-items-center justify-content-center text-center" role="status">
      <div>
        <span className="spinner-border text-primary" aria-hidden="true" />
        <p className="teks-lembut mt-3">Menyiapkan…</p>
      </div>
    </div>
  )
}

/** Halaman tamu saja (masuk/daftar/…): yang sudah masuk dialihkan ke beranda. */
function HanyaTamu() {
  const user = useAuthStore((s) => s.user)
  return user ? <Navigate to={RUTE.beranda} replace /> : <Outlet />
}

/**
 * Kerangka umum dengan gerbang verifikasi: akun yang sudah masuk tetapi belum
 * memverifikasi email diarahkan ke halaman verifikasi (fitur lain memang ditolak
 * server, jadi jangan biarkan murid menabrak dinding 403).
 */
function GerbangUmum() {
  const user = useAuthStore((s) => s.user)

  if (user && !user.emailTerverifikasi) {
    return <Navigate to={RUTE.perluVerifikasi} replace />
  }

  return <KerangkaUmum />
}

/** Halaman yang butuh sesi (beranda boleh dibuka tamu). */
function HanyaMasuk() {
  const user = useAuthStore((s) => s.user)

  return user ? <Outlet /> : <Navigate to={RUTE.masuk} replace />
}

/** Halaman data induk: hanya guru/admin (murid dialihkan ke beranda). */
function HanyaGuru() {
  const user = useAuthStore((s) => s.user)

  if (!user) return <Navigate to={RUTE.masuk} replace />

  const isGuru = user.role === 'guru' || user.role === 'admin'
  return isGuru ? <Outlet /> : <Navigate to={RUTE.beranda} replace />
}

/** Kerangka aplikasi: sesi, toast, dan router. */
export default function App() {
  const navigate = useNavigate()
  const sesiSiap = useAuthStore((s) => s.sesiSiap)
  const pulihkanSesi = useAuthStore((s) => s.pulihkanSesi)

  // Listener sesi/throttle global (idempoten) + pulihkan sesi dari cookie.
  useEffect(() => {
    pasangListenerSesi()
    void pulihkanSesi()

    const saatSesiHabis = () => tampilkanToast('info', 'Sesi berakhir. Silakan masuk lagi.')
    window.addEventListener('auth:sesi-habis', saatSesiHabis)
    return () => window.removeEventListener('auth:sesi-habis', saatSesiHabis)
  }, [pulihkanSesi])

  if (!sesiSiap) return <LayarMemuat />

  return (
    <>
      <ToastHost />
      <Routes>
        <Route element={<GerbangUmum />}>
          <Route path={RUTE.beranda} element={<Beranda />} />

          {/* Data induk (slice 02) — guru/admin. */}
          <Route element={<HanyaGuru />}>
            <Route path={RUTE.kelas} element={<HalamanKelas />} />
            <Route path={RUTE.mapel} element={<HalamanMapel />} />
            <Route path={RUTE.murid} element={<HalamanMurid />} />
            <Route path={RUTE.imporMurid} element={<HalamanImporMurid />} />
            <Route path={RUTE.pengaturan} element={<HalamanPengaturan />} />
            <Route path={RUTE.bankSoal} element={<HalamanBankSoal />} />
            <Route path={RUTE.tag} element={<HalamanTag />} />

            {/* Laporan per tema memuat data seluruh kelas — guru saja (slice 05). */}
            <Route path={RUTE.laporanKuis} element={<HalamanLaporan />} />
          </Route>

          {/* Kuis (slice 03) — guru mengelola, murid melihat daftar ulangannya. */}
          <Route element={<HanyaMasuk />}>
            <Route path={RUTE.kuis} element={<PilihHalamanKuis />} />
            <Route path={RUTE.kuisDetail} element={<HalamanKuisDetail />} />

            {/* Pengerjaan ulangan dibungkus pagar galat khusus (fail-open). */}
            <Route
              path={RUTE.kerjakanKuis}
              element={
                <BatasGalatUlangan>
                  <HalamanKerjakan />
                </BatasGalatUlangan>
              }
            />
            <Route path={RUTE.hasilAttempt} element={<HalamanHasil />} />

            {/* Peringkat, lencana, dan progres tema (slice 05). */}
            <Route path={RUTE.peringkatKuis} element={<HalamanPeringkat />} />
            <Route path={RUTE.badge} element={<HalamanBadge />} />
            <Route path={RUTE.progresTema} element={<HalamanProgresTema />} />
          </Route>

          <Route path="*" element={<HalamanTidakDitemukan />} />
        </Route>

        <Route element={<KerangkaAuth />}>
          <Route element={<HanyaTamu />}>
            <Route
              path={RUTE.masuk}
              element={<HalamanMasuk berhasil={() => navigate(RUTE.beranda, { replace: true })} />}
            />
            <Route
              path={RUTE.daftar}
              element={
                <HalamanDaftar
                  berhasil={(email) =>
                    navigate(RUTE.perluVerifikasi, { replace: true, state: { email } })
                  }
                />
              }
            />
            <Route path={RUTE.lupaSandi} element={<HalamanLupaSandi />} />
            <Route path={RUTE.aturUlangSandi} element={<HalamanAturUlangSandi />} />
          </Route>
          {/* Tautan dari email boleh dibuka siapa pun, termasuk yang sudah masuk. */}
          <Route path={RUTE.verifikasiEmail} element={<HalamanVerifikasiEmail />} />
          <Route path={RUTE.perluVerifikasi} element={<HalamanPerluVerifikasi />} />
        </Route>
      </Routes>
    </>
  )
}
