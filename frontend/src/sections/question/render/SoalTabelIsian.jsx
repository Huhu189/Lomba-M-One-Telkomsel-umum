/**
 * Renderer tabel isian: sel tanpa teks menjadi kotak isian.
 * konten: { teks, kolom: [label, …], baris: [{ id, sel: [{ kode, teks? }] }] }
 * kunci : { sel: { kode: [jawaban diterima, …] } }
 * nilai : { kode: jawaban }
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarTeks, rekamanDaftarTeks, rekamanTeks, teksAman } from '../tipeSoal.js'

/**
 * Daftar sel satu baris dalam bentuk aman.
 * @param {unknown} nilai
 * @returns {{ kode: string, teks: string }[]}
 */
export function selBaris(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((satu) => satu !== null && typeof satu === 'object')
    .map((satu) => {
      const rekaman = /** @type {Record<string, unknown>} */ (satu)
      return { kode: teksAman(rekaman.kode), teks: teksAman(rekaman.teks) }
    })
}

/**
 * Daftar baris tabel.
 * @param {unknown} nilai
 * @returns {{ id: string, sel: { kode: string, teks: string }[] }[]}
 */
export function barisTabel(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((satu) => satu !== null && typeof satu === 'object')
    .map((satu) => {
      const rekaman = /** @type {Record<string, unknown>} */ (satu)
      return { id: teksAman(rekaman.id), sel: selBaris(rekaman.sel) }
    })
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalTabelIsian({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const kolom = daftarTeks(konten.kolom)
  const baris = barisTabel(konten.baris)
  const jawaban = rekamanTeks(nilai)
  const kunciSel = rekamanDaftarTeks(kunci.sel)

  /**
   * @param {string} kode
   * @param {string} isi
   */
  function ubah(kode, isi) {
    onUbah?.({ ...jawaban, [kode]: isi })
  }

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <div className="tabel-isian-bungkus">
        <table className="tabel-isian">
          {kolom.length > 0 && (
            <thead>
              <tr>
                {kolom.map((satu, indeks) => (
                  <th key={`${satu}-${indeks}`} scope="col">
                    {satu}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {baris.map((satu) => (
              <tr key={satu.id}>
                {satu.sel.map((sel) => {
                  const terisi = sel.teks.trim() !== ''

                  return (
                    <td key={sel.kode}>
                      {terisi ? (
                        <span>{sel.teks}</span>
                      ) : (
                        <>
                          <input
                            className="form-control form-control-sm"
                            type="text"
                            aria-label={`Isian ${sel.kode}`}
                            name={`${nama}-${sel.kode}`}
                            value={jawaban[sel.kode] ?? ''}
                            disabled={dinonaktifkan}
                            onChange={(e) => ubah(sel.kode, e.target.value)}
                          />
                          {tampilkanKunci && (kunciSel[sel.kode]?.length ?? 0) > 0 && (
                            <span className="badge-kunci mt-1">
                              kunci: {kunciSel[sel.kode].join(', ')}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
