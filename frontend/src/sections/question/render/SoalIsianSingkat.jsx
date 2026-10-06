/**
 * Renderer isian singkat: satu kotak teks pendek.
 * konten: { teks, petunjuk? } · kunci: { jawaban_baku: [teks, …], sinonim?: [[alias, …]] }
 * nilai : string
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarTeks, teksAman } from '../tipeSoal.js'

/**
 * Kandidat jawaban (baku + sinonim) untuk satu indeks.
 * @param {Record<string, unknown>} kunci
 * @param {number} indeks
 * @returns {string[]}
 */
function kandidat(kunci, indeks) {
  const sinonim = Array.isArray(kunci.sinonim) ? kunci.sinonim : []
  return [daftarTeks(kunci.jawaban_baku)[indeks] ?? '', ...daftarTeks(sinonim[indeks])].filter(
    (satu) => satu !== '',
  )
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalIsianSingkat({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const jawabanBaku = daftarTeks(kunci.jawaban_baku)
  const semuaKandidat = jawabanBaku.map((_, indeks) => kandidat(kunci, indeks))

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <input
        className="form-control"
        type="text"
        name={nama}
        aria-label="Jawaban isian singkat"
        value={typeof nilai === 'string' ? nilai : ''}
        disabled={dinonaktifkan}
        onChange={(e) => onUbah?.(e.target.value)}
        placeholder={teksAman(konten.petunjuk) || 'Tulis jawabanmu…'}
      />

      {tampilkanKunci && semuaKandidat.length > 0 && (
        <ul className="list-unstyled teks-lembut small mt-2 mb-0">
          {semuaKandidat.map((daftar, indeks) => (
            <li key={indeks}>
              <span className="badge-kunci">Kunci</span> {daftar.join(' · ')}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
