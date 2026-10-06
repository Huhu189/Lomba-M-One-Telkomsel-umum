/**
 * Halaman kuis untuk murid (slice 03) — hanya kuis terbit kelasnya yang
 * dikirim server, tanpa kunci jawaban. Pengerjaan penuh menyusul di slice 04.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { RUTE } from '../../routes.js'
import { ambilKuis } from './api.js'
import { formatDurasi, formatJadwal, statusTampilan } from './status.js'

export default function HalamanKuisMurid() {
  const daftarKuis = useQuery({ queryKey: ['kuis'], queryFn: ambilKuis })

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h5 fw-bold mb-1">Ulangan Saya</h1>
          <p className="text-body-secondary">
            Kuis muncul di sini setelah gurumu menerbitkannya. Klik untuk melihat soal yang akan diujikan.
          </p>

          {daftarKuis.isLoading && <p className="text-body-secondary">Memuat ulangan…</p>}
          {daftarKuis.isError && <p className="status-salah">Gagal memuat ulangan.</p>}

          {daftarKuis.data && daftarKuis.data.length === 0 && (
            <p className="text-body-secondary">
              Belum ada ulangan untuk kelasmu. Tenang, gurumu akan segera menerbitkannya.
            </p>
          )}

          <div className="d-flex flex-column gap-3">
            {(daftarKuis.data ?? []).map((kuis) => {
              const status = statusTampilan(kuis)

              return (
                <div key={kuis.id} className="kartu-soal p-3">
                  <div className="d-flex flex-wrap align-items-baseline gap-2">
                    <h2 className="h6 fw-bold mb-0">{kuis.judul}</h2>
                    <span className={`badge-status ${status.jenis}`}>{status.label}</span>
                  </div>

                  <p className="teks-lembut small mb-1">
                    {kuis.mapel_nama ?? '—'} · {kuis.jumlah_soal ?? 0} soal · {formatDurasi(kuis.durasi_menit)}
                  </p>
                  <p className="teks-lembut small mb-2">
                    Jadwal {formatJadwal(kuis.mulai_at)} s.d. {formatJadwal(kuis.selesai_at)}
                  </p>

                  {kuis.deskripsi !== null && kuis.deskripsi !== '' && (
                    <p className="mb-2">{kuis.deskripsi}</p>
                  )}

                  <Link className="btn btn-sm btn-tepi" to={`${RUTE.kuis}/${kuis.id}`}>
                    Lihat soal
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
