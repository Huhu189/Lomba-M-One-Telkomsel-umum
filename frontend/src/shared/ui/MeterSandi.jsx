/** Meter kekuatan kata sandi (4 segmen + teks; bukan hanya warna). */
import { nilaiKekuatanSandi } from './kekuatanSandi.js'

/** @param {{ sandi: string }} props */
export default function MeterSandi({ sandi }) {
  const hasil = nilaiKekuatanSandi(sandi)
  if (hasil.tingkat === 0) return null

  return (
    <div aria-live="polite" className="mb-3">
      <div className="meter" data-tingkat={hasil.tingkat} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="meter-teks mb-0">
        <span>Kekuatan: {hasil.label}</span>
        <span className="teks-lembut fw-normal">{hasil.saran}</span>
      </p>
    </div>
  )
}
