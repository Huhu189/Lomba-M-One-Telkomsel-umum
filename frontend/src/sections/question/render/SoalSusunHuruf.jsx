/**
 * Renderer susun huruf: huruf diacak SERVER (`konten.huruf`), anak mengetuk huruf
 * untuk menyusun kata.
 * konten: { petunjuk, huruf?: [huruf, …] } · kunci: { kata }
 * nilai : string (kata tersusun)
 *
 * Pratinjau editor (tanpa `huruf` dari server) memakai huruf dari kunci supaya
 * guru tetap melihat bentuk soalnya.
 */
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import { daftarTeks, teksAman } from '../tipeSoal.js'

/**
 * Huruf yang ditampilkan: dari server bila ada, kalau tidak dari kunci (editor).
 * @param {Record<string, unknown>} konten
 * @param {Record<string, unknown>} kunci
 * @returns {string[]}
 */
function hurufTampil(konten, kunci) {
  const dariServer = daftarTeks(konten.huruf).flatMap((satu) => [...satu])

  if (dariServer.length > 0) return dariServer

  const kata = teksAman(kunci.kata)

  return [...kata].reverse()
}

/**
 * Rekonstruksi indeks kotak yang sudah dipakai dari jawaban (greedy, tanpa
 * mengubah nilai). Dipakai supaya tampilan tetap benar tanpa state kembar.
 * @param {string[]} huruf
 * @param {string} nilai
 * @returns {number[]}
 */
function indeksTerpakai(huruf, nilai) {
  /** @type {number[]} */
  const hasil = []
  const dipakai = new Set()

  for (const karakter of [...nilai]) {
    const indeks = huruf.findIndex(
      (satu, nomor) => !dipakai.has(nomor) && satu.toLowerCase() === karakter.toLowerCase(),
    )
    if (indeks === -1) continue
    dipakai.add(indeks)
    hasil.push(indeks)
  }

  return hasil
}

/** @param {import('./props.js').PropsSoal} props */
export default function SoalSusunHuruf({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
}) {
  const huruf = hurufTampil(konten, kunci)
  const jawaban = typeof nilai === 'string' ? nilai : ''
  const dipakai = indeksTerpakai(huruf, jawaban)

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.petunjuk)}</p>

      <div className="susun-huruf-jawaban" aria-live="polite">
        {jawaban === '' ? (
          <span className="teks-lembut">Ketuk huruf di bawah untuk menyusun kata.</span>
        ) : (
          <span className="susun-huruf-kata">{jawaban}</span>
        )}
      </div>

      <ul className="susun-huruf-kotak list-unstyled mb-0">
        {huruf.map((satu, indeks) => {
          const terpakai = dipakai.includes(indeks)

          return (
            <li key={`${satu}-${indeks}`}>
              <button
                type="button"
                className={`susun-huruf-tombol${terpakai ? ' terpakai' : ''}`}
                disabled={dinonaktifkan || terpakai}
                onClick={() => onUbah?.(jawaban + satu)}
              >
                {satu}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="d-flex flex-wrap gap-2 mt-3">
        <Tombol
          varian="tepi"
          ukuran="sedang"
          disabled={dinonaktifkan || jawaban === ''}
          onClick={() => onUbah?.(jawaban.slice(0, -1))}
        >
          Hapus satu
        </Tombol>
        <Tombol
          varian="tepi"
          ukuran="sedang"
          disabled={dinonaktifkan || jawaban === ''}
          onClick={() => onUbah?.('')}
        >
          Ulangi
        </Tombol>
      </div>

      {tampilkanKunci && teksAman(kunci.kata) !== '' && (
        <p className="small mb-0 mt-2">
          <span className="badge-kunci">Kunci</span> {teksAman(kunci.kata)}
        </p>
      )}
    </div>
  )
}
