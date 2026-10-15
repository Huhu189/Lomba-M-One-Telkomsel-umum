/**
 * Laporan pemahaman per tema untuk guru (slice 05).
 *
 * Setiap murid di kelas ditampilkan dengan tingkat per tema: paham, mulai
 * paham, belum paham, atau data belum cukup. Ambang dan jumlah data minimum
 * dibaca dari pengaturan tiga lapis, jadi guru bisa menyesuaikannya.
 */
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Banner from '../../../shared/ui/Banner.jsx'
import { RUTE, kunciKuisSah, rutePeringkat } from '../../../routes.js'
import { ambilLaporanKuis, ambilLaporanTamu } from '../api.js'
import { ringkasTingkat, tingkatTampilan } from '../tampilan.js'

/**
 * Waktu singkat untuk tabel laporan (zona waktu peramban, bahasa Indonesia).
 * @param {string} iso
 * @returns {string}
 */
function formatWaktu(iso) {
  const tanggal = new Date(iso)
  if (Number.isNaN(tanggal.getTime())) return '—'
  return tanggal.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

export default function HalamanLaporan() {
  const { slug } = useParams()
  const kunci = kunciKuisSah(slug)

  const laporan = useQuery({
    queryKey: ['laporan', kunci],
    queryFn: () => ambilLaporanKuis(kunci),
    enabled: kunci !== '',
  })

  // Hasil siswa tamu (mode tamu tanpa login) diambil terpisah: laporan kelas
  // sengaja tidak memuat tamu, dan panelnya hanya berguna setelah ada yang masuk.
  const tamu = useQuery({
    queryKey: ['laporan-tamu', kunci],
    queryFn: () => ambilLaporanTamu(kunci),
    enabled: kunci !== '',
  })

  const data = laporan.data

  if (laporan.isLoading) {
    return <p className="text-body-secondary">Menghitung laporan…</p>
  }

  if (laporan.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Laporan belum bisa dibuka">
        <p className="mb-3">Laporan ini khusus guru.</p>
        <Link className="btn btn-tepi" to={RUTE.kuis}>
          Kembali ke daftar kuis
        </Link>
      </Banner>
    )
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-10">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h5 fw-bold mb-1">Laporan Tema · {data.judul_kuis}</h1>
          <p className="teks-lembut small mb-3">
            {data.mapel_nama ?? '—'} · kelas {data.kelas_nama ?? '—'} ·{' '}
            <strong>hanya nilai asli</strong> yang dihitung. Paham ≥ {data.ambang.ambang_paham}%,
            mulai paham ≥ {data.ambang.ambang_mulai_paham}%, dan tema baru dinilai setelah{' '}
            {data.ambang.data_minimum} soal.
          </p>

          {data.murid.length === 0 && (
            <p className="text-body-secondary">Belum ada murid di kelas ini.</p>
          )}

          <div className="d-flex flex-column gap-3">
            {data.murid.map((baris) => {
              const ringkasan = ringkasTingkat(baris.tema)

              return (
                <section key={baris.murid_id} className="kartu-lembut p-3">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <h2 className="h6 fw-bold mb-0">{baris.nama}</h2>
                    {ringkasan.paham > 0 && (
                      <span className="badge-status sukses">{ringkasan.paham} paham</span>
                    )}
                    {ringkasan.mulai_paham > 0 && (
                      <span className="badge-status peringatan">{ringkasan.mulai_paham} mulai paham</span>
                    )}
                    {ringkasan.belum_paham > 0 && (
                      <span className="badge-status salah">{ringkasan.belum_paham} belum paham</span>
                    )}
                  </div>

                  {baris.tema.length === 0 && (
                    <p className="teks-lembut small mb-0">Belum ada jawaban bertag dari murid ini.</p>
                  )}

                  <div className="d-flex flex-column gap-2">
                    {baris.tema.map((tema) => {
                      const tampil = tingkatTampilan(tema.tingkat)

                      return (
                        <div key={tema.tag_id} className="d-flex flex-wrap align-items-center gap-2">
                          <span className="fw-semibold" style={{ minWidth: '10rem' }}>
                            {tema.tag_nama}
                          </span>
                          <span className={tampil.kelas}>{tampil.label}</span>
                          <span className="teks-lembut small">
                            {tema.jumlah_benar}/{tema.jumlah_soal} benar ({tema.persen}%)
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>

          {tamu.data !== undefined && (tamu.data.izin_tamu || tamu.data.jumlah > 0) && (
            <section className="mt-5" aria-labelledby="judul-tamu">
              <h2 id="judul-tamu" className="h6 fw-bold mb-1">
                Siswa tamu {tamu.data.jumlah > 0 && <span className="badge-status lembut">{tamu.data.jumlah} hasil</span>}
              </h2>
              <p className="teks-lembut small">
                Tamu masuk tanpa akun — cukup nama — lewat pengaturan “Izinkan siswa tamu”. Mereka tidak
                punya kelas dan tidak ikut peringkat kelas, jadi nilainya hanya muncul di sini.
                {tamu.data.izin_tamu
                  ? ' Pintu tamu untuk kuis ini masih terbuka.'
                  : ' Pintu tamu untuk kuis ini sudah ditutup (hasil lama tetap tersimpan).'}
              </p>

              {tamu.data.jumlah === 0 ? (
                <p className="text-body-secondary mb-0">Belum ada siswa tamu yang mengerjakan.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th scope="col">Nama tamu</th>
                        <th scope="col">Skor</th>
                        <th scope="col">Benar</th>
                        <th scope="col">Percobaan</th>
                        <th scope="col">Dikumpulkan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tamu.data.tamu.map((baris) => (
                        <tr key={baris.attempt_id}>
                          <td className="fw-semibold">{baris.nama}</td>
                          <td>
                            {baris.skor} / {baris.skor_maksimal} ({baris.persen}%)
                          </td>
                          <td>
                            {baris.jumlah_benar} / {baris.jumlah_soal}
                          </td>
                          <td>ke-{baris.attempt_no}</td>
                          <td>{baris.dikumpulkan_at === null ? 'belum dikumpulkan' : formatWaktu(baris.dikumpulkan_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <div className="d-flex flex-wrap gap-2 mt-4">
            <Link className="btn btn-tepi" to={rutePeringkat(kunci)}>
              Lihat peringkat
            </Link>
            <Link className="btn btn-teks" to={`${RUTE.kuis}/${kunci}`}>
              Detail kuis
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
