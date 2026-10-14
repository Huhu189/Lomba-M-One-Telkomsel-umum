/**
 * Renderer garis bilangan: anak menandai satu titik pada garis.
 * konten: { teks?, min, max, langkah } · kunci: { nilai, toleransi }
 * nilai : number | string
 *
 * Garis digambar sendiri sebagai SVG (tanpa library): satu tick tiap `langkah`,
 * masing-masing bisa diketuk (pointer) dan dijangkau keyboard (Enter/Space).
 * Nilai yang ditandai dipakai sebagai jawaban murid.
 *
 * **Sasaran ketuk & penggeser** (14 Oktober 2026, temuan M3). Dulu yang bisa
 * disentuh hanya garis tipis 24 unit + lingkaran jari-jari 5 — di HP (skala
 * ±0,53 pada layar 340 px) artinya sasaran setinggi ±13 px, jauh di bawah target
 * 44 px yang dipegang aplikasi di tempat lain, dan anak sering salah mengetuk
 * titik tetangga. Kini tiap titik punya **kotak sasaran bening setinggi bidang
 * garis** (≥44 px di layar wajar), ditambah **penggeser** di bawahnya sebagai
 * jalur kedua untuk garis yang padat — penggeser mengunci ke titik terdekat,
 * jadi nilainya tetap salah satu titik pada garis.
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

  // Jarak antar titik dalam satuan viewBox; kotak sasaran selebar 90% jarak itu
  // supaya tidak saling menutupi sementara tingginya mengikuti bidang garis.
  const jarak = titik.length <= 1 ? LEBAR - 2 * TEPI : (LEBAR - 2 * TEPI) / (titik.length - 1)
  const lebarSasaran = Math.max(12, Math.min(jarak * 0.9, 64))
  const indeksTerpilih = titik.findIndex(
    (satu) => Number.isFinite(terpilih) && Math.abs(terpilih - satu) <= Math.max(toleransi, 1e-9),
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
              {/* Kotak sasaran bening: bidang penuh setinggi garis supaya jari
               * anak (≥44 px di layar) tidak salah mengetuk titik tetangga. */}
              <rect
                x={x - lebarSasaran / 2}
                y={0}
                width={lebarSasaran}
                height={TINGGI}
                fill="transparent"
                data-sasaran={formatAngka(satu)}
              />
              <line x1={x} y1={TINGGI / 2 - 12} x2={x} y2={TINGGI / 2 + 12} className="garis-bilangan-coret" />
              <circle cx={x} cy={TINGGI / 2} r={iniTerpilih ? 9 : 5} className="garis-bilangan-titik" />
              <text x={x} y={TINGGI / 2 + 34} textAnchor="middle" className="garis-bilangan-label">
                {formatAngka(satu)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Jalur kedua untuk garis padat: penggeser mengunci ke titik terdekat,
       * jadi jawabannya tetap salah satu titik pada garis. */}
      {titik.length > 1 && (
        <label className="garis-bilangan-geser d-block mt-2">
          <span className="small teks-lembut">Geser untuk memilih titik</span>
          <input
            type="range"
            className="form-range"
            min={0}
            max={titik.length - 1}
            step={1}
            value={indeksTerpilih >= 0 ? indeksTerpilih : 0}
            disabled={dinonaktifkan}
            aria-label="Pilih titik pada garis bilangan"
            onChange={(e) => {
              const indeks = Number(e.target.value)
              const nilaiBaru = titik[indeks]
              if (nilaiBaru !== undefined) onUbah?.(nilaiBaru)
            }}
          />
        </label>
      )}

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
