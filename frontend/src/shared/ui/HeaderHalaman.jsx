/**
 * Kepala halaman bersama (papan Standar, temuan 09): jejak, satu h1, deskripsi
 * satu baris, dan slot tombol utama di kanan. Semua halaman guru memakai ini
 * supaya judul, deskripsi, dan tindakan selalu ada di tempat yang sama.
 *
 * Halaman yang memakai komponen ini tidak boleh menulis <h1> sendiri lagi.
 */

/**
 * @param {{
 *   judul: string,
 *   deskripsi?: string,
 *   jejak?: import('react').ReactNode,
 *   children?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export default function HeaderHalaman({ judul, deskripsi, jejak, children, className = '' }) {
  return (
    <header className={`kepala-halaman ${className}`.trim()}>
      <div className="kepala-halaman-teks">
        {jejak && <span className="kepala-halaman-jejak">{jejak}</span>}
        <h1 className="judul-halaman">{judul}</h1>
        {deskripsi && <p className="kepala-halaman-deskripsi mb-0">{deskripsi}</p>}
      </div>
      {children && <div className="kepala-halaman-aksi">{children}</div>}
    </header>
  )
}
