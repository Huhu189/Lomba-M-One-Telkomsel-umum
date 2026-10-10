/**
 * Renderer tugas unggah: anak menyerahkan hasil kerja berupa berkas.
 * konten: { teks, jenis_berkas, matematika?, media? }
 * kunci : { rubrik: [{ butir, poin }] }
 * nilai : string — catatan singkat murid (opsional)
 *
 * Berkasnya diunggah lewat panel unggah jawaban yang sudah ada di layar
 * pengerjaan; renderer ini menyiapkan instruksinya, menyebut berkas apa yang
 * boleh diunggah, dan menampung catatan anak. Rubrik hanya tampil untuk guru
 * (pratinjau) karena hanya dipakai saat mengoreksi.
 */
import MediaSoal from './MediaSoal.jsx'
import { teksAman } from '../tipeSoal.js'

/**
 * Butir rubrik dari kunci.
 * @param {unknown} nilai
 * @returns {{ butir: string, poin: string }[]}
 */
export function rubrikPenilaian(nilai) {
  if (!Array.isArray(nilai)) return []

  return nilai
    .filter((satu) => satu !== null && typeof satu === 'object')
    .map((satu) => {
      const rekaman = /** @type {Record<string, unknown>} */ (satu)
      return { butir: teksAman(rekaman.butir), poin: String(rekaman.poin ?? '') }
    })
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalTugasUnggah({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const jenis = teksAman(konten.jenis_berkas)
  const rubrik = rubrikPenilaian(kunci.rubrik)
  const catatan = typeof nilai === 'string' ? nilai : ''

  return (
    <div className="soal-render">
      {teksAman(konten.teks) !== '' && <p className="soal-teks">{teksAman(konten.teks)}</p>}
      <MediaSoal konten={konten} />

      <p className="tugas-unggah-jenis small mb-2">
        Berkas yang boleh diunggah: <strong>{jenis === '' ? 'belum ditentukan guru' : jenis}</strong>
      </p>

      <p className="small teks-lembut">
        Unggah hasil kerjamu lewat tombol unggah di bawah soal ini (boleh foto kertas, gambar, atau rekaman
        suara). Bila gurumu meminta, tulis catatan singkat di kotak berikut.
      </p>

      <div className="bidang">
        <label className="form-label" htmlFor={`${nama}-catatan`}>
          Catatan untuk guru <span className="teks-lembut fw-normal">opsional</span>
        </label>
        <textarea
          id={`${nama}-catatan`}
          className="form-control"
          rows={3}
          maxLength={500}
          value={catatan}
          disabled={dinonaktifkan}
          onChange={(e) => onUbah?.(e.target.value)}
          placeholder="Contoh: saya mengerjakan soal nomor 3 dengan cara bersusun"
        />
      </div>

      {tampilkanKunci && rubrik.length > 0 && (
        <ul className="list-unstyled teks-lembut small mb-0 mt-2">
          {rubrik.map((satu, indeks) => (
            <li key={`${indeks}-${satu.butir}`}>
              <span className="badge-kunci">{satu.poin} poin</span> {satu.butir}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
