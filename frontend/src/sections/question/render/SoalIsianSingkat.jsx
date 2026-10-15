/**
 * Renderer isian singkat: satu kotak teks pendek.
 * konten: { teks, petunjuk? } · kunci: { jawaban_baku: [teks, …], sinonim?: [[alias, …]] }
 * nilai : string
 */
import BatasKarakter from './BatasKarakter.jsx'
import MediaSoal from './MediaSoal.jsx'
import { BATAS_ISIAN_SINGKAT } from './batasJawaban.js'
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
  const teks = typeof nilai === 'string' ? nilai : ''
  const idHitung = `${nama}-hitung`
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
        maxLength={BATAS_ISIAN_SINGKAT}
        aria-describedby={dinonaktifkan || teks.length < BATAS_ISIAN_SINGKAT * 0.9 ? undefined : idHitung}
        value={teks}
        disabled={dinonaktifkan}
        onChange={(e) => onUbah?.(e.target.value)}
        placeholder={teksAman(konten.petunjuk) || 'Tulis jawabanmu…'}
      />

      {!dinonaktifkan && teks.length >= BATAS_ISIAN_SINGKAT * 0.9 && (
        <div className="text-end mt-1">
          <BatasKarakter id={idHitung} panjang={teks.length} batas={BATAS_ISIAN_SINGKAT} />
        </div>
      )}

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
