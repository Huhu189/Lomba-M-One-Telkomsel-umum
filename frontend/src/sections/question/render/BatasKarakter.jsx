/**
 * Penghitung karakter di bawah kotak jawaban.
 * Pengumuman ke pembaca layar hanya muncul saat mendekati/mencapai batas,
 * supaya tidak berisik tiap ketikan.
 */
import { keadaanBatas } from './batasJawaban.js'

/**
 * @param {{ id: string, panjang: number, batas: number }} props
 */
export default function BatasKarakter({ id, panjang, batas }) {
  const keadaan = keadaanBatas(panjang, batas)
  const format = (/** @type {number} */ n) => n.toLocaleString('id-ID')

  return (
    <p
      id={id}
      className={`hitung-karakter small mb-0 hitung-${keadaan}`}
      role={keadaan === 'aman' ? undefined : 'status'}
    >
      {keadaan === 'habis'
        ? `Batas ${format(batas)} karakter tercapai`
        : `${format(panjang)} / ${format(batas)} karakter`}
    </p>
  )
}
