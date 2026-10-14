/**
 * Detail kuis (slice 03) sekaligus tempat mengelola satu ulangan.
 *
 * Guru melihat kunci + pembahasan dan **setelan ulangan kuis ini** (proteksi,
 * percobaan ulang, peringkat, layar guru) langsung di halaman ini — tidak lagi
 * lewat halaman /pengaturan dengan memilih ulangan dulu. Sejak 14 Oktober 2026
 * setelan itu sendiri diringkas jadi **satu tombol** di baris aksi (`SetelanUlangan`)
 * yang membuka panel terstruktur, sehingga halaman ini tetap ringkas. Murid
 * hanya melihat soal: server memang tidak pernah mengirimkan kuncinya.
 */
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  RUTE,
  kunciKuisSah,
  ruteKerjakanKuis,
  ruteKoreksiKuis,
  ruteTimKuis,
  ruteLayarKuis,
  ruteLaporanKuis,
  ruteMonitorKuis,
  rutePeringkat,
} from '../../routes.js'
import { useAuthStore } from '../auth/authStore.js'
import { useHanyaMelihat } from '../../shared/akses.js'
import CatatanHanyaMelihat from '../../shared/ui/CatatanHanyaMelihat.jsx'
import { IkonPanahKiri } from '../../icons.jsx'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import RendererSoal from '../question/render/RendererSoal.jsx'
import SetelanUlangan from './SetelanUlangan.jsx'
import TautanSiswa from './TautanSiswa.jsx'
import { ambilKuisDetail } from './api.js'
import { urlEksporNilai } from '../report/api.js'
import { formatDurasi, formatJadwal, statusTampilan } from './status.js'

export default function HalamanKuisDetail() {
  const { slug } = useParams()
  const kunci = kunciKuisSah(slug)
  const user = useAuthStore((s) => s.user)
  const sebagaiGuru = user?.role === 'guru' || user?.role === 'admin'
  // Kepala sekolah membuka halaman ini dengan kunci jawaban ikut tampil, tetapi
  // tanpa satu pun alat penyuntingan: setelan ulangan, koreksi, tim, dan layar
  // kelas semuanya ditolak server untuk perannya.
  const hanyaLihat = useHanyaMelihat()

  const kuis = useQuery({
    queryKey: ['kuis', kunci, sebagaiGuru ? 'guru' : 'murid'],
    queryFn: () => ambilKuisDetail(kunci),
    enabled: kunci !== '',
  })

  const data = kuis.data
  const status = data === undefined ? null : statusTampilan(data)

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <div className="kartu-soft p-4 p-md-5">
          <TombolTaut varian="tepi" ikon={IkonPanahKiri} className="mb-3" to={RUTE.kuis}>
            Kembali ke daftar kuis
          </TombolTaut>

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
                {data.mapel_nama ?? '—'} · {data.kelas_nama ?? '—'} ·{' '}
                {data.soal?.length ?? data.jumlah_soal ?? 0} soal · {formatDurasi(data.durasi_menit)}
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

              {!sebagaiGuru && data.sedang_berjalan && (
                <div className="mb-2">
                  <TombolTaut to={ruteKerjakanKuis(data.id)}>Kerjakan sekarang</TombolTaut>
                </div>
              )}              <div className="d-flex flex-wrap gap-2 my-3">
                {/*
                  Tautan siswa di baris aksi paling atas (14 Oktober 2026):
                  halaman ini yang dibuka guru setelah kuisnya terbit, dan
                  tautan untuk dibagikan ke grup kelas harus ada di sini — bukan
                  hanya di langkah publikasi editor yang panjang.
                */}
                {sebagaiGuru && <TautanSiswa slug={data.slug} status={data.status} />}
                <TombolTaut varian="tepi" to={rutePeringkat(data.slug)}>Peringkat</TombolTaut>
                {sebagaiGuru && (
                  <TombolTaut varian="tepi" to={ruteLaporanKuis(data.slug)}>Laporan per tema</TombolTaut>
                )}
                {sebagaiGuru && (
                  <a className="btn btn-tepi btn-sedang" href={urlEksporNilai(data.slug)}>
                    Unduh nilai (CSV)
                  </a>
                )}
                {sebagaiGuru && !hanyaLihat && (
                  <TombolTaut varian="tepi" to={ruteKoreksiKuis(data.slug)}>Koreksi manual</TombolTaut>
                )}
                {sebagaiGuru && (
                  <TombolTaut varian="tepi" to={ruteMonitorKuis(data.slug)}>Monitor Ulangan</TombolTaut>
                )}
                {sebagaiGuru && !hanyaLihat && (
                  <TombolTaut varian="tepi" to={ruteTimKuis(data.slug)}>Kelola tim</TombolTaut>
                )}
                {sebagaiGuru && !hanyaLihat && (
                  <TombolTaut varian="tepi" to={ruteLayarKuis(data.slug)}>Layar kelas</TombolTaut>
                )}
                {/*
                  Setelan ulangan = SATU tombol (14 Oktober 2026): isinya yang
                  dulu menggelar belasan saklar langsung di halaman ini kini
                  terbuka di panel samping. Halaman detail kuis kembali jadi
                  ringkasan + jalan masuk, bukan halaman konfigurasi.
                */}
                {sebagaiGuru && !hanyaLihat && <SetelanUlangan kuisId={data.id} />}
              </div>

              {hanyaLihat && (
                <CatatanHanyaMelihat>
                  Setelan ulangan disusun guru pemilik kuis ini — dari proteksi anti-cheat sampai
                  batas percobaan. Kepala sekolah memantau jalannya ulangan dan membaca hasilnya.
                </CatatanHanyaMelihat>
              )}

              {/* Murid tidak menerima daftar soal sebelum mengerjakan (K-02):
                  isi ulangan hanya keluar lewat attempt yang sudah dimulai. */}
              {!sebagaiGuru && (
                <p className="teks-lembut small mt-3 mb-0">
                  Soal muncul saat kamu menekan “Kerjakan sekarang”, dalam urutan yang diacak server.
                </p>
              )}

              <div className="d-flex flex-column gap-3 mt-3">
                {(sebagaiGuru ? (data.soal ?? []) : []).map((soal, index) => (
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
