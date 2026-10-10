/**
 * Renderer isian angka: satu kotak angka (boleh diikuti satuan).
 * konten: { teks, satuan? } · kunci: { nilai, toleransi }
 * nilai : string
 */
import MediaSoal from './MediaSoal.jsx'
import { teksAman } from '../tipeSoal.js'

/** @param {import('./props.js').PropsSoal} props */
export default function SoalIsianAngka({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const satuan = teksAman(konten.satuan).trim()
  const kunciNilai = kunci.nilai
  const kunciToleransi = Number(kunci.toleransi ?? 0)

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />

      <div className="d-flex align-items-center gap-2 isian-angka">
        <input
          className="form-control"
          type="text"
          inputMode="decimal"
          name={nama}
          aria-label="Jawaban angka"
          value={typeof nilai === 'string' || typeof nilai === 'number' ? String(nilai) : ''}
          disabled={dinonaktifkan}
          onChange={(e) => onUbah?.(e.target.value)}
          placeholder="Tulis angkanya…"
        />
        {satuan !== '' && <span className="isian-angka-satuan">{satuan}</span>}
      </div>

      {tampilkanKunci && (typeof kunciNilai === 'number' || typeof kunciNilai === 'string') && (
        <p className="small mb-0 mt-2">
          <span className="badge-kunci">Kunci</span> {String(kunciNilai)}
          {satuan !== '' ? ` ${satuan}` : ''}
          {kunciToleransi > 0 && <span className="teks-lembut"> (toleransi ±{kunciToleransi})</span>}
        </p>
      )}
    </div>
  )
}
