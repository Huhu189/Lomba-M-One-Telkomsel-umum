/**
 * Detail kuis (slice 03). Guru melihat kunci + pembahasan; murid hanya
 * melihat soal — server memang tidak pernah mengirimkan kuncinya.
 */
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { RUTE } from '../../routes.js'
import { useAuthStore } from '../auth/authStore.js'
import RendererSoal from '../question/render/RendererSoal.jsx'
import { ambilKuisDetail } from './api.js'
import { formatDurasi, formatJadwal, statusTampilan } from './status.js'

export default function HalamanKuisDetail() {
  const { id } = useParams()
  const nomor = Number(id)
  const user = useAuthStore((s) => s.user)
  const sebagaiGuru = user?.role === 'guru' || user?.role === 'admin'

  const kuis = useQuery({
    queryKey: ['kuis', nomor, sebagaiGuru ? 'guru' : 'murid'],
    queryFn: () => ambilKuisDetail(nomor),
    enabled: Number.isInteger(nomor) && nomor > 0,
  })

  const data = kuis.data
  const status = data === undefined ? null : statusTampilan(data)

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <div className="kartu-soft p-4 p-md-5">
          <Link className="btn btn-sm btn-tepi mb-3" to={RUTE.kuis}>
            ← Kembali ke daftar kuis
          </Link>

          {kuis.isLoading && <p className="text-body-secondary">Memuat kuis…</p>}

          {kuis.isError && (
            <p className="status-salah">
              Gagal memuat kuis ini. Kuis mungkin belum diterbitkan untuk kelasmu.
            </p>
          )}

          {data && status !== null && (
            <>
              <div className="d-flex flex-wrap align-items-baseline gap-2">
                <h1 className="h5 fw-bold mb-0">{data.judul}</h1>
                <span className={`badge-status ${status.jenis}`}>{status.label}</span>
              </div>

              <p className="teks-lembut small mb-1">
                {data.mapel_nama ?? '—'} · {data.kelas_nama ?? '—'} · {data.soal?.length ?? 0} soal ·{' '}
                {formatDurasi(data.durasi_menit)}
              </p>
              <p className="teks-lembut small mb-3">
                Jadwal {formatJadwal(data.mulai_at)} s.d. {formatJadwal(data.selesai_at)}
              </p>

              {data.deskripsi !== null && data.deskripsi !== '' && <p>{data.deskripsi}</p>}

              {sebagaiGuru && (
                <p className="teks-lembut small">
                  Kamu melihat versi guru: kunci jawaban dan pembahasan ikut ditampilkan.
                </p>
              )}

              <div className="d-flex flex-column gap-3 mt-3">
                {(data.soal ?? []).map((soal, index) => (
                  <section key={soal.id} className="kartu-soal p-3" aria-label={`Soal nomor ${index + 1}`}>
                    <div className="d-flex align-items-baseline gap-2 mb-2">
                      <h2 className="h6 fw-bold mb-0">Soal {index + 1}</h2>
                      <span className="badge-status lembut">{soal.tipe_label}</span>
                      <span className="teks-lembut small ms-auto">skor {soal.skor}</span>
                    </div>

                    <RendererSoal
                      tipe={soal.tipe}
                      konten={soal.konten}
                      kunci={soal.kunci ?? {}}
                      nama={`kuis-${data.id}-soal-${soal.id}`}
                      tampilkanKunci={sebagaiGuru}
                      dinonaktifkan
                    />

                    {sebagaiGuru && soal.pembahasan !== null && soal.pembahasan !== undefined && soal.pembahasan !== '' && (
                      <p className="teks-lembut small mb-0 mt-2">
                        <strong>Pembahasan:</strong> {soal.pembahasan}
                      </p>
                    )}
                  </section>
                ))}
              </div>

              {data.soal === undefined && sebagaiGuru && (
                <p className="text-body-secondary mt-3">
                  Susunan soal belum dimuat. Buka lewat halaman kuis untuk menyusun soal.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
