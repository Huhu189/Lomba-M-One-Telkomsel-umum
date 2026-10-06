/**
 * Renderer mengurutkan: murid mengisi nomor urut tiap item.
 * konten: { teks, item: [{ id, teks }] } · kunci: { urutan: [id, …] }
 * nilai : { idItem: "posisi" }
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarAman, daftarTeks, rekamanTeks, teksAman } from '../tipeSoal.js'

/** @param {import('./props.js').PropsSoal} props */
export default function SoalMengurutkan({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const item = daftarAman(konten.item)
  const jawaban = rekamanTeks(nilai)
  const kunciUrutan = daftarTeks(kunci.urutan)

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <ul className="soal-urut list-unstyled mb-0">
        {item.map((satu) => {
          const posisi = jawaban[satu.id] ?? ''
          const posisiKunci = kunciUrutan.indexOf(satu.id) + 1
          const tepat = posisi !== '' && Number(posisi) === posisiKunci

          return (
            <li key={satu.id} className="d-flex align-items-center gap-2 mb-2">
              <input
                className="form-control form-control-sm urut-posisi"
                type="number"
                min={1}
                max={item.length}
                inputMode="numeric"
                aria-label={`Nomor urut untuk ${satu.teks}`}
                name={`${nama}-${satu.id}`}
                value={posisi}
                disabled={dinonaktifkan}
                onChange={(e) => onUbah?.({ ...jawaban, [satu.id]: e.target.value })}
              />
              <span className="urut-teks">{satu.teks}</span>
              {tampilkanKunci && (
                <span className="badge-kunci">{tepat ? 'tepat' : `kunci: ${posisiKunci}`}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
