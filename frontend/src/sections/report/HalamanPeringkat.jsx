/**
 * Halaman peringkat satu kuis (slice 05).
 *
 * Peringkat dihitung server HANYA dari skor asli (percobaan pertama), jadi
 * mengulang kuis tidak mengubah urutan. Bila guru mematikan saklar ranking,
 * murid melihat pesan kosong; guru tetap melihat data untuk laporan.
 */
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import TabelData from '../../shared/ui/TabelData.jsx'
import { RUTE } from '../../routes.js'
import { useAuthStore } from '../auth/authStore.js'
import { ambilPeringkat } from './api.js'
import { barisMilikSaya } from './tampilan.js'

export default function HalamanPeringkat() {
  const { kuisId } = useParams()
  const idKuis = Number(kuisId)
  const user = useAuthStore((s) => s.user)
  const sebagaiGuru = user?.role === 'guru' || user?.role === 'admin'

  const peringkat = useQuery({
    queryKey: ['peringkat', idKuis],
    queryFn: () => ambilPeringkat(idKuis, 20),
    enabled: Number.isInteger(idKuis) && idKuis > 0,
  })

  const data = peringkat.data

  if (peringkat.isLoading) {
    return <p className="text-body-secondary">Menyusun peringkat…</p>
  }

  if (peringkat.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Peringkat belum bisa dibuka">
        <p className="mb-3">Peringkat ini tidak tersedia untukmu.</p>
        <Link className="btn btn-tepi" to={RUTE.kuis}>
          Kembali ke daftar kuis
        </Link>
      </Banner>
    )
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h5 fw-bold mb-1">Peringkat · {data.judul_kuis}</h1>
          <p className="teks-lembut small mb-3">
            Dihitung dari <strong>nilai asli</strong> (percobaan pertama). Bila nilainya sama, yang
            lebih cepat mengumpulkan naik; bila masih sama, urut nama.
          </p>

          {!data.tampil && (
            <Banner jenis="info" judul="Ranking sedang dimatikan guru">
              <p className="mb-0">
                {sebagaiGuru
                  ? 'Murid tidak melihat peringkat sampai saklar ranking dinyalakan di pengaturan.'
                  : 'Gurumu mematikan tampilan peringkat untuk kelas ini.'}
              </p>
            </Banner>
          )}

          {data.tampil && data.mode_tim && (
            <p className="teks-lembut small">
              Kuis ini mode tim: satu nilai untuk satu tim, jadi yang diperingkat adalah timnya.
            </p>
          )}

          {data.tampil && data.total === 0 && (
            <p className="text-body-secondary">
              {data.mode_tim
                ? 'Belum ada tim yang mengumpulkan ulangan ini.'
                : 'Belum ada murid yang mengumpulkan ulangan ini.'}
            </p>
          )}

          {data.peringkat.length > 0 && (
            <TabelData
              label="Peringkat ulangan"
              baris={data.peringkat}
              kunciBaris={(baris) => baris.attempt_id}
              // Baris milik murid sendiri tetap disorot seperti sebelumnya.
              kelasBaris={(baris) =>
                barisMilikSaya(baris, data.peringkat_saya, data.mode_tim) ? 'sorot-hangat' : undefined
              }
              kolom={[
                { kunci: 'peringkat', judul: '#', sel: (baris) => <strong>{baris.peringkat}</strong> },
                {
                  kunci: 'nama',
                  judul: data.mode_tim ? 'Tim' : 'Nama',
                  sel: (baris) => {
                    const milikku = barisMilikSaya(baris, data.peringkat_saya, data.mode_tim)
                    return (
                      <>
                        {baris.nama}
                        {data.mode_tim && <span className="badge-status lembut ms-2">tim</span>}
                        {milikku && <span className="small ms-2">(kamu)</span>}
                        {baris.anggota.length > 0 && (
                          <div className="teks-lembut small">{baris.anggota.join(', ')}</div>
                        )}
                      </>
                    )
                  },
                },
                {
                  kunci: 'skor',
                  judul: 'Skor',
                  kelas: 'text-end',
                  sel: (baris) => `${baris.skor} / ${baris.skor_maksimal} (${baris.persen}%)`,
                },
                {
                  kunci: 'benar',
                  judul: 'Benar',
                  kelas: 'text-end',
                  sel: (baris) => `${baris.jumlah_benar} / ${baris.jumlah_soal}`,
                },
              ]}
            />
          )}

          {data.tampil && data.peringkat_saya === null && !sebagaiGuru && (
            <p className="teks-lembut small">
              {data.mode_tim
                ? 'Timmu belum mengumpulkan ulangan ini, jadi belum masuk peringkat.'
                : 'Kamu belum mengumpulkan ulangan ini, jadi belum masuk peringkat.'}
            </p>
          )}

          {data.total > data.peringkat.length && (
            <p className="teks-lembut small mb-0">
              Menampilkan {data.peringkat.length} peringkat teratas dari {data.total} peserta.
            </p>
          )}

          <div className="d-flex flex-wrap gap-2 mt-4">
            <Link className="btn btn-tepi" to={`${RUTE.kuis}/${idKuis}`}>
              Lihat kuis
            </Link>
            <Link className="btn btn-teks" to={RUTE.kuis}>
              Daftar kuis
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
