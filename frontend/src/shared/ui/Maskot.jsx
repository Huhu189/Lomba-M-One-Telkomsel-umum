/**
 * Ilustrasi SVG buatan sendiri (bentuk sederhana, tanpa karakter bermerk).
 * Semua warna lewat kelas .il-* di theme.css (variabel CSS, tanpa hex).
 *
 * Catatan revisi: karakter maskot buku DIHAPUS atas permintaan pengguna
 * (menghindari UI generik/bermasalah hak cipta). Halaman kini memakai ikon
 * dari icons.jsx atau ilustrasi netral di berkas ini.
 */

/**
 * Ilustrasi amplop untuk halaman verifikasi / cek email.
 * @param {{ ukuran?: number, className?: string }} props
 */
export function IlustrasiSurat({ ukuran = 160, className = '' }) {
  return (
    <svg
      viewBox="0 0 200 150"
      width={ukuran}
      height={(ukuran * 150) / 200}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="100" cy="138" rx="64" ry="7" className="il-bayang" />
      <rect x="22" y="34" width="156" height="98" rx="14" className="il-pendukung il-garis" />
      <path d="M30 44l62 46a14 14 0 0 0 16 0l62-46" className="il-kertas il-garis" />
      <path d="M26 124l52-40M174 124l-52-40" className="il-garis-halus" />
      <circle cx="152" cy="36" r="22" className="il-hangat il-garis" />
      <path d="m141 36 8 8 14-16" className="il-garis-halus" />
    </svg>
  )
}

/**
 * Hiasan latar bulat-bulat untuk panel navy (dekoratif).
 * @param {{ className?: string }} props
 */
export function HiasanLatar({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="360" cy="60" r="120" className="il-bulat" />
      <circle cx="30" cy="330" r="90" className="il-bulat" />
      <circle cx="300" cy="540" r="150" className="il-bulat" />
    </svg>
  )
}
