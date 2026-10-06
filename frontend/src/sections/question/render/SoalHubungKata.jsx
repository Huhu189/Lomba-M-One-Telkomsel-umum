/**
 * Renderer hubung kata: menghubungkan kata kiri dengan pasangan kanannya.
 * konten: { teks, kiri: [{ id, teks }], kanan: [{ id, teks }] }
 * kunci : { sambungan: { idKiri: idKanan } }
 * nilai : { idKiri: idKanan }
 *
 * Bentuknya sama dengan menjodohkan; hanya nama kunci pemetaannya berbeda
 * (cermin PenanganHubungKata extends PenanganMenjodohkan di backend).
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarAman, rekamanTeks, teksAman } from '../tipeSoal.js'

/**
 * Teks item dari id (untuk menampilkan kunci).
 * @param {{ id: string, teks: string }[]} daftar
 * @param {string} id
 * @returns {string}
 */
function teksDariId(daftar, id) {
  return daftar.find((satu) => satu.id === id)?.teks ?? '—'
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalHubungKata({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const kiri = daftarAman(konten.kiri)
  const kanan = daftarAman(konten.kanan)
  const jawaban = rekamanTeks(nilai)
  const kunciSambungan = rekamanTeks(kunci.sambungan)

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <ul className="soal-jodoh list-unstyled mb-0">
        {kiri.map((satu) => {
          const dipilih = jawaban[satu.id] ?? ''
          const tepat = dipilih !== '' && kunciSambungan[satu.id] === dipilih

          return (
            <li key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span className="jodoh-kiri flex-grow-1">{satu.teks}</span>

              <select
                className="form-select form-select-sm jodoh-pilih"
                aria-label={`Sambungan untuk ${satu.teks}`}
                name={`${nama}-${satu.id}`}
                value={dipilih}
                disabled={dinonaktifkan}
                onChange={(e) => onUbah?.({ ...jawaban, [satu.id]: e.target.value })}
              >
                <option value="">Pilih pasangan…</option>
                {kanan.map((pasang) => (
                  <option key={pasang.id} value={pasang.id}>
                    {pasang.teks}
                  </option>
                ))}
              </select>

              {tampilkanKunci && (
                <span className="badge-kunci">
                  {tepat ? 'tepat' : `kunci: ${teksDariId(kanan, kunciSambungan[satu.id] ?? '')}`}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
