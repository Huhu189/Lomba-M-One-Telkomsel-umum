/**
 * Renderer garis bilangan: anak menandai satu titik pada garis.
 * konten: { teks?, min, max, langkah } · kunci: { nilai, toleransi }
 * nilai : number | string
 *
 * Garis digambar sendiri sebagai SVG (tanpa library): satu tick tiap `langkah`,
 * masing-masing bisa diketuk (pointer) dan dijangkau keyboard (Enter/Space).
 * Nilai yang ditandai dipakai sebagai jawaban murid.
 */
import MediaSoal from './MediaSoal.jsx'
import { teksAman } from '../tipeSoal.js'

const LEBAR = 640
const TINGGI = 130
const TEPI = 40
const MAKS_TICK = 31

/**
 * Titik-titik yang digambar: min, min+langkah, …, max.
 * @param {number} min
 * @param {number} max
 * @param {number} langkah
 * @returns {number[]}
 */
export function titikGaris(min, max, langkah) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(langkah) || langkah <= 0) return []
  if (max <= min) return []

  const titik = []
  const langkahAman = Math.max(langkah, (max - min) / MAKS_TICK)

  for (let nilai = min; nilai <= max + 1e-9 && titik.length < MAKS_TICK; nilai += langkahAman) {
    titik.push(Number(nilai.toFixed(6)))
  }

  if (titik[titik.length - 1] !== max) titik.push(max)

  return titik
}

/**
 * Format angka sederhana (buang .0).
 * @param {number} nilai
 * @returns {string}
 */
function formatAngka(nilai) {
  return Number.isInteger(nilai) ? String(nilai) : String(Number(nilai.toFixed(3)))
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalGarisBilangan({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
}) {
  const min = Number(konten.min ?? 0)
  const max = Number(konten.max ?? 0)
  const langkah = Number(konten.langkah ?? 1)
  const titik = titikGaris(min, max, langkah)

  const terpilih = typeof nilai === 'number' ? nilai : Number(nilai)
  const kunciNilai = Number(kunci.nilai)
  const toleransi = Number(kunci.toleransi ?? 0)

  const posisiX = titik.map((satu, indeks) =>
    titik.length <= 1 ? LEBAR / 2 : TEPI + (indeks * (LEBAR - 2 * TEPI)) / (titik.length - 1),
  )

  return (
    <div className="soal-render">
      {teksAman(konten.teks) !== '' && <p className="soal-teks">{teksAman(konten.teks)}</p>}
      <MediaSoal konten={konten} />

      <svg
        className="garis-bilangan"
        viewBox={`0 0 ${LEBAR} ${TINGGI}`}
        role="group"
        aria-label="Garis bilangan"
      >
        <line x1={TEPI} y1={TINGGI / 2} x2={LEBAR - TEPI} y2={TINGGI / 2} className="garis-bilangan-sumbu" />

        {titik.map((satu, indeks) => {
          const x = posisiX[indeks]
          const iniTerpilih = Number.isFinite(terpilih) && Math.abs(terpilih - satu) <= Math.max(toleransi, 1e-9)
          const iniKunci = Number.isFinite(kunciNilai) && Math.abs(kunciNilai - satu) <= Math.max(toleransi, 1e-9)

          return (
            <g
              key={`${satu}-${indeks}`}
              className={`garis-bilangan-tick${iniTerpilih ? ' terpilih' : ''}${tampilkanKunci && iniKunci ? ' kunci' : ''}`}
              role="button"
              tabIndex={dinonaktifkan ? -1 : 0}
              aria-label={`Tandai ${formatAngka(satu)}`}
              aria-pressed={iniTerpilih}
              onClick={() => !dinonaktifkan && onUbah?.(satu)}
              onKeyDown={(e) => {
                if (dinonaktifkan) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onUbah?.(satu)
                }
              }}
            >
              <line x1={x} y1={TINGGI / 2 - 12} x2={x} y2={TINGGI / 2 + 12} className="garis-bilangan-coret" />
              <circle cx={x} cy={TINGGI / 2} r={iniTerpilih ? 9 : 5} className="garis-bilangan-titik" />
              <text x={x} y={TINGGI / 2 + 34} textAnchor="middle" className="garis-bilangan-label">
                {formatAngka(satu)}
              </text>
            </g>
          )
        })}
      </svg>

      <p className="small teks-lembut mb-0">
        {Number.isFinite(terpilih) ? (
          <>
            Ditandai: <strong>{formatAngka(terpilih)}</strong>
            {tampilkanKunci && Number.isFinite(kunciNilai) && (
              <>
                {' '}
                <span className="badge-kunci">Kunci</span> {formatAngka(kunciNilai)}
                {toleransi > 0 ? ` (±${formatAngka(toleransi)})` : ''}
              </>
            )}
          </>
        ) : (
          'Ketuk satu titik pada garis bilangan.'
        )}
      </p>
    </div>
  )
}
