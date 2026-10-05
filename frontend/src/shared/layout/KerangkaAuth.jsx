/**
 * Kerangka halaman auth: panel navy (merek, maskot, nilai jual) + area formulir.
 * Di HP panel menyusut jadi pita atas dan kartu formulir menimpanya sedikit.
 */
import { Outlet } from 'react-router-dom'
import { IkonJam, IkonPerisai, IkonBintang } from '../../icons.jsx'
import { HiasanLatar, MaskotBuku } from '../ui/Maskot.jsx'
import Merek from './Merek.jsx'
import TombolTema from './TombolTema.jsx'

const poin = [
  { Ikon: IkonBintang, judul: 'Soal besar dan jelas', isi: 'Huruf dan tombol dibuat nyaman untuk mata anak SD.' },
  { Ikon: IkonJam, judul: 'Waktu terlihat', isi: 'Murid selalu tahu sisa waktu mengerjakan.' },
  { Ikon: IkonPerisai, judul: 'Adil dan aman', isi: 'Penilaian dihitung di server, bukan di perangkat.' },
]

export default function KerangkaAuth() {
  return (
    <div className="auth">
      <a className="lompat-konten" href="#konten">
        Lompat ke konten
      </a>

      <aside className="auth-panel">
        <HiasanLatar className="auth-panel-hias" />
        <div className="d-flex align-items-center justify-content-between position-relative">
          <Merek />
          <TombolTema className="tema-mobile" />
        </div>

        <div className="auth-panel-tengah position-relative">
          <MaskotBuku ukuran={200} melayang className="mb-3" />
          <h2 className="h2 fw-bold mb-3">Belajar dan ulangan jadi lebih tenang.</h2>
          <ul className="auth-poin">
            {poin.map(({ Ikon, judul, isi }) => (
              <li key={judul}>
                <span className="auth-poin-ikon">
                  <Ikon size={20} />
                </span>
                <span>
                  <strong>{judul}</strong>
                  {isi}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-panel-bawah position-relative mb-0">
          Platform ulangan online untuk murid SD.
        </p>
      </aside>

      <TombolTema className="auth-tema-desktop" />

      <main id="konten" className="auth-isi" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
