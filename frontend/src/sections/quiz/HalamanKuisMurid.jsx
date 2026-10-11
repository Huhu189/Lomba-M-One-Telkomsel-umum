/**
 * Halaman kuis untuk murid (slice 03) — hanya kuis terbit kelasnya yang
 * dikirim server, tanpa kunci jawaban dan tanpa daftar soal (K-02).
 *
 * Siswa tamu (mode tamu tanpa login) memakai halaman yang sama: server hanya
 * mengirim kuis yang dibuka guru untuk tamu, dan di sini judulnya disesuaikan
 * supaya jelas bahwa yang tampil bukan kuis kelasnya.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../auth/authStore.js'
import { RUTE, ruteKerjakanKuis, rutePeringkat } from '../../routes.js'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import { ambilKuis } from './api.js'
import { formatDurasi, formatJadwal, statusTampilan } from './status.js'

export default function HalamanKuisMurid() {
  const tamu = Boolean(useAuthStore((s) => s.user?.isTamu))
  const daftarKuis = useQuery({ queryKey: ['kuis'], queryFn: ambilKuis })

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <div className="kartu-soft p-4 p-md-5">
          <h1 className="h5 fw-bold mb-1">{tamu ? 'Ulangan Tamu' : 'Ulangan Saya'}</h1>
          <p className="text-body-secondary">
            {tamu
              ? 'Kuis yang dibuka gurumu untuk siswa tamu muncul di sini. Namamu yang tadi kamu tulis dipakai sebagai identitas hasil ulangan.'
              : 'Kuis muncul di sini setelah gurumu menerbitkannya. Soalnya baru terbuka saat kamu menekan “Kerjakan sekarang”.'}
          </p>

          {daftarKuis.isLoading && <p className="text-body-secondary">Memuat ulangan…</p>}
          {daftarKuis.isError && <p className="status-salah">Gagal memuat ulangan.</p>}

          {daftarKuis.data && daftarKuis.data.length === 0 && (
            <p className="text-body-secondary">
              {tamu
                ? 'Belum ada ulangan yang dibuka untuk tamu. Tanyakan ke gurumu, atau minta tautan yang benar.'
                : 'Belum ada ulangan untuk kelasmu. Tenang, gurumu akan segera menerbitkannya.'}
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

                  <div className="d-flex flex-wrap gap-2">
                    {kuis.sedang_berjalan && (
                      <TombolTaut to={ruteKerjakanKuis(kuis.id)}>Kerjakan sekarang</TombolTaut>
                    )}
                    <TombolTaut varian="tepi" to={`${RUTE.kuis}/${kuis.id}`}>
                      Lihat detail
                    </TombolTaut>
                    {/* Peringkat kelas tidak dibuka untuk tamu (nama murid kelas
                        bukan untuk orang tanpa akun), jadi tautannya tidak ada. */}
                    {!tamu && (
                      <TombolTaut varian="teks" to={rutePeringkat(kuis.id)}>Peringkat</TombolTaut>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
