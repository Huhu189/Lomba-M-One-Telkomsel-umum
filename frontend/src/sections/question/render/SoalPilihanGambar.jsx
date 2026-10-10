/**
 * Renderer pilihan gambar: anak memilih satu gambar (target sentuh besar).
 * konten: { teks?, opsi: [{ id, media }] } · kunci: { benar: id }
 * nilai : id
 */
import { useState } from 'react'
import { daftarMedia, teksAman } from '../tipeSoal.js'

/**
 * @param {Record<string, unknown>} konten
 * @returns {string}
 */
function altGambar(konten) {
  const teks = teksAman(konten.teks).replace(/\s+/g, ' ').trim()
  return teks === '' ? 'Gambar pilihan' : `Pilihan gambar: ${teks.slice(0, 120)}`
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalPilihanGambar({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const opsi = daftarMedia(konten.opsi)
  const kunciBenar = teksAman(kunci.benar)
  const [gagal, setGagal] = useState(/** @type {Record<string, boolean>} */ ({}))

  return (
    <div className="soal-render">
      {teksAman(konten.teks) !== '' && <p className="soal-teks">{teksAman(konten.teks)}</p>}

      <div className="pilihan-gambar-grid">
        {opsi.map((satu) => {
          const idInput = `${nama}-${satu.id}`
          const iniKunci = tampilkanKunci && satu.id === kunciBenar

          return (
            <label
              key={satu.id}
              className={`pilihan-gambar-kartu${nilai === satu.id ? ' terpilih' : ''}`}
              htmlFor={idInput}
            >
              <input
                className="form-check-input"
                type="radio"
                name={nama}
                id={idInput}
                value={satu.id}
                checked={nilai === satu.id}
                disabled={dinonaktifkan}
                onChange={() => onUbah?.(satu.id)}
              />
              {satu.media !== '' && !gagal[satu.id] && (
                <img
                  className="pilihan-gambar-media"
                  src={satu.media}
                  alt={altGambar(konten)}
                  loading="lazy"
                  width={240}
                  height={160}
                  onError={() => setGagal((lama) => ({ ...lama, [satu.id]: true }))}
                />
              )}
              {satu.media !== '' && gagal[satu.id] && (
                <span className="teks-lembut small">Gambar tidak bisa dimuat.</span>
              )}
              {iniKunci && <span className="badge-kunci">Kunci</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}
