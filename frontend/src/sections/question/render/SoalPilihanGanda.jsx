/**
 * Renderer pilihan ganda (2–6 opsi).
 * konten: { teks, opsi: [{ id, teks }] } · kunci: { jawaban: id }
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarAman, teksAman } from '../tipeSoal.js'

/** @param {import('./props.js').PropsSoal} props */
export default function SoalPilihanGanda({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const opsi = daftarAman(konten.opsi)
  const kunciJawaban = teksAman(kunci.jawaban)

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <ul className="soal-opsi list-unstyled mb-0">
        {opsi.map((satu) => {
          const iniKunci = tampilkanKunci && satu.id === kunciJawaban
          const idInput = `${nama}-${satu.id}`

          return (
            <li key={satu.id} className="form-check d-flex gap-2 align-items-start">
              <input
                className="form-check-input mt-1"
                type="radio"
                name={nama}
                id={idInput}
                value={satu.id}
                checked={nilai === satu.id}
                disabled={dinonaktifkan}
                onChange={() => onUbah?.(satu.id)}
              />
              <label className="form-check-label" htmlFor={idInput}>
                <span className="opsi-huruf">{satu.id}.</span> {satu.teks}
                {iniKunci && <span className="badge-kunci ms-2">Kunci</span>}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
