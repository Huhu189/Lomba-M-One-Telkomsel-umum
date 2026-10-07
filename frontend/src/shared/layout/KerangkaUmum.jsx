/**
 * Kerangka halaman umum: header (merek, akun, tema), konten, footer.
 * Status backend tampil kecil di footer — tidak memenuhi beranda.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { IkonKeluar } from '../../icons.jsx'
import { RUTE } from '../../routes.js'
import { useAuthStore } from '../../sections/auth/authStore.js'
import { ambilHealth } from '../api/health.js'
import { Tombol, TombolTaut } from '../ui/Tombol.jsx'
import { tampilkanToast } from '../ui/toast.jsx'
import Merek from './Merek.jsx'
import TombolTema from './TombolTema.jsx'

/**
 * Huruf awal nama untuk avatar.
 * @param {string} nama
 */
export function inisial(nama) {
  const huruf = nama.trim().split(/\s+/).slice(0, 2).map((k) => k.charAt(0).toUpperCase())
  return huruf.join('') || '?'
}

function StatusSistem() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ambilHealth,
    refetchInterval: 30_000,
    retry: 1,
  })

  if (health.isPending) return null
  const hidup = health.isSuccess && health.data.database

  return (
    <span className={`titik-status ${hidup ? 'hidup' : 'mati'}`} role="status">
      {hidup ? 'Server terhubung' : 'Server tidak terjangkau'}
    </span>
  )
}

export default function KerangkaUmum() {
  const user = useAuthStore((s) => s.user)
  const keluar = useAuthStore((s) => s.keluar)
  const navigate = useNavigate()

  async function keluarSesi() {
    try {
      await keluar()
      tampilkanToast('info', 'Kamu sudah keluar. Sampai jumpa!')
      navigate(RUTE.masuk)
    } catch {
      tampilkanToast('salah', 'Gagal keluar. Coba lagi.')
    }
  }

  return (
    <div className="kerangka">
      <a className="lompat-konten" href="#konten">
        Lompat ke konten
      </a>

      <header className="kepala-app">
        <div className="container kepala-app-isi">
          <span className="me-auto">
            <Merek />
          </span>

          {user ? (
            <div className="menu-pengguna">
              <span className="avatar-huruf d-none d-sm-inline-flex" aria-hidden="true">
                {inisial(user.name)}
              </span>
              <span className="d-none d-md-block lh-sm">
                <strong className="d-block">{user.name}</strong>
                <small className="teks-lembut text-capitalize">{user.role}</small>
              </span>
              <Tombol varian="tepi" ikon={IkonKeluar} onClick={keluarSesi} className="px-3">
                <span className="d-none d-sm-inline">Keluar</span>
                <span className="sr-saja d-sm-none">Keluar</span>
              </Tombol>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <TombolTaut to={RUTE.masuk} varian="tepi" className="d-none d-sm-inline-flex">
                Masuk
              </TombolTaut>
              <TombolTaut to={RUTE.daftar}>Daftar</TombolTaut>
            </div>
          )}
          <TombolTema />
        </div>
      </header>

      <main id="konten" className="badan-app" tabIndex={-1}>
        <div className="container">
          {user && (user.role === 'guru' || user.role === 'admin') ? (
            <nav className="papan-nav" aria-label="Menu guru">
              <NavLink className="papan-nav-taut" to={RUTE.kelas}>Kelas</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.mapel}>Mapel</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.murid}>Murid</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.bankSoal}>Bank Soal</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.tag}>Tag</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.kuis}>Kuis</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.materi}>Materi</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.avatar}>Moderasi Avatar</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.pengaturan}>Pengaturan</NavLink>
            </nav>
          ) : null}

          {user && user.role === 'murid' ? (
            <nav className="papan-nav" aria-label="Menu murid">
              <NavLink className="papan-nav-taut" to={RUTE.materi}>Materi</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.avatar}>Avatar</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.kuis}>Ulangan Saya</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.progresTema}>Progres Tema</NavLink>
              <NavLink className="papan-nav-taut" to={RUTE.badge}>Lencana</NavLink>
            </nav>
          ) : null}
          <Outlet />
        </div>
      </main>

      <footer className="kaki-app">
        <div className="container d-flex flex-wrap justify-content-between gap-2">
          <span>Ulangan Sekolah — platform ulangan online untuk murid SD</span>
          <StatusSistem />
        </div>
      </footer>
    </div>
  )
}
