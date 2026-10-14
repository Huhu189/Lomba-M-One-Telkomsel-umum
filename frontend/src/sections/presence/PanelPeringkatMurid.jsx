/**
 * Papan peringkat di perangkat murid (layar kelas, 14 Oktober 2026).
 *
 * Tampil saat guru memilih mode "Papan peringkat" di halaman layar kelas. Yang
 * ditampilkan adalah papan yang SAMA dengan halaman peringkat murid itu sendiri:
 * komponennya `report/PapanPeringkat.jsx` dan datanya dari endpoint peringkat
 * dengan sesi murid — bukan salinan yang dititipkan server lewat payload layar.
 * Karena itu aturan "nomor peringkat hanya untuk N% teratas" tetap berlaku utuh
 * di HP anak, sama seperti kalau ia membuka halamannya sendiri.
 *
 * Dua hal yang sengaja TIDAK dilakukan di sini:
 * - tidak menghalangi pekerjaan murid — panelnya informasi, bukan modal;
 * - tidak menampilkan apa pun yang tidak muncul di halaman peringkat murid
 *   (jejak bonus, kolom catatan guru, maupun nomor di luar N% teratas).
 */
import Banner from '../../shared/ui/Banner.jsx'
import PapanPeringkat from '../report/PapanPeringkat.jsx'
import usePeringkat, { TOP_MURID } from '../report/usePeringkat.js'

/**
 * Selang penyegaran papan selama panelnya tampil (ms). Papan bisa berubah saat
 * teman sekelas mengumpulkan jawaban, jadi ia menyegarkan dirinya sendiri —
 * guru tidak perlu menekan tombol dua kali supaya angkanya terbaru.
 */
export const PENYEGARAN_PAPAN = 30_000

/**
 * @param {{ kuisId: number }} props
 */
export default function PanelPeringkatMurid({ kuisId }) {
  const peringkat = usePeringkat(kuisId, {
    sebagaiGuru: false,
    top: TOP_MURID,
    selangMs: PENYEGARAN_PAPAN,
  })

  return (
    <section className="kartu-soal p-3 p-md-4 mb-3" aria-label="Papan peringkat dari guru">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span className="badge-status info">Dari guru</span>
        <span className="teks-lembut small ms-auto">Papan peringkat kelas</span>
      </div>

      {peringkat.isLoading && <p className="text-body-secondary mb-0">Menyiapkan papan peringkat…</p>}

      {peringkat.isError && (
        <Banner jenis="peringatan" judul="Papan peringkat belum bisa dimuat">
          <p className="mb-0">
            Ulanganmu tetap jalan seperti biasa. Coba muat ulang halaman ini kalau papannya tidak muncul.
          </p>
        </Banner>
      )}

      {peringkat.data !== undefined && (
        <PapanPeringkat data={peringkat.data} guru={false} ringkas />
      )}

      <p className="teks-lembut small mb-0 mt-2">
        Papan ini hanya melihat; jawabanmu di halaman ini tidak berubah.
      </p>
    </section>
  )
}
