/**
 * Renderer isian rumpang: teks dengan penanda {{1}} … {{n}} menjadi kotak isian.
 * konten: { teks (memuat penanda), matematika? }
 * kunci : { lubang: { "1": [jawaban diterima, …] } }
 * nilai : { "1": jawaban }
 */
import MediaSoal from './MediaSoal.jsx'
import { rekamanDaftarTeks, rekamanTeks, teksAman } from '../tipeSoal.js'

/**
 * Pecah teks menjadi potongan teks dan nomor lubang, urut apa adanya.
 * @param {string} teks
 * @returns {({ jenis: 'teks', isi: string } | { jenis: 'lubang', nomor: string })[]}
 */
export function pecahRumpang(teks) {
  const bagian = teks.split(/(\{\{\s*\d+\s*\}\})/g).filter((satu) => satu !== '')

  return bagian.map((satu) => {
    const cocok = satu.match(/^\{\{\s*(\d+)\s*\}\}$/)
    return cocok === null ? { jenis: 'teks', isi: satu } : { jenis: 'lubang', nomor: cocok[1] }
  })
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalIsianRumpang({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const jawaban = rekamanTeks(nilai)
  const kunciLubang = rekamanDaftarTeks(kunci.lubang)
  const bagian = pecahRumpang(teksAman(konten.teks))

  /**
   * @param {string} nomor
   * @param {string} isi
   */
  function ubah(nomor, isi) {
    onUbah?.({ ...jawaban, [nomor]: isi })
  }

  return (
    <div className="soal-render">
      <p className="soal-teks rumpang-teks">
        {bagian.map((satu, indeks) =>
          satu.jenis === 'teks' ? (
            <span key={indeks}>{satu.isi}</span>
          ) : (
            <input
              key={indeks}
              className="form-control form-control-sm rumpang-kotak"
              type="text"
              inputMode="text"
              name={`${nama}-lubang-${satu.nomor}`}
              aria-label={`Isian ke-${satu.nomor}`}
              value={jawaban[satu.nomor] ?? ''}
              disabled={dinonaktifkan}
              onChange={(e) => ubah(satu.nomor, e.target.value)}
            />
          ),
        )}
      </p>

      <MediaSoal konten={konten} />

      {tampilkanKunci && (
        <ul className="list-unstyled teks-lembut small mb-0 mt-2">
          {Object.entries(kunciLubang).map(([nomor, daftar]) => (
            <li key={nomor}>
              <span className="badge-kunci">Isian {nomor}</span> {daftar.join(', ')}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
