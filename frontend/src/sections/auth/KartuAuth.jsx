/**
 * Kartu pembungkus semua halaman auth: ikon, judul (h1), subjudul, isi.
 * Mengatur judul tab browser dan memindahkan fokus ke h1 saat halaman dibuka
 * (pembaca layar langsung membacakan halaman baru; pengguna keyboard tidak
 * tertinggal di halaman sebelumnya).
 */
import { useEffect, useRef } from 'react'

/**
 * @param {{
 *   judul: string,
 *   sub?: import('react').ReactNode,
 *   ikon?: import('react').ComponentType<{ size?: number }>,
 *   tengah?: boolean,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function KartuAuth({ judul, sub, ikon: Ikon, tengah = false, children }) {
  const refJudul = useRef(/** @type {HTMLHeadingElement|null} */ (null))

  useEffect(() => {
    document.title = `${judul} — Ulangan Sekolah`
    refJudul.current?.focus({ preventScroll: true })
  }, [judul])

  return (
    <section className={`kartu-soft auth-kartu muncul ${tengah ? 'text-center' : ''}`}>
      {Ikon && (
        <span className="auth-ikon-judul">
          <Ikon size={28} />
        </span>
      )}
      <h1 className="auth-judul" ref={refJudul} tabIndex={-1}>
        {judul}
      </h1>
      {sub && <p className="auth-sub">{sub}</p>}
      {children}
    </section>
  )
}
