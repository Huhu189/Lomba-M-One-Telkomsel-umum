/**
 * Renderer letak kata: setiap kata ditempatkan pada satu posisi/kolom.
 * konten: { teks, kata: [{ id, teks }], posisi: [{ id, teks }] }
 * kunci : { penempatan: { idKata: idPosisi } }
 * nilai : { idKata: idPosisi }
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarAman, rekamanTeks, teksAman } from '../tipeSoal.js'

/**
 * Teks posisi dari id (untuk menampilkan kunci).
 * @param {{ id: string, teks: string }[]} daftar
 * @param {string} id
 * @returns {string}
 */
function teksDariId(daftar, id) {
  return daftar.find((satu) => satu.id === id)?.teks ?? '—'
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalLetakKata({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const kata = daftarAman(konten.kata)
  const posisi = daftarAman(konten.posisi)
  const jawaban = rekamanTeks(nilai)
  const kunciPenempatan = rekamanTeks(kunci.penempatan)

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <ul className="soal-jodoh list-unstyled mb-0">
        {kata.map((satu) => {
          const dipilih = jawaban[satu.id] ?? ''
          const tepat = dipilih !== '' && kunciPenempatan[satu.id] === dipilih

          return (
            <li key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span className="jodoh-kiri flex-grow-1">{satu.teks}</span>

              <select
                className="form-select form-select-sm jodoh-pilih"
                aria-label={`Posisi untuk ${satu.teks}`}
                name={`${nama}-${satu.id}`}
                value={dipilih}
                disabled={dinonaktifkan}
                onChange={(e) => onUbah?.({ ...jawaban, [satu.id]: e.target.value })}
              >
                <option value="">Pilih posisi…</option>
                {posisi.map((pasang) => (
                  <option key={pasang.id} value={pasang.id}>
                    {pasang.teks}
                  </option>
                ))}
              </select>

              {tampilkanKunci && (
                <span className="badge-kunci">
                  {tepat ? 'tepat' : `kunci: ${teksDariId(posisi, kunciPenempatan[satu.id] ?? '')}`}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
