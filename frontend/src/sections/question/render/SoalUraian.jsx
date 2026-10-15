/**
 * Renderer uraian: kotak teks panjang.
 * konten: { teks, petunjuk? } · kunci: { kata_kunci: [{ teks, bobot? }] }
 * nilai : string
 */
import BatasKarakter from './BatasKarakter.jsx'
import MediaSoal from './MediaSoal.jsx'
import { BATAS_URAIAN } from './batasJawaban.js'
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
  const teks = typeof nilai === 'string' ? nilai : ''
  const idHitung = `${nama}-hitung`

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <textarea
        className="form-control uraian-isian"
        rows={6}
        name={nama}
        aria-label="Jawaban uraian"
        aria-describedby={dinonaktifkan ? undefined : idHitung}
        maxLength={BATAS_URAIAN}
        value={teks}
        disabled={dinonaktifkan}
        onChange={(e) => onUbah?.(e.target.value)}
        placeholder={teksAman(konten.petunjuk) || 'Tulis jawabanmu dengan kalimat lengkap…'}
      />
      {!dinonaktifkan && (
        <div className="text-end mt-1">
          <BatasKarakter id={idHitung} panjang={teks.length} batas={BATAS_URAIAN} />
        </div>
      )}

      {tampilkanKunci && kataKunci.length > 0 && (
        <p className="teks-lembut small mt-2 mb-0">
          <span className="badge-kunci">Kata kunci</span>{' '}
          {kataKunci.map((satu) => `${satu.teks} (${satu.bobot})`).join(' · ')}
        </p>
      )}
    </div>
  )
}
