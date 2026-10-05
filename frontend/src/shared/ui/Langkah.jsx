/** Penunjuk langkah (daftar → cek email → aktif). Status langkah lewat ikon/teks. */
import { IkonCentang } from '../../icons.jsx'

/**
 * @param {{ langkah: string[], sekarang: number }} props sekarang = indeks (0-based) langkah aktif
 */
export default function Langkah({ langkah, sekarang }) {
  return (
    <ol className="langkah" aria-label="Tahapan">
      {langkah.map((nama, i) => {
        const status = i < sekarang ? 'selesai' : i === sekarang ? 'sekarang' : ''
        return (
          <li key={nama} className={status} aria-current={status === 'sekarang' ? 'step' : undefined}>
            <span className="langkah-bulat">
              {status === 'selesai' ? <IkonCentang size={18} /> : i + 1}
            </span>
            {nama}
            {status === 'selesai' && <span className="sr-saja"> (selesai)</span>}
          </li>
        )
      })}
    </ol>
  )
}
