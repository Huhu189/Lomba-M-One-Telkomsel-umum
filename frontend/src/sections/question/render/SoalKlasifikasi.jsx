/**
 * Renderer klasifikasi: tiap item dikelompokkan ke satu kotak/kategori.
 * konten: { teks, item: [{ id, teks }], kotak: [{ id, label }] }
 * kunci : { peta: { idItem: idKotak } }
 * nilai : { idItem: idKotak }
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarAman, daftarLabel, rekamanTeks, teksAman } from '../tipeSoal.js'

/**
 * Label kotak dari id (untuk menampilkan kunci).
 * @param {{ id: string, teks: string }[]} daftar
 * @param {string} id
 * @returns {string}
 */
function labelDariId(daftar, id) {
  return daftar.find((satu) => satu.id === id)?.teks ?? '—'
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalKlasifikasi({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const item = daftarAman(konten.item)
  // Kotak memakai `label` di konten, bukan `teks`.
  const kotak = daftarLabel(konten.kotak)
  const jawaban = rekamanTeks(nilai)
  const kunciPeta = rekamanTeks(kunci.peta)

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />
      <p className="teks-lembut small mb-2">Pilih kotak yang tepat untuk setiap item.</p>

      <ul className="soal-jodoh list-unstyled mb-0">
        {item.map((satu) => {
          const dipilih = jawaban[satu.id] ?? ''
          const tepat = dipilih !== '' && kunciPeta[satu.id] === dipilih

          return (
            <li key={satu.id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span className="jodoh-kiri flex-grow-1">{satu.teks}</span>

              <select
                className="form-select form-select-sm jodoh-pilih"
                aria-label={`Kotak untuk ${satu.teks}`}
                name={`${nama}-${satu.id}`}
                value={dipilih}
                disabled={dinonaktifkan}
                onChange={(e) => onUbah?.({ ...jawaban, [satu.id]: e.target.value })}
              >
                <option value="">Pilih kotak…</option>
                {kotak.map((pasang) => (
                  <option key={pasang.id} value={pasang.id}>
                    {pasang.teks}
                  </option>
                ))}
              </select>

              {tampilkanKunci && (
                <span className="badge-kunci">
                  {tepat ? 'tepat' : `kunci: ${labelDariId(kotak, kunciPeta[satu.id] ?? '')}`}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
