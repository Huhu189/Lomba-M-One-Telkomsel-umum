/**
 * Renderer teka silang mini: anak mengisi huruf pada kotak-kotak teka-teki.
 * konten: { grid: [[sel]], mendatar: [{ nomor, teks, sel }], menurun: […] }
 * kunci : { sel: { "r,c": "h" } }
 * nilai : { "r,c": "h" }
 *
 * Kotak yang diisi murid ditandai string kosong di konten.grid; `#` berarti
 * kotak hitam penyekat. Huruf jawaban tidak pernah dikirim ke layar ini, jadi
 * yang dilihat anak hanya bentuk kotak + petunjuknya.
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarTeks, rekamanTeks, teksAman } from '../tipeSoal.js'

/**
 * Daftar baris grid, tiap baris daftar isi kotak (`''` = diisi murid, `'#'` =
 * kotak hitam); baris tak sah dibuang agar data kotor tidak merusak tampilan.
 * @param {unknown} nilai
 * @returns {string[][]}
 */
export function gridSilang(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((baris) => Array.isArray(baris))
    .map((baris) => baris.map((kotak) => (kotak === '#' ? '#' : '')))
}

/**
 * Daftar petunjuk satu arah dengan daftar kode selnya.
 * @param {unknown} nilai
 * @returns {{ nomor: string, teks: string, sel: string[] }[]}
 */
export function petunjukSilang(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((satu) => satu !== null && typeof satu === 'object')
    .map((satu) => {
      const rekaman = /** @type {Record<string, unknown>} */ (satu)
      return {
        nomor: rekaman.nomor === undefined || rekaman.nomor === null ? '' : String(rekaman.nomor),
        teks: teksAman(rekaman.teks),
        sel: daftarTeks(rekaman.sel),
      }
    })
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalTekaSilangMini({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const baris = gridSilang(konten.grid)
  const mendatar = petunjukSilang(konten.mendatar)
  const menurun = petunjukSilang(konten.menurun)
  const jawaban = rekamanTeks(nilai)
  const kunciSel = rekamanTeks(kunci.sel)

  // Nomor petunjuk ditulis di kotak pertamanya, seperti teka silang sungguhan.
  /** @type {Record<string, string>} */
  const nomorSel = {}

  for (const daftar of [mendatar, menurun]) {
    for (const satu of daftar) {
      const awal = satu.sel[0]
      if (awal !== undefined && satu.nomor !== '' && nomorSel[awal] === undefined) nomorSel[awal] = satu.nomor
    }
  }

  /** @param {string} kode @param {string} isi */
  function ubah(kode, isi) {
    onUbah?.({ ...jawaban, [kode]: isi })
  }

  return (
    <div className="soal-render">
      {teksAman(konten.teks) !== '' && <p className="soal-teks">{teksAman(konten.teks)}</p>}
      <MediaSoal konten={konten} />

      <div className="silang-bungkus">
        <table className="silang-grid" aria-label="Kotak teka silang">
          <tbody>
            {baris.map((satu, r) => (
              <tr key={`baris-${r}`}>
                {satu.map((kotak, c) => {
                  const kode = `${r},${c}`

                  return kotak === '#' ? (
                    <td key={kode} className="silang-hitam" aria-hidden="true" />
                  ) : (
                    <td key={kode} className="silang-kotak">
                      {nomorSel[kode] !== undefined && (
                        <span className="silang-nomor" aria-hidden="true">
                          {nomorSel[kode]}
                        </span>
                      )}
                      <input
                        className="silang-isian"
                        type="text"
                        maxLength={1}
                        aria-label={`Huruf kotak ${kode}`}
                        name={`${nama}-${kode}`}
                        value={jawaban[kode] ?? ''}
                        disabled={dinonaktifkan}
                        onChange={(e) => ubah(kode, e.target.value)}
                      />
                      {tampilkanKunci && kunciSel[kode] !== undefined && (
                        <span className="badge-kunci silang-kunci">{kunciSel[kode]}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="silang-petunjuk list-unstyled mb-0">
          <li className="fw-bold">Mendatar</li>
          {mendatar.map((satu, indeks) => (
            <li key={`m-${indeks}`}>
              <strong>{satu.nomor}.</strong> {satu.teks}
            </li>
          ))}
          <li className="fw-bold mt-2">Menurun</li>
          {menurun.map((satu, indeks) => (
            <li key={`t-${indeks}`}>
              <strong>{satu.nomor}.</strong> {satu.teks}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
