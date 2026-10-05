/** Tombol ganti tema terang/gelap (pilihan disimpan di browser). */
import { IkonBulan, IkonMatahari } from '../../icons.jsx'
import { useTemaStore } from '../store/tema.js'

/** @param {{ className?: string }} props */
export default function TombolTema({ className = '' }) {
  const tema = useTemaStore((s) => s.tema)
  const balik = useTemaStore((s) => s.balik)
  const gelap = tema === 'gelap'

  return (
    <button
      type="button"
      className={`tombol-ikon ${className}`.trim()}
      onClick={balik}
      aria-label={gelap ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      title={gelap ? 'Mode terang' : 'Mode gelap'}
    >
      {gelap ? <IkonMatahari size={22} /> : <IkonBulan size={22} />}
    </button>
  )
}
