/**
 * Navigator soal (papan desain 4 & 5) — kisi nomor supaya murid bisa melompat
 * ke soal mana pun dan melihat mana yang masih kosong atau bertanda ragu.
 *
 * Status TIDAK hanya warna: tiap tombol membawa aria-label yang menyebut
 * nomor dan keadaannya ("Soal 4, ragu-ragu"), dan legenda di bawahnya memakai
 * ikon + teks. Soal yang sedang dibuka ditandai `aria-current="step"`.
 */
import { IkonBendera, IkonCentang } from '../../icons.jsx'
import { labelStatus, statusSoal } from '../../sections/attempt/navigatorSoal.js'

/**
 * @param {{
 *   soal: Array<{ id: number, nomor: number }>,
 *   jawaban: Record<string, unknown>,
 *   ragu: Record<string, boolean>,
 *   aktif: number,
 *   onPilih: (indeks: number) => void,
 *   className?: string,
 * }} props
 */
export default function NavigatorSoal({ soal, jawaban, ragu, aktif, onPilih, className = '' }) {
  return (
    <div className={`navigator-soal ${className}`.trim()}>
      <div className="navigator-kisi" role="group" aria-label="Daftar soal">
        {soal.map((satu, indeks) => {
          const kunci = String(satu.id)
          const status = statusSoal({
            terjawab: jawaban[kunci] !== undefined && jawaban[kunci] !== null,
            ragu: Boolean(ragu[kunci]),
          })

          return (
            <button
              key={satu.id}
              type="button"
              className={`navigator-nomor ${status}${indeks === aktif ? ' arus' : ''}`}
              aria-label={`Soal ${satu.nomor}, ${labelStatus(status)}`}
              aria-current={indeks === aktif ? 'step' : undefined}
              onClick={() => onPilih(indeks)}
            >
              {satu.nomor}
            </button>
          )
        })}
      </div>

      <ul className="navigator-legenda">
        <li>
          <span className="navigator-tanda dijawab" aria-hidden="true">
            <IkonCentang size={14} />
          </span>
          Sudah dijawab
        </li>
        <li>
          <span className="navigator-tanda ragu" aria-hidden="true">
            <IkonBendera size={14} />
          </span>
          Ragu-ragu
        </li>
        <li>
          <span className="navigator-tanda kosong" aria-hidden="true" />
          Belum dijawab
        </li>
      </ul>
    </div>
  )
}
