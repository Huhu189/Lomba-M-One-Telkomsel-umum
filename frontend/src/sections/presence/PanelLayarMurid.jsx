/**
 * Layar guru di perangkat murid (slice 10).
 *
 * Ditempel di layar pengerjaan ulangan: guru bisa menyorot satu soal atau
 * mengirim pengumuman, dan perangkat murid mengikutinya tanpa murid perlu
 * memuat ulang halaman. Kalau guru tidak sedang menampilkan apa pun, komponen
 * ini tidak menggambar apa-apa — layar ulangan kembali seperti biasa.
 *
 * Dua hal yang sengaja TIDAK dilakukan di sini:
 * - tidak menampilkan jawaban/kunci apa pun (payload server pun tanpa kunci);
 * - tidak menghalangi pekerjaan murid — pengumuman bersifat informasi, bukan
 *   modal yang mengunci layar, supaya ulangan tetap bisa dikerjakan.
 */
import Banner from '../../shared/ui/Banner.jsx'
import RendererSoal from '../question/render/RendererSoal.jsx'
import useLayar from './useLayar.js'

/**
 * @param {{ kuisId: number }} props
 */
export default function PanelLayarMurid({ kuisId }) {
  const { data } = useLayar(kuisId, { peran: 'murid' })

  if (data === undefined || !data.aktif || data.mode === 'kosong') return null

  if (data.mode === 'soal' && data.soal !== null) {
    return (
      <section className="kartu-soal p-3 p-md-4 mb-3" aria-label="Soal yang disorot guru">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <span className="badge-status info">Dari guru</span>
          <h2 className="h6 fw-bold mb-0">Guru menyorot soal nomor {data.soal.nomor}</h2>
          {data.judul !== null && data.judul !== '' && (
            <span className="teks-lembut small ms-auto">{data.judul}</span>
          )}
        </div>

        <RendererSoal
          tipe={data.soal.tipe}
          konten={data.soal.konten}
          kunci={{}}
          tampilkanKunci={false}
          nama={`layar-kuis-${kuisId}-soal-${data.soal.id}`}
          dinonaktifkan
        />

        <p className="teks-lembut small mb-0 mt-2">
          Ikuti penjelasan gurumu; jawabanmu di halaman ini tidak berubah.
        </p>
      </section>
    )
  }

  const judul = data.judul ?? (data.mode === 'hasil' ? 'Setelah ulangan' : 'Pengumuman')

  return (
    <Banner jenis={data.mode === 'hasil' ? 'sukses' : 'info'} judul={judul}>
      {data.isi !== null && data.isi !== '' && (
        <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>
          {data.isi}
        </p>
      )}
      <p className="teks-lembut small mb-0">Dari gurumu · pembaruan {data.versi}</p>
    </Banner>
  )
}
