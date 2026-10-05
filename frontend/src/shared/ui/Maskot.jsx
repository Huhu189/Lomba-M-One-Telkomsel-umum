/**
 * Maskot "Buku" dan ilustrasi — SVG buatan sendiri (karakter orisinal).
 * Semua warna lewat kelas .il-* di theme.css (variabel CSS, tanpa hex).
 */

/**
 * Mulut sesuai suasana.
 * @param {{ suasana: 'senang'|'sedih'|'kaget'|'tenang' }} props
 */
function Mulut({ suasana }) {
  switch (suasana) {
    case 'sedih':
      return <path d="M84 124q14-12 28 0" className="il-garis-halus" />
    case 'kaget':
      return <ellipse cx="98" cy="120" rx="7" ry="9" className="il-tinta" />
    case 'tenang':
      return <path d="M88 118h20" className="il-garis-halus" />
    default:
      return <path d="M82 114q16 18 32 0" className="il-garis-halus" />
  }
}

/**
 * Maskot buku bermuka. Dekoratif (aria-hidden) kecuali diberi `label`.
 * @param {{
 *   suasana?: 'senang'|'sedih'|'kaget'|'tenang',
 *   ukuran?: number,
 *   label?: string,
 *   melayang?: boolean,
 *   className?: string,
 * }} props
 */
export function MaskotBuku({
  suasana = 'senang',
  ukuran = 200,
  label = '',
  melayang = false,
  className = '',
}) {
  return (
    <svg
      viewBox="0 0 200 210"
      width={ukuran}
      height={(ukuran * 210) / 200}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <ellipse cx="100" cy="198" rx="58" ry="8" className="il-bayang" />
      <g className={melayang ? 'il-melayang' : undefined}>
        {/* halaman */}
        <rect x="50" y="30" width="116" height="156" rx="14" className="il-kertas il-garis" />
        <path d="M58 182h104" className="il-garis-halus" />
        {/* sampul */}
        <rect x="36" y="22" width="120" height="156" rx="16" className="il-aksen il-garis" />
        {/* punggung buku */}
        <path d="M36 38a16 16 0 0 1 16-16h12v156H52a16 16 0 0 1-16-16Z" className="il-navy il-garis" />
        {/* pita penanda */}
        <path d="M126 22v38l11-9 11 9V22Z" className="il-hangat il-garis" />
        {/* mata */}
        <circle cx="88" cy="84" r="12" className="il-kertas il-garis" />
        <circle cx="124" cy="84" r="12" className="il-kertas il-garis" />
        <circle cx={suasana === 'kaget' ? 88 : 90} cy={suasana === 'sedih' ? 88 : 85} r="5" className="il-tinta" />
        <circle cx={suasana === 'kaget' ? 124 : 126} cy={suasana === 'sedih' ? 88 : 85} r="5" className="il-tinta" />
        {/* pipi */}
        <ellipse cx="72" cy="108" rx="8" ry="5" className="il-pendukung" />
        <ellipse cx="140" cy="108" rx="8" ry="5" className="il-pendukung" />
        <Mulut suasana={suasana} />
        {suasana === 'sedih' && (
          <path d="M148 98q6 10 0 16q-6-6 0-16Z" className="il-pendukung il-garis" />
        )}
      </g>
      {/* kerlip bintang */}
      <path d="M176 44l4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" className="il-hangat il-garis" />
      <path d="M22 118l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" className="il-pendukung il-garis" />
    </svg>
  )
}

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
