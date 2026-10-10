/**
 * Renderer pilihan ganda kompleks: jawaban benar lebih dari satu (centang).
 * konten: { teks, opsi: [{ id, teks }] } · kunci: { benar: [id, …] }
 * nilai : [id, …]
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarAman, daftarTeks, teksAman } from '../tipeSoal.js'

/** @param {import('./props.js').PropsSoal} props */
export default function SoalPilihanGandaKompleks({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const opsi = daftarAman(konten.opsi)
  const dipilih = daftarTeks(nilai)
  const kunciBenar = daftarTeks(kunci.benar)

  /**
   * @param {string} id
   * @param {boolean} dicentang
   */
  function ubah(id, dicentang) {
    const berikut = dicentang
      ? [...dipakaiUnik(dipilih, id)]
      : dipilih.filter((satu) => satu !== id)

    // Urutkan mengikuti urutan opsi supaya hasil jawaban stabil.
    onUbah?.(opsi.map((satu) => satu.id).filter((satu) => berikut.includes(satu)))
  }

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />
      <p className="teks-lembut small mb-2">Pilih semua jawaban yang benar (boleh lebih dari satu).</p>

      <ul className="soal-opsi list-unstyled mb-0">
        {opsi.map((satu) => {
          const iniKunci = tampilkanKunci && kunciBenar.includes(satu.id)
          const idInput = `${nama}-${satu.id}`

          return (
            <li key={satu.id} className="form-check d-flex gap-2 align-items-start">
              <input
                className="form-check-input mt-1"
                type="checkbox"
                id={idInput}
                value={satu.id}
                checked={dipilih.includes(satu.id)}
                disabled={dinonaktifkan}
                onChange={(e) => ubah(satu.id, e.target.checked)}
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

/**
 * Tambah id tanpa duplikat.
 * @param {string[]} daftar
 * @param {string} id
 * @returns {string[]}
 */
function dipakaiUnik(daftar, id) {
  return daftar.includes(id) ? daftar : [...daftar, id]
}
