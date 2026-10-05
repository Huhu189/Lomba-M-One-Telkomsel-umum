/**
 * Kerangka aplikasi + router (slice 01: auth; slice 02: data induk + pengaturan).
 */
import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ToastHost, tampilkanToast } from './shared/ui/toast.jsx'
import { ambilHealth } from './shared/api/health.js'
import { RUTE } from './routes.js'
import HalamanMasuk from './sections/auth/HalamanMasuk.jsx'
import HalamanDaftar from './sections/auth/HalamanDaftar.jsx'
import HalamanLupaSandi from './sections/auth/HalamanLupaSandi.jsx'
import HalamanAturUlangSandi from './sections/auth/HalamanAturUlangSandi.jsx'
import HalamanVerifikasiEmail from './sections/auth/HalamanVerifikasiEmail.jsx'
import HalamanPerluVerifikasi from './sections/auth/HalamanPerluVerifikasi.jsx'
import HalamanKelas from './sections/school/HalamanKelas.jsx'
import HalamanMapel from './sections/school/HalamanMapel.jsx'
import HalamanMurid from './sections/school/HalamanMurid.jsx'
import HalamanImporMurid from './sections/school/HalamanImporMurid.jsx'
import HalamanPengaturan from './sections/settings/HalamanPengaturan.jsx'
import { pasangListenerSesi, useAuthStore } from './sections/auth/authStore.js'
import { IkonMatahari, IkonBulan } from './icons.jsx'

/** Halaman beranda: sambutan tamu / ringkas status murid yang masuk. */
function Beranda() {
  const user = useAuthStore((s) => s.user)
  const keluar = useAuthStore((s) => s.keluar)
  const navigate = useNavigate()

  const health = useQuery({
    queryKey: ['health'],
    queryFn: ambilHealth,
    refetchInterval: 30_000,
    retry: 1,
  })

  async function keluarSesi() {
    try {
      await keluar()
      tampilkanToast('info', 'Anda sudah keluar.')
      navigate(RUTE.masuk)
    } catch {
      tampilkanToast('salah', 'Gagal keluar. Coba lagi.')
    }
  }

  if (user) {
    return (
      <div className="row justify-content-center">
        <div className="col-lg-7">
          <div className="kartu-soft p-4 p-md-5">
            <h1 className="h4 fw-bold">Halo, {user.name}! 👋</h1>
            <p className="text-body-secondary">
              Kamu masuk sebagai <strong>{user.role}</strong> ({user.statusLabel}).
              {user.emailTerverifikasi ? ' Email sudah terverifikasi.' : ' Email belum terverifikasi.'}
            </p>
            <p className="text-body-secondary">
              Dashboard belajar lengkap menyusul di slice berikutnya.
            </p>
            <button type="button" className="btn btn-outline-primary" onClick={keluarSesi}>
              Keluar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <div className="kartu-soft p-4 p-md-5 h-100">
          <h1 className="h3 fw-bold">Selamat datang di Ulangan Sekolah</h1>
          <p className="text-body-secondary">
            Belajar dan ulangan online untuk murid SD. Masuk untuk mulai, atau buat akun
            baru — gratis untuk murid.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <NavLink className="btn btn-aksen px-4" to={RUTE.masuk}>
              Masuk
            </NavLink>
            <NavLink className="btn btn-outline-primary px-4" to={RUTE.daftar}>
              Daftar murid
            </NavLink>
          </div>
        </div>
      </div>
      <div className="col-lg-5">
        <div className="kartu-soft p-4 h-100">
          <h2 className="h6 fw-bold text-uppercase text-body-secondary">Status sistem</h2>
          {health.isError && (
            <p className="status-salah fw-semibold mb-0" role="alert">
              Backend tidak terjangkau.
            </p>
          )}
          {health.data && (
            <p className="mb-0">
              Backend <span className="status-benar fw-semibold">hidup</span> · Database{' '}
              {health.data.database ? (
                <span className="status-benar fw-semibold">terhubung</span>
              ) : (
                <span className="status-salah fw-semibold">terputus</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Menu data induk (hanya guru/admin). */
function MenuData() {
  return (
    <nav className="d-flex flex-wrap gap-3 small mb-3">
      <NavLink className="menu-data" to={RUTE.kelas}>Kelas</NavLink>
      <NavLink className="menu-data" to={RUTE.mapel}>Mapel</NavLink>
      <NavLink className="menu-data" to={RUTE.murid}>Murid</NavLink>
      <NavLink className="menu-data" to={RUTE.pengaturan}>Pengaturan</NavLink>
    </nav>
  )
}

/** Kerangka aplikasi: header + router. */
export default function App() {
  const [gelap, setGelap] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  // Listener sesi/throttle global sekali saja.
  useEffect(() => {
    pasangListenerSesi()

    const saatSesiHabis = () => tampilkanToast('info', 'Sesi berakhir. Silakan masuk lagi.')
    window.addEventListener('auth:sesi-habis', saatSesiHabis)
    return () => window.removeEventListener('auth:sesi-habis', saatSesiHabis)
  }, [])

  /**
   * Ganti mode terang/gelap lewat data-bs-theme.
   * @param {boolean} jadiGelap
   */
  function ubahTema(jadiGelap) {
    setGelap(jadiGelap)
    document.documentElement.setAttribute('data-bs-theme', jadiGelap ? 'dark' : 'light')
  }

  const isGuru = user?.role === 'guru' || user?.role === 'admin'

  return (
    <div className="container py-4">
      <ToastHost />

      <header className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <NavLink to={RUTE.beranda} className="navbar-brand fw-bold me-auto">
          Ulangan Sekolah
        </NavLink>
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={() => ubahTema(!gelap)}
          aria-label={gelap ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
        >
          {gelap ? <IkonMatahari label="Terang" /> : <IkonBulan label="Gelap" />}
        </button>
      </header>

      {isGuru && <MenuData />}

      <main>
        <Routes>
          <Route path={RUTE.beranda} element={<Beranda />} />
          <Route
            path={RUTE.masuk}
            element={
              <HalamanMasuk
                berhasil={() => navigate(RUTE.beranda, { replace: true })}
              />
            }
          />
          <Route
            path={RUTE.daftar}
            element={
              <HalamanDaftar
                berhasil={() => navigate(RUTE.perluVerifikasi, { replace: true })}
              />
            }
          />
          <Route path={RUTE.lupaSandi} element={<HalamanLupaSandi />} />
          <Route path={RUTE.aturUlangSandi} element={<HalamanAturUlangSandi />} />
          <Route path={RUTE.verifikasiEmail} element={<HalamanVerifikasiEmail />} />
          <Route path={RUTE.perluVerifikasi} element={<HalamanPerluVerifikasi />} />
          <Route path={RUTE.kelas} element={<HalamanKelas />} />
          <Route path={RUTE.mapel} element={<HalamanMapel />} />
          <Route path={RUTE.murid} element={<HalamanMurid />} />
          <Route path={RUTE.imporMurid} element={<HalamanImporMurid />} />
          <Route path={RUTE.pengaturan} element={<HalamanPengaturan />} />
          <Route path="*" element={<Beranda />} />
        </Routes>
      </main>

      <footer className="text-center text-body-secondary small mt-4">
        Slice 02 — Sekolah, Kelas, Mapel, Murid &amp; Pengaturan Tiga Lapis
      </footer>
    </div>
  )
}
