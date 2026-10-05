/**
 * Tombol dengan keadaan memuat (spinner + teks pengganti) dan varian.
 * Varian: 'utama' (aksen timbul), 'tepi' (sekunder), 'teks' (tersier).
 */
import { Link } from 'react-router-dom'
import { IkonMuatUlang } from '../../icons.jsx'

const kelasVarian = {
  utama: 'btn-aksen',
  tepi: 'btn-tepi',
  teks: 'btn-teks',
}

/**
 * @param {{
 *   varian?: 'utama'|'tepi'|'teks',
 *   memuat?: boolean,
 *   teksMemuat?: string,
 *   lebar?: boolean,
 *   besar?: boolean,
 *   ikon?: import('react').ComponentType<{ size?: number, className?: string }>,
 * } & import('react').ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function Tombol({
  varian = 'utama',
  memuat = false,
  teksMemuat = 'Sebentar…',
  lebar = false,
  besar = false,
  ikon: Ikon,
  className = '',
  disabled,
  children,
  type = 'button',
  ...sisa
}) {
  const kelas = [
    'btn',
    kelasVarian[varian],
    lebar ? 'btn-lebar' : '',
    besar ? 'btn-besar' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={kelas}
      disabled={disabled || memuat}
      aria-busy={memuat || undefined}
      {...sisa}
    >
      {memuat ? <IkonMuatUlang size={20} className="putar" /> : Ikon && <Ikon size={20} />}
      <span>{memuat ? teksMemuat : children}</span>
    </button>
  )
}

/**
 * Tautan bergaya tombol (navigasi internal).
 * @param {{
 *   to: string,
 *   varian?: 'utama'|'tepi'|'teks',
 *   lebar?: boolean,
 *   besar?: boolean,
 *   ikon?: import('react').ComponentType<{ size?: number, className?: string }>,
 *   className?: string,
 *   children: import('react').ReactNode,
 * }} props
 */
export function TombolTaut({
  to,
  varian = 'utama',
  lebar = false,
  besar = false,
  ikon: Ikon,
  className = '',
  children,
}) {
  const kelas = [
    'btn',
    kelasVarian[varian],
    lebar ? 'btn-lebar' : '',
    besar ? 'btn-besar' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Link to={to} className={kelas}>
      {Ikon && <Ikon size={20} />}
      <span>{children}</span>
    </Link>
  )
}
