/**
 * Halaman progres tema murid (slice 05).
 *
 * Menampilkan pemahaman per tema + latihan remedial otomatis dari tema lemah.
 * Remedial hanya merekomendasikan soal; nilai asli tidak pernah berubah.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import { RUTE } from '../../routes.js'
import { ambilProgresSaya } from './api.js'
import { kelasLencana, ringkasTingkat, tingkatTampilan } from './tampilan.js'

export default function HalamanProgresTema() {
  const progres = useQuery({ queryKey: ['progres-saya'], queryFn: ambilProgresSaya })
  const data = progres.data

  if (progres.isLoading) {
    return <p className="text-body-secondary">Menyusun progres…</p>
  }

  if (progres.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Progres belum bisa dibuka">
        <p className="mb-0">Halaman ini khusus murid yang sudah masuk.</p>
      </Banner>
    )
  }

  const ringkasan = ringkasTingkat(data.tema)

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h5 fw-bold mb-1">Progres Tema · {data.nama}</h1>
          <p className="teks-lembut small mb-3">
            Dihitung dari nilai asli. Paham ≥ {data.ambang.ambang_paham}% dan mulai paham ≥{' '}
            {data.ambang.ambang_mulai_paham}%; tema dinilai setelah {data.ambang.data_minimum} soal.
          </p>

          <div className="d-flex flex-wrap gap-2 mb-4">
            <span className="badge-status sukses">{ringkasan.paham} paham</span>
            <span className="badge-status peringatan">{ringkasan.mulai_paham} mulai paham</span>
            <span className="badge-status salah">{ringkasan.belum_paham} belum paham</span>
            <span className="badge-status lembut">{ringkasan.data_belum_cukup} belum cukup data</span>
          </div>

          {data.tema.length === 0 && (
            <p className="text-body-secondary">
              Belum ada tema yang bisa dinilai. Kerjakan ulangan bertag dulu ya.
            </p>
          )}

          <div className="d-flex flex-column gap-3">
            {data.tema.map((tema) => {
              const tampil = tingkatTampilan(tema.tingkat)

              return (
                <div key={tema.tag_id} className="kartu-lembut p-3">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="fw-semibold me-auto">{tema.tag_nama}</span>
                    <span className={tampil.kelas}>{tampil.label}</span>
                  </div>
                  <div className="bar-tema my-2" role="img" aria-label={`${tema.tag_nama}: ${tema.persen}%`}>
                    <span style={{ width: `${Math.max(0, Math.min(100, tema.persen))}%` }} />
                  </div>
                  <span className="teks-lembut small">
                    {tema.jumlah_benar}/{tema.jumlah_soal} soal benar ({tema.persen}%)
                  </span>
                </div>
              )
            })}
          </div>

          <h2 className="h6 fw-bold text-uppercase teks-lembut mt-4 mb-2">Latihan remedial</h2>

          {!data.remedial.diaktifkan && (
            <p className="text-body-secondary">
              Remedial sedang dimatikan guru. Nilaimu tetap tersimpan dan bisa dilihat.
            </p>
          )}

          {data.remedial.diaktifkan && data.remedial.soal.length === 0 && (
            <p className="text-body-secondary">
              Belum ada tema yang perlu diulang. Pertahankan ya!
            </p>
          )}

          {data.remedial.diaktifkan && data.remedial.soal.length > 0 && (
            <>
              <p className="teks-lembut small">
                Soal-soal ini diambil dari tema yang masih lemah. Ini latihan tambahan — nilai aslimu
                tidak berubah.
              </p>
              <div className="d-flex flex-column gap-2">
                {data.remedial.soal.map((soal) => (
                  <div key={soal.id} className="kartu-soal p-3">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <span className="badge-status lembut">{soal.tipe_label}</span>
                      <span className="badge-status info">{soal.tag_nama ?? 'Tanpa tema'}</span>
                      <span className="teks-lembut small ms-auto">skor {soal.skor}</span>
                    </div>
                    <p className="mb-0 mt-2">{soal.teks}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="d-flex flex-wrap gap-2 mt-4">
            <Link className="btn btn-tepi" to={RUTE.badge}>
              Lencana saya
            </Link>
            <span className={kelasLencana(data.badge.badge[0]?.lencana)}>
              {data.badge.jumlah_lencana} mapel berlencana
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
