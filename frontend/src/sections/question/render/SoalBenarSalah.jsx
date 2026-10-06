/**
 * Renderer benar/salah.
 * konten: { teks } · kunci: { benar: boolean }
 */
import MediaSoal from './MediaSoal.jsx'
import { teksAman } from '../tipeSoal.js'

const OPSI = [
  { nilai: true, label: 'Benar', id: 'benar' },
  { nilai: false, label: 'Salah', id: 'salah' },
]

/** @param {import('./props.js').PropsSoal} props */
export default function SoalBenarSalah({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const kunciBenar = kunci.benar === true

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <ul className="soal-opsi list-unstyled mb-0">
        {OPSI.map((satu) => {
          const iniKunci = tampilkanKunci && satu.nilai === kunciBenar
          const idInput = `${nama}-${satu.id}`

          return (
            <li key={satu.id} className="form-check d-flex gap-2 align-items-start">
              <input
                className="form-check-input mt-1"
                type="radio"
                name={nama}
                id={idInput}
                value={satu.id}
                checked={nilai === satu.nilai}
                disabled={dinonaktifkan}
                onChange={() => onUbah?.(satu.nilai)}
              />
              <label className="form-check-label" htmlFor={idInput}>
                {satu.label}
                {iniKunci && <span className="badge-kunci ms-2">Kunci</span>}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
