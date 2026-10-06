/**
 * Halaman badge murid (slice 05): lencana per mapel dari rata-rata nilai asli.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import { RUTE } from '../../routes.js'
import { ambilBadgeSaya } from './api.js'
import { kelasLencana } from './tampilan.js'

export default function HalamanBadge() {
  const badge = useQuery({ queryKey: ['badge-saya'], queryFn: ambilBadgeSaya })
  const data = badge.data

  if (badge.isLoading) {
    return <p className="text-body-secondary">Membuka kotak lencana…</p>
  }

  if (badge.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Lencana belum bisa dibuka">
        <p className="mb-0">Halaman ini khusus murid yang sudah masuk.</p>
      </Banner>
    )
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h5 fw-bold mb-1">Lencana Saya</h1>
          <p className="teks-lembut small mb-3">
            Dihitung dari rata-rata <strong>nilai asli</strong> tiap mapel: emas ≥ 90, perak ≥ 75,
            perunggu ≥ 60. Nilai ulangan ulang tidak dihitung supaya lencanamu tetap jujur.
          </p>

          <p className="mb-4">
            <span className="lencana lencana-pendukung">{data.jumlah_lencana} mapel berlencana</span>
          </p>

          {data.badge.length === 0 && (
            <p className="text-body-secondary">
              Belum ada nilai. Kerjakan ulanganmu dulu, lencana akan muncul di sini.
            </p>
          )}

          <div className="d-flex flex-column gap-3">
            {data.badge.map((satu) => (
              <div
                key={satu.mapel_id ?? satu.mapel_nama}
                className="kartu-lembut p-3 d-flex flex-wrap align-items-center gap-3"
              >
                <div className="me-auto">
                  <span className="fw-semibold d-block">{satu.mapel_nama}</span>
                  <span className="teks-lembut small">
                    {satu.jumlah_ulangan} ulangan · rata-rata {satu.rata_rata}%
                  </span>
                </div>
                <span className={kelasLencana(satu.lencana)}>{satu.lencana.label}</span>
              </div>
            ))}
          </div>

          <div className="d-flex flex-wrap gap-2 mt-4">
            <Link className="btn btn-tepi" to={RUTE.progresTema}>
              Lihat progres tema
            </Link>
            <Link className="btn btn-teks" to={RUTE.kuis}>
              Ulangan saya
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
