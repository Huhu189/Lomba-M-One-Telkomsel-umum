/**
 * Renderer uraian: kotak teks panjang.
 * konten: { teks, petunjuk? } · kunci: { kata_kunci: [{ teks, bobot? }] }
 * nilai : string
 */
import MediaSoal from './MediaSoal.jsx'
import { teksAman } from '../tipeSoal.js'

/**
 * Daftar kata kunci dari kunci soal (tahan data kotor).
 * @param {Record<string, unknown>} kunci
 * @returns {{ teks: string, bobot: number }[]}
 */
function daftarKataKunci(kunci) {
  const nilai = kunci.kata_kunci
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((satu) => satu !== null && typeof satu === 'object')
    .map((satu) => {
      const rekaman = /** @type {Record<string, unknown>} */ (satu)
      const bobot = Number(rekaman.bobot)
      return { teks: teksAman(rekaman.teks), bobot: Number.isFinite(bobot) && bobot > 0 ? bobot : 1 }
    })
    .filter((satu) => satu.teks !== '')
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalUraian({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const kataKunci = daftarKataKunci(kunci)

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <textarea
        className="form-control"
        rows={4}
        name={nama}
        aria-label="Jawaban uraian"
        value={typeof nilai === 'string' ? nilai : ''}
        disabled={dinonaktifkan}
        onChange={(e) => onUbah?.(e.target.value)}
        placeholder={teksAman(konten.petunjuk) || 'Tulis jawabanmu dengan kalimat lengkap…'}
      />

      {tampilkanKunci && kataKunci.length > 0 && (
        <p className="teks-lembut small mt-2 mb-0">
          <span className="badge-kunci">Kata kunci</span>{' '}
          {kataKunci.map((satu) => `${satu.teks} (${satu.bobot})`).join(' · ')}
        </p>
      )}
    </div>
  )
}
