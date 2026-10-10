/**
 * Keadaan data kosong (papan Standar, temuan 06): ikon, judul, satu kalimat
 * penjelasan, dan satu tombol tindakan utama — bukan hanya satu baris teks.
 *
 * Tindakan boleh dikosongkan bila halaman memang tidak punya langkah lanjutan
 * (mis. daftar hasil yang belum ada), tetapi kalau ada, taruh di prop `aksi`.
 */
import { IkonPapan } from '../../icons.jsx'

/**
 * @param {{
 *   judul: string,
 *   ikon?: import('react').ComponentType<{ size?: number, className?: string }>,
 *   children?: import('react').ReactNode,
 *   aksi?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export default function KosongData({ judul, ikon: Ikon = IkonPapan, children, aksi, className = '' }) {
  return (
    <div className={`kosong-data ${className}`.trim()}>
      <span className="kosong-data-ikon" aria-hidden="true">
        <Ikon size={30} />
      </span>
      <strong className="kosong-data-judul">{judul}</strong>
      {children && <p className="kosong-data-teks mb-0">{children}</p>}
      {aksi && <div className="d-flex flex-wrap gap-2 justify-content-center">{aksi}</div>}
    </div>
  )
}
