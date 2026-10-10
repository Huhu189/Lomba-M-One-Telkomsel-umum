/**
 * Renderer baca jam: anak menunjukkan pukul berapa sesuai perintah di teks soal.
 * konten: { teks, matematika?, media? }
 * kunci : { jam: 0–11, menit: 0–59 }
 * nilai : { jam, menit }
 *
 * Waktu yang benar tidak pernah ada di konten, jadi jam di layar hanya
 * menampilkan pilihan anak. Jam analognya digambar sendiri sebagai SVG (tanpa
 * library) supaya anak melihat bentuk jam yang ia pilih, bukan sekadar angka.
 */
import MediaSoal from './MediaSoal.jsx'
import { teksAman } from '../tipeSoal.js'

const UKURAN = 200
const PUSAT = UKURAN / 2
const JARI_JAM = 52
const JARI_MENIT = 74

/**
 * Baca satu angka bulat dari jawaban/state; `null` bila tidak sah.
 * @param {unknown} nilai @param {number} min @param {number} maks
 * @returns {number|null}
 */
export function angkaJam(nilai, min, maks) {
  const angka = Number(nilai)

  if (!Number.isInteger(angka) || angka < min || angka > maks) return null

  return angka
}

/**
 * Titik ujung jarum jam dari sudut derajat (0° = arah jam 12).
 * @param {number} sudut @param {number} panjang
 * @returns {{ x: number, y: number }}
 */
export function ujungJarum(sudut, panjang) {
  const radian = ((sudut - 90) * Math.PI) / 180

  return { x: PUSAT + panjang * Math.cos(radian), y: PUSAT + panjang * Math.sin(radian) }
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalBacaJam({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
}) {
  const rekaman = nilai !== null && typeof nilai === 'object' ? /** @type {Record<string, unknown>} */ (nilai) : {}
  const jamDipilih = angkaJam(rekaman.jam, 0, 11)
  const menitDipilih = angkaJam(rekaman.menit, 0, 59)

  const kunciJam = angkaJam(kunci.jam, 0, 11)
  const kunciMenit = angkaJam(kunci.menit, 0, 59)

  const sudutJam = (jamDipilih ?? 0) * 30 + (menitDipilih ?? 0) / 2
  const sudutMenit = (menitDipilih ?? 0) * 6

  const jamTampil = ujungJarum(sudutJam, JARI_JAM)
  const menitTampil = ujungJarum(sudutMenit, JARI_MENIT)

  return (
    <div className="soal-render">
      {teksAman(konten.teks) !== '' && <p className="soal-teks">{teksAman(konten.teks)}</p>}
      <MediaSoal konten={konten} />

      <div className="baca-jam">
        <svg className="baca-jam-analog" viewBox={`0 0 ${UKURAN} ${UKURAN}`} role="img" aria-label="Jam analog pilihanmu">
          <circle className="baca-jam-badan" cx={PUSAT} cy={PUSAT} r={PUSAT - 6} />
          <circle className="baca-jam-pusat" cx={PUSAT} cy={PUSAT} r={5} />
          <line className="baca-jam-jarum jam" x1={PUSAT} y1={PUSAT} x2={jamTampil.x} y2={jamTampil.y} />
          <line className="baca-jam-jarum menit" x1={PUSAT} y1={PUSAT} x2={menitTampil.x} y2={menitTampil.y} />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((angka) => {
            const posisi = ujungJarum(angka * 30, PUSAT - 24)

            return (
              <text key={angka} className="baca-jam-angka" x={posisi.x} y={posisi.y + 5} textAnchor="middle">
                {angka === 0 ? 12 : angka}
              </text>
            )
          })}
        </svg>

        <div className="baca-jam-pilih">
          <div className="bidang">
            <label className="form-label" htmlFor="baca-jam-jam">
              Jam
            </label>
            <input
              id="baca-jam-jam"
              className="form-control form-control-lg"
              type="number"
              min={0}
              max={11}
              step={1}
              inputMode="numeric"
              value={jamDipilih === null ? '' : String(jamDipilih)}
              disabled={dinonaktifkan}
              onChange={(e) => onUbah?.({ jam: Number(e.target.value), menit: menitDipilih ?? 0 })}
            />
          </div>

          <div className="bidang">
            <label className="form-label" htmlFor="baca-jam-menit">
              Menit
            </label>
            <input
              id="baca-jam-menit"
              className="form-control form-control-lg"
              type="number"
              min={0}
              max={59}
              step={1}
              inputMode="numeric"
              value={menitDipilih === null ? '' : String(menitDipilih)}
              disabled={dinonaktifkan}
              onChange={(e) => onUbah?.({ jam: jamDipilih ?? 0, menit: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <p className="small teks-lembut mb-0">
        Jam 0 berarti pukul 12. Isi angka jam (0–11) dan menit (0–59).
        {tampilkanKunci && kunciJam !== null && kunciMenit !== null && (
          <>
            {' '}
            <span className="badge-kunci">Kunci</span> {kunciJam}:{String(kunciMenit).padStart(2, '0')}
          </>
        )}
      </p>
    </div>
  )
}
