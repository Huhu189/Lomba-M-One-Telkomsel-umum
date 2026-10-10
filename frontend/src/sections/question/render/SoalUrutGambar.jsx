/**
 * Renderer urut gambar: anak menyusun gambar sesuai urutan yang diminta.
 * konten: { teks?, item: [{ id, media }] } · kunci: { urutan: [id, …] }
 * nilai : [id, …] (urutan jawaban, indeks 0 = paling awal)
 *
 * Penyusunan memakai seret-lepas pointer (tanpa library baru) DAN tombol
 * naik/turun untuk keyboard, supaya anak yang memakai papan tombol juga bisa.
 * Jawaban disimpan sebagai daftar id berurutan — bentuk yang dinilai server.
 */
import { useState } from 'react'
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import { daftarMedia, daftarTeks, teksAman } from '../tipeSoal.js'

/**
 * @param {Record<string, unknown>} konten
 * @returns {string}
 */
function altGambar(konten) {
  const teks = teksAman(konten.teks).replace(/\s+/g, ' ').trim()
  return teks === '' ? 'Gambar untuk diurutkan' : `Urutkan: ${teks.slice(0, 120)}`
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalUrutGambar({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
}) {
  const item = daftarMedia(konten.item)
  const kunciUrutan = daftarTeks(kunci.urutan)
  const idItem = item.map((satu) => satu.id)

  const tersimpan = Array.isArray(nilai) ? /** @type {string[]} */ (nilai).filter((satu) => idItem.includes(satu)) : []
  // Tampilan awal mengikuti urutan server; begitu anak menyusun, jawaban lengkap
  // dipakai supaya urutannya stabil.
  const urutan = tersimpan.length === idItem.length ? tersimpan : idItem

  const [seret, setSeret] = useState(/** @type {number|null} */ (null))

  /**
   * @param {number} dari
   * @param {number} ke
   */
  function pindah(dari, ke) {
    if (dari === ke || dari < 0 || ke < 0 || dari >= urutan.length || ke >= urutan.length) return
    const berikut = [...urutan]
    const [satu] = berikut.splice(dari, 1)
    berikut.splice(ke, 0, satu)
    onUbah?.(berikut)
  }

  const media = new Map(item.map((satu) => [satu.id, satu.media]))

  return (
    <div className="soal-render">
      {teksAman(konten.teks) !== '' && <p className="soal-teks">{teksAman(konten.teks)}</p>}
      <p className="teks-lembut small mb-2">
        Seret gambar ke urutan yang benar, atau pakai tombol naik/turun.
      </p>

      <ul className="urut-gambar list-unstyled mb-0">
        {urutan.map((id, indeks) => {
          const posisiKunci = kunciUrutan.indexOf(id) + 1
          const tepat = tampilkanKunci && posisiKunci === indeks + 1
          const gambar = media.get(id) ?? ''

          return (
            <li
              key={id}
              className={`urut-gambar-baris${seret === indeks ? ' sedang-disert' : ''}`}
              data-urut-indeks={indeks}
              onPointerMove={(e) => {
                if (seret === null) return
                const simpul = document.elementFromPoint(e.clientX, e.clientY)
                const baris = simpul?.closest('[data-urut-indeks]')
                if (baris === null || baris === undefined) return
                const tujuan = Number(baris.getAttribute('data-urut-indeks'))
                if (Number.isInteger(tujuan) && tujuan !== seret) {
                  pindah(seret, tujuan)
                  setSeret(tujuan)
                }
              }}
              onPointerUp={() => setSeret(null)}
              onPointerCancel={() => setSeret(null)}
            >
              <span className="urut-gambar-nomor" aria-hidden="true">
                {indeks + 1}
              </span>

              <button
                type="button"
                className="urut-gambar-pegangan"
                aria-label={`Geser gambar urutan ${indeks + 1}. Gunakan tombol atas atau bawah untuk memindah.`}
                aria-pressed={seret === indeks}
                disabled={dinonaktifkan}
                onPointerDown={(e) => {
                  e.preventDefault()
                  setSeret(indeks)
                }}
              >
                ⠿
              </button>

              {gambar !== '' && (
                <img
                  className="urut-gambar-media"
                  src={gambar}
                  alt={`Gambar ${indeks + 1}. ${altGambar(konten)}`}
                  loading="lazy"
                  width={160}
                  height={110}
                />
              )}

              <div className="urut-gambar-aksi ms-auto">
                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  aria-label="Naikkan gambar ke atas"
                  disabled={dinonaktifkan || indeks === 0}
                  onClick={() => pindah(indeks, indeks - 1)}
                >
                  ▲
                </Tombol>
                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  aria-label="Turunkan gambar ke bawah"
                  disabled={dinonaktifkan || indeks === urutan.length - 1}
                  onClick={() => pindah(indeks, indeks + 1)}
                >
                  ▼
                </Tombol>
              </div>

              {tampilkanKunci && <span className="badge-kunci">{tepat ? 'tepat' : `kunci: ${posisiKunci}`}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
