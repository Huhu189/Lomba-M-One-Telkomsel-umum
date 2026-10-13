/**
 * Beranda admin sekolah — dasbor skala sekolah (14 Okt 2026).
 *
 * Sebelum ini admin memakai beranda guru apa adanya, padahal pertanyaan admin
 * berbeda: bukan "kuis apa yang harus saya pantau", melainkan "bagaimana
 * keadaan sekolah ini sekarang" — berapa murid & guru yang benar-benar aktif,
 * berapa ulangan berjalan, kelas mana yang kosong, dan apa yang baru saja
 * berubah (jejak audit).
 *
 * Satu panggilan (`/v1/admin/monitor`) mengisi seluruh halaman, jadi tidak ada
 * sepuluh permintaan berbeda yang saling menunggu.
 */
import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  IkonCentang,
  IkonGrafik,
  IkonJam,
  IkonKisi,
  IkonMata,
  IkonMuatUlang,
  IkonPeringatan,
  IkonPerisai,
  IkonSurat,
  IkonPengguna,
} from '../../icons.jsx'
import { RUTE, ruteMonitorKuis } from '../../routes.js'
import Banner from '../../shared/ui/Banner.jsx'
import HeaderHalaman from '../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../shared/ui/KosongData.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import TabelData from '../../shared/ui/TabelData.jsx'
import { Tombol, TombolTaut } from '../../shared/ui/Tombol.jsx'
import { namaDepan, sapaanWaktu, tanggalPanjang } from '../home/Beranda.jsx'
import { ambilMonitorSekolah } from './api.js'
import { perluPerhatianSekolah, ringkasKelas, urutKelas, waktuLalu } from './dasborAdmin.js'

/** Ikon tiap jenis item "perlu perhatian". */
const IKON_PERHATIAN = {
  mengerjakan: IkonJam,
  koreksi: IkonCentang,
  verifikasi: IkonSurat,
  ditangguhkan: IkonPerisai,
  kejadian: IkonPeringatan,
}

/** @param {{ user: import('../auth/authStore.js').DataUser }} props */
export default function BerandaAdmin({ user }) {
  const monitor = useQuery({
    queryKey: ['admin-monitor'],
    queryFn: ambilMonitorSekolah,
    // Dasbor adalah halaman yang dibiarkan terbuka di ruang guru; angka "sedang
    // mengerjakan" harus ikut bergerak tanpa admin menekan muat ulang.
    refetchInterval: 30_000,
  })

  useEffect(() => {
    document.title = 'Dasbor Sekolah'
  }, [])

  const data = monitor.data

  const perhatian = useMemo(
    () =>
      data === undefined
        ? []
        : perluPerhatianSekolah({ murid: data.murid, guru: data.guru, kuis: data.kuis }),
    [data],
  )

  const daftarKelas = useMemo(() => (data === undefined ? [] : urutKelas(data.kelas.daftar)), [data])
  const kapasitas = useMemo(() => ringkasKelas(daftarKelas), [daftarKelas])

  // Tautan tiap item perhatian: yang butuh tindakan langsung menuju halaman yang
  // memang bisa menindaklanjutinya, bukan sekadar daftar kuis.
  const ulanganBerjalan = data?.kuis_berjalan[0] ?? null
  const tautanPerhatian = {
    mengerjakan: ulanganBerjalan === null ? RUTE.kuis : ruteMonitorKuis(ulanganBerjalan.slug),
    koreksi: RUTE.kuis,
    verifikasi: `${RUTE.adminAkun}?status=aktif`,
    ditangguhkan: `${RUTE.adminAkun}?status=suspended`,
    kejadian: ulanganBerjalan === null ? RUTE.kuis : ruteMonitorKuis(ulanganBerjalan.slug),
  }

  return (
    <div className="muncul">
      <HeaderHalaman
        judul={`${sapaanWaktu()}, ${namaDepan(user.name)}!`}
        jejak={
          data === undefined
            ? 'admin sekolah'
            : `admin · ${data.sekolah.nama}${data.sekolah.tahun_ajaran ? ` · ${data.sekolah.tahun_ajaran}` : ''} · ${tanggalPanjang()}`
        }
        deskripsi="Keadaan sekolah hari ini, dari data yang benar-benar tersimpan."
      >
        <TombolTaut to={RUTE.adminAkun} varian="tepi" ikon={IkonPengguna}>
          Kelola akun
        </TombolTaut>
        {/**
         * Dulu di sini ada tombol "Buat kuis". Sejak kepala sekolah hanya
         * melihat data akademik, tombol itu pasti ditolak server — dan tombol
         * yang pasti gagal lebih buruk daripada tombol yang tidak ada.
         */}
      </HeaderHalaman>

      {monitor.isPending && <Skeleton judul baris={5} label="Memuat keadaan sekolah…" />}

      {monitor.isError && (
        <Banner jenis="salah" judul="Gagal memuat dasbor sekolah">
          <p className="mb-2">Periksa koneksi, lalu coba lagi. Angka yang tampil tidak boleh menebak.</p>
          <Tombol varian="tepi" ikon={IkonMuatUlang} onClick={() => monitor.refetch()}>
            Coba lagi
          </Tombol>
        </Banner>
      )}

      {data !== undefined && (
        <>
          <section className="mb-4" aria-labelledby="judul-perhatian-sekolah">
            <h2 id="judul-perhatian-sekolah" className="judul-bagian mb-3">
              Perlu perhatian
            </h2>

            {perhatian.length === 0 ? (
              <KosongData judul="Sekolah sedang tenang" ikon={IkonCentang}>
                Tidak ada ulangan berjalan, antrean koreksi, akun bermasalah, atau sinyal kecurangan
                hari ini.
              </KosongData>
            ) : (
              <div className="perhatian-daftar">
                {perhatian.map((item) => {
                  const Ikon = IKON_PERHATIAN[item.jenis]
                  return (
                    <article key={item.jenis} className={`perhatian-item ${item.jenis}`}>
                      <span className="perhatian-ikon" aria-hidden="true">
                        <Ikon size={22} />
                      </span>
                      <div>
                        <strong className="d-block">{item.judul}</strong>
                        <p className="teks-lembut small mb-2">{item.ket}</p>
                        <TombolTaut to={tautanPerhatian[item.jenis]} varian="tepi" ukuran="sedang">
                          {item.aksi}
                        </TombolTaut>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="mb-4" aria-labelledby="judul-angka-sekolah">
            <h2 id="judul-angka-sekolah" className="judul-bagian mb-3">
              Ringkasan sekolah
            </h2>
            <div className="row g-3">
              {data.angka.map((kartu) => (
                <div key={kartu.kunci} className="col-6 col-lg-3">
                  <div className="kartu-soft p-3 h-100">
                    <span className="teks-lembut small d-block">{kartu.label}</span>
                    <strong className="angka-nilai d-block">{kartu.nilai}</strong>
                    <span className="teks-lembut small">{kartu.ket}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="teks-lembut small mb-0 mt-2">
              “Online” berarti sesinya berdenyut dalam {data.menit_online} menit terakhir — bukan
              login terakhir. Guru yang meninggalkan tab terbuka pun terhitung.
            </p>
          </section>

          <section className="mb-4" aria-labelledby="judul-berjalan">
            <h2 id="judul-berjalan" className="judul-bagian mb-3">
              Ulangan berjalan
            </h2>

            {data.kuis_berjalan.length === 0 ? (
              <KosongData judul="Tidak ada ulangan berjalan" ikon={IkonMata}>
                Ulangan yang sudah terbit dan masuk jadwalnya akan muncul di sini beserta jumlah
                murid yang mengerjakan.
              </KosongData>
            ) : (
              <div className="d-flex flex-column gap-3">
                {data.kuis_berjalan.map((kuis) => (
                  <article key={kuis.id} className="kartu-soft p-3 d-flex flex-wrap align-items-center gap-3">
                    <div className="flex-grow-1" style={{ minWidth: '16rem' }}>
                      <strong className="d-block">{kuis.judul}</strong>
                      <span className="teks-lembut small">
                        {kuis.kelas_nama ?? '—'} · {kuis.peserta} peserta · {kuis.mengerjakan} sedang
                        mengerjakan · {kuis.selesai} selesai
                      </span>
                    </div>
                    <span className="badge-status sukses">{kuis.persen_selesai}% selesai</span>
                    <TombolTaut to={ruteMonitorKuis(kuis.slug)} varian="tepi" ukuran="sedang">
                      Buka monitor
                    </TombolTaut>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mb-4" aria-labelledby="judul-kelas">
            <h2 id="judul-kelas" className="judul-bagian mb-3">
              Keadaan kelas
            </h2>

            {daftarKelas.length === 0 ? (
              <KosongData
                judul="Belum ada kelas"
                ikon={IkonKisi}
                aksi={
                  <TombolTaut to={RUTE.kelas} varian="tepi">
                    Lihat kelas
                  </TombolTaut>
                }
              >
                Kelas belum dibuat guru. Kepala sekolah memantau daftarnya dari halaman Kelas.
              </KosongData>
            ) : (
              <>
                <div className="kartu-soft p-0">
                  <TabelData
                    label="Keadaan tiap kelas"
                    kolom={[
                      { kunci: 'nama', judul: 'Kelas', sel: (kelas) => kelas.nama },
                      {
                        kunci: 'jumlah_murid',
                        judul: 'Murid',
                        sel: (kelas) => <strong>{kelas.jumlah_murid}</strong>,
                      },
                      {
                        kunci: 'jumlah_kuis_terbit',
                        judul: 'Kuis terbit',
                        sel: (kelas) => kelas.jumlah_kuis_terbit,
                      },
                    ]}
                    baris={daftarKelas}
                    kunciBaris={(kelas) => kelas.id}
                  />
                </div>
                <p className="teks-lembut small mb-0 mt-2">
                  {kapasitas.jumlahMurid} murid di {daftarKelas.length} kelas
                  {kapasitas.kelasKosong > 0 ? ` · ${kapasitas.kelasKosong} kelas masih kosong` : ''}
                  {kapasitas.terbesar !== null && kapasitas.terbesar.jumlah_murid > 0
                    ? ` · terbesar: ${kapasitas.terbesar.nama} (${kapasitas.terbesar.jumlah_murid} murid)`
                    : ''}
                </p>
              </>
            )}
          </section>

          <section className="mb-4" aria-labelledby="judul-akun-sekolah">
            <h2 id="judul-akun-sekolah" className="judul-bagian mb-3">
              Kehadiran akun
            </h2>
            <div className="row g-3">
              <div className="col-12 col-lg-6">
                <div className="kartu-soft p-3 h-100">
                  <span className="teks-lembut small d-block">Murid</span>
                  <strong className="angka-nilai d-block">{data.murid.aktif}</strong>
                  <p className="teks-lembut small mb-2">
                    akun aktif dari {data.murid.total} murid terdaftar · {data.murid.online} online
                    {data.murid.belum_verifikasi > 0
                      ? ` · ${data.murid.belum_verifikasi} belum terverifikasi`
                      : ''}
                    {data.murid.ditangguhkan > 0 ? ` · ${data.murid.ditangguhkan} ditangguhkan` : ''}
                  </p>
                  <TombolTaut to={RUTE.adminAkun} varian="tepi" ukuran="sedang">
                    Kelola akun murid
                  </TombolTaut>
                </div>
              </div>
              <div className="col-12 col-lg-6">
                <div className="kartu-soft p-3 h-100">
                  <span className="teks-lembut small d-block">Guru & admin</span>
                  <strong className="angka-nilai d-block">{data.guru.aktif}</strong>
                  <p className="teks-lembut small mb-2">
                    akun guru aktif dari {data.guru.total} guru · {data.guru.online} online ·{' '}
                    {data.guru.admin} admin sekolah
                  </p>
                  <TombolTaut to={`${RUTE.adminAkun}?peran=guru`} varian="tepi" ukuran="sedang">
                    Kelola akun guru
                  </TombolTaut>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="judul-aktivitas">
            <h2 id="judul-aktivitas" className="judul-bagian mb-3">
              Aktivitas terbaru
            </h2>

            {data.aktivitas.length === 0 ? (
              <KosongData judul="Belum ada catatan aktivitas" ikon={IkonGrafik}>
                Koreksi nilai dan perubahan akun muncul di sini — jejaknya append-only, jadi tidak
                bisa dihapus atau disunting.
              </KosongData>
            ) : (
              <div className="kartu-soft p-0">
                <TabelData
                  label="Catatan aktivitas terbaru"
                  kolom={[
                    { kunci: 'judul', judul: 'Aktivitas', sel: (baris) => baris.judul },
                    { kunci: 'pelaku', judul: 'Pelaku', sel: (baris) => baris.pelaku ?? '—' },
                    {
                      kunci: 'alasan',
                      judul: 'Alasan',
                      sel: (baris) => baris.alasan ?? '—',
                    },
                    {
                      kunci: 'waktu',
                      judul: 'Waktu',
                      sel: (baris) => waktuLalu(baris.waktu),
                    },
                  ]}
                  baris={data.aktivitas}
                  kunciBaris={(baris) => baris.id}
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
