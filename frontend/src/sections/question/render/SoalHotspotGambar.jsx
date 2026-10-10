/**
 * Renderer hotspot gambar: anak mengetuk satu titik pada gambar.
 * konten: { teks?, media, area: [{ id, x, y, w, h }] } — koordinat 0–1
 * kunci : { area_benar: [id, …] }
 * nilai : { x, y } — koordinat ternormalisasi
 *
 * Titik dikirim apa adanya (0–1), bukan indeks area, supaya jawaban tidak bisa
 * ditebak dari urutan pilihan: server yang memutuskan apakah titik itu jatuh di
 * area benar. Area tetap bisa diaktifkan lewat keyboard (Enter/Space) dengan
 * mengirim titik tengahnya — anak yang tidak memakai tetikus tetap bisa menjawab.
 */
import { useState } from 'react'
import { altMedia } from './MediaSoal.jsx'
import { teksAman } from '../tipeSoal.js'

/**
 * Daftar area dalam bentuk aman + angka 0–1.
 * @param {unknown} nilai
 * @returns {{ id: string, x: number, y: number, w: number, h: number }[]}
 */
export function areaHotspot(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((satu) => satu !== null && typeof satu === 'object')
    .map((satu) => {
      const rekaman = /** @type {Record<string, unknown>} */ (satu)
      const angka = (/** @type {unknown} */ isi) => {
        const hasil = Number(isi)
        return Number.isFinite(hasil) ? Math.min(1, Math.max(0, hasil)) : 0
      }

      return {
        id: teksAman(rekaman.id),
        x: angka(rekaman.x),
        y: angka(rekaman.y),
        w: angka(rekaman.w),
        h: angka(rekaman.h),
      }
    })
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalHotspotGambar({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
}) {
  const [gagalMuat, setGagalMuat] = useState(false)

  const media = teksAman(konten.media)
  const area = areaHotspot(konten.area)
  const benar = Array.isArray(kunci.area_benar) ? kunci.area_benar.map(String) : []

  const rekaman = nilai !== null && typeof nilai === 'object' ? /** @type {Record<string, unknown>} */ (nilai) : {}
  const titikX = Number(rekaman.x)
  const titikY = Number(rekaman.y)
  const adaTitik = Number.isFinite(titikX) && Number.isFinite(titikY)

  /** @param {{ x: number, y: number }} titik */
  function pilih(titik) {
    if (dinonaktifkan) return
    onUbah?.({ x: titik.x, y: titik.y })
  }

  /**
   * Titik dari ketukan: posisi ketukan dibanding kotak gambar.
   * @param {import('react').MouseEvent<HTMLElement>} peristiwa
   */
  function ketuk(peristiwa) {
    if (dinonaktifkan || gagalMuat) return

    const kotak = peristiwa.currentTarget.getBoundingClientRect()

    if (kotak.width === 0 || kotak.height === 0) return

    pilih({
      x: (peristiwa.clientX - kotak.left) / kotak.width,
      y: (peristiwa.clientY - kotak.top) / kotak.height,
    })
  }

  return (
    <div className="soal-render">
      {teksAman(konten.teks) !== '' && <p className="soal-teks">{teksAman(konten.teks)}</p>}

      {media === '' || gagalMuat ? (
        <p className="media-soal-galat small mb-3">
          Gambar soal belum bisa ditampilkan. Hubungi gurumu sebelum menjawab.
        </p>
      ) : (
        <div className={`hotspot-bidang${dinonaktifkan ? ' nonaktif' : ''}`} onClick={ketuk}>
          <img
            className="hotspot-media"
            src={media}
            alt={altMedia(konten)}
            onError={() => setGagalMuat(true)}
          />

          <svg
            className="hotspot-lapisan"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="group"
            aria-label="Area yang bisa diketuk"
          >
            {area.map((satu) => {
              const iniTerpilih =
                adaTitik &&
                titikX >= satu.x &&
                titikX <= satu.x + satu.w &&
                titikY >= satu.y &&
                titikY <= satu.y + satu.h

              return (
                <g
                  key={satu.id}
                  className={`hotspot-area${iniTerpilih ? ' terpilih' : ''}${
                    tampilkanKunci && benar.includes(satu.id) ? ' kunci' : ''
                  }`}
                  role="button"
                  tabIndex={dinonaktifkan ? -1 : 0}
                  aria-label={`Ketuk area ${satu.id}`}
                  aria-pressed={iniTerpilih}
                  onClick={(peristiwa) => {
                    peristiwa.stopPropagation()
                    pilih({ x: satu.x + satu.w / 2, y: satu.y + satu.h / 2 })
                  }}
                  onKeyDown={(peristiwa) => {
                    if (peristiwa.key !== 'Enter' && peristiwa.key !== ' ') return
                    peristiwa.preventDefault()
                    pilih({ x: satu.x + satu.w / 2, y: satu.y + satu.h / 2 })
                  }}
                >
                  <rect
                    x={satu.x * 100}
                    y={satu.y * 100}
                    width={satu.w * 100}
                    height={satu.h * 100}
                  />
                </g>
              )
            })}

            {adaTitik && (
              <circle className="hotspot-titik" cx={titikX * 100} cy={titikY * 100} r={3} />
            )}
          </svg>
        </div>
      )}

      <p className="small teks-lembut mb-0">
        {adaTitik ? 'Ketukanmu sudah tersimpan. Ketuk lagi bila ingin memindahkannya.' : 'Ketuk bagian gambar yang kamu pilih.'}
      </p>
    </div>
  )
}
