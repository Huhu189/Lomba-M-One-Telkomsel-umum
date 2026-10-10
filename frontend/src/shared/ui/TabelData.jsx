/**
 * Tabel data responsif (papan Standar, temuan 08).
 *
 * Di desktop tampil sebagai tabel biasa. Di bawah 700 px setiap baris berubah
 * menjadi kartu bertumpuk dan judul kolom dipindahkan ke `data-label` tiap sel
 * (dibaca oleh CSS), sehingga kolom Aksi tidak lagi terdorong keluar layar.
 *
 * Kolom aksi ditandai dengan `aksi: true`: tidak diberi data-label, rata
 * kanan di desktop, dan tetap terlihat di HP.
 */
/**
 * @typedef {{
 *   kunci: string,
 *   judul: string,
 *   aksi?: boolean,
 *   kelas?: string,
 *   sel?: (baris: any) => import('react').ReactNode,
 * }} KolomTabel
 */

/**
 * @param {{
 *   label: string,
 *   kolom: KolomTabel[],
 *   baris: any[],
 *   kunciBaris?: (baris: any, indeks: number) => string | number,
 *   kelasBaris?: (baris: any, indeks: number) => string | undefined,
 *   caption?: string,
 *   className?: string,
 * }} props
 */
export default function TabelData({
  label,
  kolom,
  baris,
  kunciBaris,
  kelasBaris,
  caption,
  className = '',
}) {
  return (
    <table className={`tabel-data ${className}`.trim()} aria-label={label}>
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          {kolom.map((satu) => (
            <th key={satu.kunci} scope="col" className={satu.aksi ? 'kolom-aksi' : undefined}>
              {satu.judul}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {baris.map((satu, indeks) => (
          <tr
            key={kunciBaris ? kunciBaris(satu, indeks) : indeks}
            className={kelasBaris ? kelasBaris(satu, indeks) : undefined}
          >
            {kolom.map((kolomSatu) => (
              <td
                key={kolomSatu.kunci}
                className={
                  [kolomSatu.aksi ? 'kolom-aksi' : '', kolomSatu.kelas ?? '']
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                data-label={kolomSatu.aksi ? undefined : kolomSatu.judul}
              >
                {kolomSatu.sel ? kolomSatu.sel(satu) : String(satu[kolomSatu.kunci] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
