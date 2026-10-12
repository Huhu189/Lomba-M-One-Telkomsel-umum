/**
 * Tombol ukuran tulisan Normal/Besar (papan putaran 3: "Ukuran: dua pilihan
 * saja … Besar untuk murid kecil atau layar jauh").
 *
 * Hanya dua keadaan, jadi sengaja satu tombol berbalik (bukan menu): sekali
 * tekan langsung berpindah, tanpa dialog perantara. Keadaannya diberitahukan
 * lewat aria-pressed dan label tombol — warna/ikon saja tidak cukup untuk
 * pembaca layar maupun untuk orang yang tidak bisa membedakan warna.
 */
import { IkonHuruf } from '../../icons.jsx'
import { useTemaStore } from '../store/tema.js'

/** @param {{ className?: string }} props */
export default function TombolUkuran({ className = '' }) {
  const ukuran = useTemaStore((s) => s.ukuran)
  const ubahUkuran = useTemaStore((s) => s.ubahUkuran)
  const besar = ukuran === 'besar'

  return (
    <button
      type="button"
      className={`tombol-ikon ${className}`.trim()}
      onClick={() => ubahUkuran(besar ? 'normal' : 'besar')}
      aria-pressed={besar}
      aria-label={besar ? 'Ukuran tulisan Besar — tekan untuk kembali Normal' : 'Ukuran tulisan Normal — tekan untuk Besar'}
      title={besar ? 'Ukuran tulisan: Besar' : 'Ukuran tulisan: Normal'}
    >
      <IkonHuruf size={22} />
    </button>
  )
}
