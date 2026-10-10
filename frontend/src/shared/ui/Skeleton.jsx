/**
 * Kerangka pemuatan (skeleton) — pengganti teks "Memuat…" (papan Standar,
 * temuan 06). Abu-abu berdenyut pelan, dan denyutnya mati sendiri saat
 * pengguna meminta gerak dikurangi (prefers-reduced-motion).
 *
 * Pembaca layar tidak dibacakan kotak kosongnya: yang dibacakan hanya teks
 * `label` di dalam wilayah role="status".
 */

/**
 * Beberapa baris teks pemuatan (opsional dengan satu baris judul).
 * @param {{
 *   baris?: number,
 *   judul?: boolean,
 *   className?: string,
 *   label?: string,
 * }} props
 */
export default function Skeleton({ baris = 3, judul = false, className = '', label = 'Memuat data…' }) {
  return (
    <div className={`skeleton-grup ${className}`.trim()} role="status">
      <span className="sr-saja">{label}</span>
      {judul && <div className="skeleton skeleton-judul" aria-hidden="true" />}
      {Array.from({ length: baris }, (_, i) => (
        <div key={i} className="skeleton skeleton-baris" aria-hidden="true" />
      ))}
    </div>
  )
}

/**
 * Beberapa kartu pemuatan (daftar kuis, kelas, soal, dst).
 * @param {{
 *   jumlah?: number,
 *   className?: string,
 *   label?: string,
 * }} props
 */
export function SkeletonKartu({ jumlah = 3, className = '', label = 'Memuat data…' }) {
  return (
    <div className={`skeleton-grup ${className}`.trim()} role="status">
      <span className="sr-saja">{label}</span>
      {Array.from({ length: jumlah }, (_, i) => (
        <div key={i} className="skeleton skeleton-kartu" aria-hidden="true" />
      ))}
    </div>
  )
}