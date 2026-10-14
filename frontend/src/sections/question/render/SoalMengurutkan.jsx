/**
 * Renderer mengurutkan: murid mengurutkan item dengan **mengetuk**, bukan
 * mengetik nomor urut.
 * konten: { teks, item: [{ id, teks }] } · kunci: { urutan: [id, …] }
 * nilai : { idItem: "posisi" } — bentuk yang sama seperti sebelumnya, jadi
 *         jawaban lama di basis data tetap terbaca.
 *
 * Kenapa tidak lagi memakai kotak angka (14 Oktober 2026, temuan M2): anak SD
 * harus mengetik 1, 2, 3 … satu per satu lewat keyboard angka yang naik-turun,
 * dan tidak ada yang mencegah nomor kembar atau kosong — hasilnya bisa "1,1,3"
 * tanpa peringatan. Sisi guru sudah lama memakai ▲/▼ besar; murid kini memakai
 * pola yang sama: **ketuk item berurutan** (item pertama yang diketuk jadi nomor
 * 1, berikutnya nomor 2, …), lalu ▲/▼ untuk menukar posisi tetangga. Mengetuk
 * item yang sudah berposisi membatalkannya. Nomor kembar tidak mungkin terjadi
 * karena nomornya selalu diturunkan dari urutan daftar, bukan diketik.
 */
import MediaSoal from './MediaSoal.jsx'
import { daftarAman, daftarTeks, rekamanTeks, teksAman } from '../tipeSoal.js'

/** @param {import('./props.js').PropsSoal} props */
export default function SoalMengurutkan({
  konten,
  kunci = {},
  nilai,
  onUbah,
  dinonaktifkan = false,
  tampilkanKunci = false,
  nama = 'soal',
}) {
  const item = daftarAman(konten.item)
  const jawaban = rekamanTeks(nilai)
  const kunciUrutan = daftarTeks(kunci.urutan)

  // Urutan terpilih diturunkan dari nomor yang tersimpan, bukan disimpan
  // terpisah: dengan begitu jawaban lama (dan jawaban yang tiba dari server)
  // selalu tampil di posisinya tanpa penyesuaian khusus.
  const terpilih = item
    .map((satu) => ({ id: satu.id, posisi: Number(jawaban[satu.id]) }))
    .filter((satu) => Number.isInteger(satu.posisi) && satu.posisi >= 1)
    .sort((a, b) => a.posisi - b.posisi)
    .map((satu) => satu.id)

  /** @param {string[]} urutanBaru */
  function kirim(urutanBaru) {
    /** @type {Record<string, string>} */
    const peta = {}

    urutanBaru.forEach((id, indeks) => {
      peta[id] = String(indeks + 1)
    })

    onUbah?.(peta)
  }

  /** @param {string} id */
  function ketuk(id) {
    if (dinonaktifkan) return

    kirim(terpilih.includes(id) ? terpilih.filter((satu) => satu !== id) : [...terpilih, id])
  }

  /**
   * Tukar posisi satu item dengan tetangganya.
   * @param {string} id
   * @param {number} arah -1 naik, +1 turun
   */
  function geser(id, arah) {
    if (dinonaktifkan) return

    const indeks = terpilih.indexOf(id)
    const tujuan = indeks + arah

    if (indeks < 0 || tujuan < 0 || tujuan >= terpilih.length) return

    const salinan = [...terpilih]
    salinan[indeks] = terpilih[tujuan]
    salinan[tujuan] = terpilih[indeks]

    kirim(salinan)
  }

  return (
    <div className="soal-render">
      <p className="soal-teks">{teksAman(konten.teks)}</p>
      <MediaSoal konten={konten} />
      <p className="teks-lembut small mb-2">
        Ketuk item sesuai urutannya: ketukan pertama jadi nomor 1, berikutnya 2, dan seterusnya.
        Ketuk lagi untuk membatalkan, atau pakai ▲▼ untuk menukar posisi.
      </p>

      <ul className="soal-urut list-unstyled mb-0">
        {item.map((satu) => {
          const posisi = terpilih.indexOf(satu.id)
          const berposisi = posisi >= 0
          const posisiKunci = kunciUrutan.indexOf(satu.id) + 1
          const tepat = berposisi && posisi + 1 === posisiKunci

          return (
            <li key={satu.id} className="d-flex align-items-center gap-2 mb-2">
              <span
                className={`urut-nomor${berposisi ? ' terisi' : ''}`}
                data-urut={berposisi ? posisi + 1 : 0}
                aria-hidden="true"
              >
                {berposisi ? posisi + 1 : '·'}
              </span>

              <button
                type="button"
                className={`btn btn-tepi urut-pilih text-start flex-grow-1${berposisi ? ' terpilih' : ''}`}
                name={`${nama}-${satu.id}`}
                aria-pressed={berposisi}
                aria-label={
                  berposisi
                    ? `${satu.teks} — nomor ${posisi + 1}, ketuk untuk membatalkan`
                    : `${satu.teks} — ketuk untuk memberi nomor ${terpilih.length + 1}`
                }
                data-urut-pilih={satu.id}
                disabled={dinonaktifkan}
                onClick={() => ketuk(satu.id)}
              >
                {satu.teks}
              </button>

              {berposisi && (
                <span className="pengurut d-flex gap-1">
                  <button
                    type="button"
                    className="btn btn-tepi pengurut-tombol"
                    aria-label={`Naikkan ${satu.teks}`}
                    data-urut-naik={satu.id}
                    disabled={dinonaktifkan || posisi === 0}
                    onClick={() => geser(satu.id, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="btn btn-tepi pengurut-tombol"
                    aria-label={`Turunkan ${satu.teks}`}
                    data-urut-turun={satu.id}
                    disabled={dinonaktifkan || posisi === terpilih.length - 1}
                    onClick={() => geser(satu.id, 1)}
                  >
                    ▼
                  </button>
                </span>
              )}

              {tampilkanKunci && (
                <span className="badge-kunci">{tepat ? 'tepat' : `kunci: ${posisiKunci}`}</span>
              )}
            </li>
          )
        })}
      </ul>

      <p className="small teks-lembut mb-0 mt-2" data-urut-progres={terpilih.length}>
        {terpilih.length} dari {item.length} item sudah diberi nomor.
      </p>
    </div>
  )
}
