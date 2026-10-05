/** Logo + nama aplikasi (tautan ke beranda). */
import { Link } from 'react-router-dom'
import { IkonBuku } from '../../icons.jsx'
import { RUTE } from '../../routes.js'

export default function Merek() {
  return (
    <Link to={RUTE.beranda} className="merek" aria-label="Ulangan Sekolah — ke beranda">
      <span className="logo-tanda">
        <IkonBuku size={22} label="" />
      </span>
      <span className="merek-teks">Ulangan Sekolah</span>
    </Link>
  )
}
