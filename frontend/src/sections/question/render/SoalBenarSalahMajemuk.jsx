/**
 * Renderer benar/salah majemuk: tiap pernyataan dinilai sendiri.
 * konten: { teks, pernyataan: [{ id, teks }] } · kunci: { jawaban: { id: bool } }
 * nilai : { id: bool }
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarAman, rekamanBoolean, teksAman } from '../tipeSoal.js'

const OPSI = [
  { nilai: true, label: 'Benar', id: 'benar' },
  { nilai: false, label: 'Salah', id: 'salah' },
]

/** @param {import('./props.js').PropsSoal} props */
export default function SoalBenarSalahMajemuk({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const pernyataan = daftarAman(konten.pernyataan)
  const jawaban = rekamanBoolean(nilai)
  const kunciJawaban = rekamanBoolean(kunci.jawaban)

  /**
   * @param {string} id
   * @param {boolean} dipilih
   */
  function ubah(id, dipilih) {
    onUbah?.({ ...jawaban, [id]: dipilih })
  }

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <ul className="soal-opsi list-unstyled mb-0">
        {pernyataan.map((satu) => {
          const dipilih = jawaban[satu.id]
          const iniKunci = tampilkanKunci ? kunciJawaban[satu.id] : undefined

          return (
            <li key={satu.id} className="mb-3">
              <p className="mb-1">{satu.teks}</p>
              <div className="d-flex gap-3">
                {OPSI.map((pasang) => {
                  const idInput = `${nama}-${satu.id}-${pasang.id}`
                  return (
                    <div key={pasang.id} className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name={idInput}
                        id={idInput}
                        checked={dipilih === pasang.nilai}
                        disabled={dinonaktifkan}
                        onChange={() => ubah(satu.id, pasang.nilai)}
                      />
                      <label className="form-check-label" htmlFor={idInput}>
                        {pasang.label}
                      </label>
                    </div>
                  )
                })}

                {iniKunci !== undefined && (
                  <span className="badge-kunci">kunci: {iniKunci ? 'Benar' : 'Salah'}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
