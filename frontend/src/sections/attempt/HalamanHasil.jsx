/**
 * Halaman hasil ulangan (slice 04).
 *
 * Menampilkan skor dan status penilaian tiap soal, TIDAK menampilkan kunci
 * jawaban maupun pembahasan (server memang tidak mengirimkannya).
 */
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import { RUTE, rutePeringkat } from '../../routes.js'
import { ambilHasil } from './api.js'

/** @param {string} status */
function jenisBadge(status) {
  if (status === 'dinilai') return 'sukses'
  if (status === 'perlu_tinjau') return 'info'
  if (status === 'gagal') return 'peringatan'

  return 'lembut'
}

/** @param {import('./api.js').DataPerSoal} soal */
function labelBenar(soal) {
  if (soal.status !== 'dinilai' || soal.benar === null) return soal.status_label

  return soal.benar ? 'Benar' : 'Belum tepat'
}

export default function HalamanHasil() {
  const { attemptId } = useParams()
  const idAttempt = Number(attemptId)

  const hasilnya = useQuery({
    queryKey: ['attempt-hasil', idAttempt],
    queryFn: () => ambilHasil(idAttempt),
    enabled: Number.isInteger(idAttempt) && idAttempt > 0,
  })

  const hasil = hasilnya.data

  if (hasilnya.isLoading) {
    return <p className="text-body-secondary">Menghitung hasil…</p>
  }

  if (hasilnya.isError || hasil === undefined) {
    return (
      <Banner jenis="salah" judul="Hasil belum bisa dibuka">
        <p className="mb-3">Hasil ulangan ini tidak ditemukan atau bukan milikmu.</p>
        <TombolTaut to={RUTE.kuis} varian="tepi">
          Kembali ke daftar ulangan
        </TombolTaut>
      </Banner>
    )
  }

  const maksimal = hasil.skor_maksimal ?? 0
  const skor = hasil.skor ?? 0
  const persen = maksimal > 0 ? Math.round((skor / maksimal) * 100) : 0

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h5 fw-bold mb-1">{hasil.judul_kuis ?? 'Hasil ulangan'}</h1>
          <p className="teks-lembut small mb-4">
            {hasil.mapel_nama ?? '—'} · {hasil.jenis_label} · {hasil.status_label}
          </p>

          {hasil.terlambat && (
            <Banner jenis="peringatan" judul="Dikumpulkan setelah waktu habis">
              <p className="mb-0">Jawaban masih dinilai, tetapi waktunya lewat dari jadwal ulangan.</p>
            </Banner>
          )}

          <div className="d-flex flex-wrap align-items-end gap-4 mb-4">
            <div>
              <span className="teks-lembut small d-block">Skor</span>
              <span className="display-6 fw-bold">{skor}</span>
              <span className="teks-lembut"> / {maksimal}</span>
            </div>
            <div>
              <span className="teks-lembut small d-block">Benar</span>
              <span className="h4 fw-bold mb-0">
                {hasil.jumlah_benar} dari {hasil.jumlah_soal} soal
              </span>
            </div>
            <div>
              <span className="teks-lembut small d-block">Nilai</span>
              <span className="h4 fw-bold mb-0">{persen}</span>
            </div>
          </div>

          <ul className="list-unstyled teks-lembut small mb-4">
            <li>Dinilai otomatis: {hasil.ringkasan_penilaian.dinilai} soal</li>
            <li>Menunggu tinjauan guru: {hasil.ringkasan_penilaian.perlu_tinjau} soal</li>
            <li>Belum dijawab: {hasil.ringkasan_penilaian.belum_dijawab} soal</li>
            {hasil.ringkasan_penilaian.gagal > 0 && (
              <li>Gagal dinilai otomatis: {hasil.ringkasan_penilaian.gagal} soal (akan ditinjau guru)</li>
            )}
          </ul>

          <h2 className="h6 fw-bold text-uppercase teks-lembut mb-3">Rincian per soal</h2>

          <div className="d-flex flex-column gap-2">
            {hasil.per_soal.map((soal) => (
              <div key={soal.question_id} className="kartu-soal p-3">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="fw-semibold">Soal {soal.nomor}</span>
                  <span className="badge-status lembut">{soal.tipe_label}</span>
                  <span className={`badge-status ${jenisBadge(soal.status)}`}>{labelBenar(soal)}</span>
                  <span className="teks-lembut small ms-auto">
                    {soal.skor} / {soal.skor_maksimal} poin
                  </span>
                </div>
                {!soal.terjawab && <p className="teks-lembut small mb-0 mt-1">Tidak dijawab.</p>}
              </div>
            ))}
          </div>

          <p className="teks-lembut small mt-4">
            Kunci jawaban dan pembahasan tidak ditampilkan di sini; guru bisa membahasnya di kelas.
          </p>

          <div className="d-flex flex-wrap gap-2">
            <TombolTaut to={RUTE.kuis}>Kembali ke daftar ulangan</TombolTaut>
            <Link className="btn btn-tepi" to={rutePeringkat(hasil.quiz_id)}>
              Peringkat
            </Link>
            <Link className="btn btn-teks" to={RUTE.progresTema}>
              Progres tema
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
