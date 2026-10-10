/**
 * Kerangka halaman umum: header (merek, akun, tema), navigasi bagian, konten,
 * footer. Status backend tampil kecil di footer — tidak memenuhi beranda.
 *
 * Navigasi mengikuti papan desain: di layar lebar (≥ lg) menu guru tampil
 * sebagai panel samping indigo yang dikelompokkan (Ringkasan, Ujian, Data
 * induk, Belajar) — sembilan pil datar tanpa kelompok sulit dihafal (temuan
 * 07). Di layar sempit kelompok yang sama dipindah ke laci (drawer) yang dibuka
 * lewat tombol hamburger, lalu ditutup otomatis saat pindah halaman.
 *
 * Setiap menu punya ikon sendiri: Kuis memakai ikon lembar soal, Bank Soal
 * memakai ikon papan, jadi keduanya tidak lagi tampak sama.
 */
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  IkonBuku,
  IkonGrafik,
  IkonKeluar,
  IkonKisi,
  IkonLapis,
  IkonLembarSoal,
  IkonMenu,
  IkonPapan,
  IkonPengguna,
  IkonPerisai,
  IkonRumah,
  IkonSilang,
  IkonTanda,
  IkonBintang,
  IkonGear,
} from '../../icons.jsx'
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

/**
 * Satu tautan navigasi bagian (ikon + label).
 * @param {{
 *   to: string,
 *   ikon: import('react').ComponentType<{ size?: number, className?: string }>,
 *   children: import('react').ReactNode,
 *   className?: string,
 *   onClick?: () => void,
 * }} props
 */
function TautBagian({ to, ikon: Ikon, children, className = 'papan-nav-taut', onClick }) {
  return (
    <NavLink className={className} to={to} onClick={onClick}>
      <Ikon size={20} />
      <span>{children}</span>
    </NavLink>
  )
}

/**
 * @typedef {{ to: string, ikon: import('react').ComponentType<{ size?: number }>, label: string }} ItemMenu
 * @typedef {{ nama: string, item: ItemMenu[] }} GrupMenu
 */

/** Menu guru/admin, dikelompokkan seperti papan desain. */
const GRUP_GURU = /** @type {GrupMenu[]} */ ([
  {
    nama: 'Ringkasan',
    item: [{ to: RUTE.beranda, ikon: IkonRumah, label: 'Beranda' }],
  },
  {
    nama: 'Ujian',
    item: [
      { to: RUTE.kuis, ikon: IkonLembarSoal, label: 'Kuis' },
      { to: RUTE.bankSoal, ikon: IkonPapan, label: 'Bank Soal' },
      { to: RUTE.tag, ikon: IkonTanda, label: 'Tag Soal' },
    ],
  },
  {
    nama: 'Data induk',
    item: [
      { to: RUTE.kelas, ikon: IkonKisi, label: 'Kelas' },
      { to: RUTE.mapel, ikon: IkonLapis, label: 'Mapel' },
      { to: RUTE.murid, ikon: IkonPengguna, label: 'Murid' },
    ],
  },
  {
    nama: 'Belajar',
    item: [
      { to: RUTE.materi, ikon: IkonBuku, label: 'Materi' },
      { to: RUTE.avatar, ikon: IkonPerisai, label: 'Moderasi Avatar' },
      { to: RUTE.pengaturan, ikon: IkonGear, label: 'Pengaturan' },
    ],
  },
])

/** Menu murid — lebih ringkas, tanpa alat guru. */
const GRUP_MURID = /** @type {GrupMenu[]} */ ([
  {
    nama: 'Ulangan',
    item: [
      { to: RUTE.materi, ikon: IkonBuku, label: 'Materi' },
      { to: RUTE.avatar, ikon: IkonPerisai, label: 'Avatar' },
      { to: RUTE.kuis, ikon: IkonLembarSoal, label: 'Ulangan Saya' },
      { to: RUTE.progresTema, ikon: IkonGrafik, label: 'Progres Tema' },
      { to: RUTE.badge, ikon: IkonBintang, label: 'Lencana' },
    ],
  },
])

/**
 * Daftar menu berkelompok (dipakai panel samping dan laci).
 * @param {{ grup: GrupMenu[], kelasTaut: string, onKlik?: () => void }} props
 */
function DaftarMenu({ grup, kelasTaut, onKlik }) {
  return (
    <>
      {grup.map((satuGrup) => (
        <div className="papan-grup" key={satuGrup.nama}>
          <p className="papan-grup-judul">{satuGrup.nama}</p>
          {satuGrup.item.map((menu) => (
            <TautBagian key={menu.to} to={menu.to} ikon={menu.ikon} className={kelasTaut} onClick={onKlik}>
              {menu.label}
            </TautBagian>
          ))}
        </div>
      ))}
    </>
  )
}

export default function KerangkaUmum() {
  const user = useAuthStore((s) => s.user)
  const keluar = useAuthStore((s) => s.keluar)
  const navigate = useNavigate()
  const [laci, setLaci] = useState(false)

  // Kunci gulir latar selama laci terbuka (layar kecil).
  useEffect(() => {
    if (!laci) return undefined
    const sebelumnya = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = sebelumnya
    }
  }, [laci])

  useEffect(() => {
    if (!laci) return undefined
    /** @param {KeyboardEvent} e */
    const tekan = (e) => {
      if (e.key === 'Escape') setLaci(false)
    }
    window.addEventListener('keydown', tekan)
    return () => window.removeEventListener('keydown', tekan)
  }, [laci])

  const grup = !user ? [] : user.role === 'murid' ? GRUP_MURID : GRUP_GURU
  const adaMenu = grup.length > 0

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

          {adaMenu && (
            <button
              type="button"
              className="tombol-menu d-lg-none"
              aria-label={laci ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={laci}
              aria-controls="laci-navigasi"
              onClick={() => setLaci((satu) => !satu)}
            >
              {laci ? <IkonSilang size={22} /> : <IkonMenu size={22} />}
            </button>
          )}
        </div>
      </header>

      <div className={adaMenu ? 'kerangka-badan kerangka-badan-menu' : 'kerangka-badan'}>
        {adaMenu && (
          <nav className="papan-nav d-none d-lg-flex" aria-label="Menu bagian">
            <DaftarMenu grup={grup} kelasTaut="papan-nav-taut" />
          </nav>
        )}

        <div className="kerangka-isi">
          <main id="konten" className="badan-app" tabIndex={-1}>
            <div className="container">
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
      </div>

      {adaMenu && laci && (
        <>
          <div className="laci-overlay" onClick={() => setLaci(false)} aria-hidden="true" />
          <aside id="laci-navigasi" className="laci-nav" aria-label="Menu navigasi">
            <div className="laci-nav-kepala">
              <span className="fw-bold">Menu</span>
              <button
                type="button"
                className="tombol-ikon"
                aria-label="Tutup menu"
                onClick={() => setLaci(false)}
              >
                <IkonSilang size={22} />
              </button>
            </div>
            <nav className="laci-nav-daftar">
              <DaftarMenu grup={grup} kelasTaut="laci-nav-taut" onKlik={() => setLaci(false)} />
            </nav>
          </aside>
        </>
      )}
    </div>
  )
}
