/**
 * Satu sistem tombol untuk seluruh aplikasi (papan Standar).
 *
 * Varian: 'utama' (aksen), 'tepi' (sekunder), 'bahaya' (aksi merusak),
 * 'teks' (tersier). Ukuran: bawaan 48 px, 'sedang' 44 px, 'besar' 56 px —
 * semua tetap di atas target sentuh 44 px anak SD.
 *
 * `TombolIkon` dipakai untuk kolom aksi tabel: ikon saja, persegi 44 px, dan
 * `label` wajib karena menjadi aria-label ("Hapus kelas 5A", bukan "Hapus").
 */
import { Link } from 'react-router-dom'
import { IkonMuatUlang } from '../../icons.jsx'

const kelasVarian = {
  utama: 'btn-aksen',
  tepi: 'btn-tepi',
  bahaya: 'btn-bahaya',
  teks: 'btn-teks',
}

/**
 * Susun daftar kelas tombol dari varian + ukuran.
 * @param {{
 *   varian?: 'utama'|'tepi'|'bahaya'|'teks',
 *   ukuran?: 'sedang'|'besar',
 *   besar?: boolean,
 *   lebar?: boolean,
 *   className?: string,
 * }} opsi
 * @returns {string}
 */
function kelasTombol({ varian = 'utama', ukuran, besar = false, lebar = false, className = '' }) {
  const ukuranTerpakai = ukuran ?? (besar ? 'besar' : undefined)
  return [
    'btn',
    kelasVarian[varian],
    ukuranTerpakai === 'sedang' ? 'btn-sedang' : '',
    ukuranTerpakai === 'besar' ? 'btn-besar' : '',
    lebar ? 'btn-lebar' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * @param {{
 *   varian?: 'utama'|'tepi'|'bahaya'|'teks',
 *   ukuran?: 'sedang'|'besar',
 *   memuat?: boolean,
 *   teksMemuat?: string,
 *   lebar?: boolean,
 *   besar?: boolean,
 *   ikon?: import('react').ComponentType<{ size?: number, className?: string }>,
 * } & import('react').ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function Tombol({
  varian = 'utama',
  ukuran,
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
  const kelas = kelasTombol({ varian, ukuran, besar, lebar, className })

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
 *   varian?: 'utama'|'tepi'|'bahaya'|'teks',
 *   ukuran?: 'sedang'|'besar',
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
  ukuran,
  lebar = false,
  besar = false,
  ikon: Ikon,
  className = '',
  children,
}) {
  const kelas = kelasTombol({ varian, ukuran, besar, lebar, className })

  return (
    <Link to={to} className={kelas}>
      {Ikon && <Ikon size={20} />}
      <span>{children}</span>
    </Link>
  )
}

/**
 * Tombol ikon persegi 44 px untuk kolom aksi tabel / kepala kartu.
 * `label` WAJIB dan menyebut objeknya, mis. "Hapus kelas 5A".
 * @param {{
 *   label: string,
 *   ikon: import('react').ComponentType<{ size?: number, className?: string }>,
 *   varian?: 'utama'|'tepi'|'bahaya'|'teks',
 *   memuat?: boolean,
 *   teksMemuat?: string,
 * } & import('react').ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function TombolIkon({
  label,
  ikon: Ikon,
  varian = 'tepi',
  memuat = false,
  teksMemuat = 'Sebentar…',
  className = '',
  disabled,
  title,
  type = 'button',
  ...sisa
}) {
  const kelas = kelasTombol({ varian, className: `btn-ikon ${className}`.trim() })

  return (
    <button
      type={type}
      className={kelas}
      aria-label={label}
      title={title ?? label}
      disabled={disabled || memuat}
      aria-busy={memuat || undefined}
      {...sisa}
    >
      {memuat ? <IkonMuatUlang size={20} className="putar" /> : <Ikon size={20} />}
      <span className="sr-saja">{memuat ? teksMemuat : label}</span>
    </button>
  )
}
