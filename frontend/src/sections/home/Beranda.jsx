/**
 * Beranda. Untuk tamu: hero + nilai jual. Untuk pengguna yang sudah masuk:
 * beranda **berbasis tugas** (papan desain 2) — apa yang perlu perhatian hari
 * ini, angka ringkas, lalu jadwal kuis. Sebelumnya halaman ini hanya
 * menampilkan peran, status akun, dan kalimat "akan muncul di sini" (temuan 04),
 * sehingga tidak membantu tugas apa pun.
 *
 * Murid mendapat versi ringkas: ulangan yang sedang berjalan atau berikutnya,
 * plus pintasan ke materi, progres tema, dan lencana.
 *
 * (Akun belum terverifikasi tidak pernah sampai ke sini: backend menolaknya di
 * jalur login & sesi.)
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  IkonBendera,
  IkonBintang,
  IkonCentang,
  IkonGrafik,
  IkonBuku,
  IkonJam,
  IkonPerisai,
  IkonTambah,
} from '../../icons.jsx'
import { RUTE, ruteKerjakanKuis, ruteKoreksiKuis, ruteKuisDetail, ruteMonitorKuis } from '../../routes.js'
import HeaderHalaman from '../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../shared/ui/KosongData.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import { HiasanLatar } from '../../shared/ui/Maskot.jsx'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import { useAuthStore } from '../auth/authStore.js'
import { antreanModerasi } from '../avatar/api.js'
import { ambilKuis } from '../quiz/api.js'
import { formatJadwal, statusTampilan } from '../quiz/status.js'
import { ambilAntreanKoreksi } from '../scoring/api.js'
import { ambilKelas, ambilMurid } from '../school/api.js'
import { angkaBeranda, bagiJadwal, perluPerhatian } from './dashboard.js'

const fitur = [
  {
    Ikon: IkonBintang,
    kelas: '',
    judul: 'Soal besar dan jelas',
    isi: 'Tampilan ramah mata dan jari anak SD, nyaman di HP maupun laptop.',
  },
  {
    Ikon: IkonJam,
    kelas: 'hangat',
    judul: 'Waktu selalu terlihat',
    isi: 'Sisa waktu mengerjakan tampil jelas dan dihitung server agar adil untuk semua.',
  },
  {
    Ikon: IkonPerisai,
    kelas: 'lembut',
    judul: 'Aman dan adil',
    isi: 'Kunci jawaban tidak pernah dikirim ke perangkat murid.',
  },
]

/**
 * Sapaan sesuai jam.
 * @param {Date} [sekarang]
 */
export function sapaanWaktu(sekarang = new Date()) {
  const jam = sekarang.getHours()
  if (jam < 11) return 'Selamat pagi'
  if (jam < 15) return 'Selamat siang'
  if (jam < 18) return 'Selamat sore'
  return 'Selamat malam'
}

const FORMAT_TANGGAL = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Tanggal hari ini dalam bahasa Indonesia ("Sabtu, 10 Oktober 2026").
 * @param {Date} [sekarang]
 * @returns {string}
 */
export function tanggalPanjang(sekarang = new Date()) {
  return FORMAT_TANGGAL.format(sekarang)
}

/**
 * Nama depan untuk sapaan (nama panjang tidak perlu diulang penuh).
 * @param {string} nama
 * @returns {string}
 */
export function namaDepan(nama) {
  return nama.trim().split(/\s+/)[0] ?? ''
}

/** @param {import('../quiz/api.js').DataKuis} kuis */
function tautanJadwal(kuis) {
  if (kuis.sedang_berjalan) return { to: ruteMonitorKuis(kuis.id), label: 'Pantau' }
  if (kuis.status !== 'publikasi') return { to: RUTE.kuis, label: 'Lanjutkan' }
  return { to: ruteKuisDetail(kuis.id), label: 'Lihat detail' }
}

function BerandaTamu() {
  return (
    <div className="muncul">
      <section className="hero mb-4">
        <HiasanLatar className="auth-panel-hias" />
        <div className="position-relative">
          <h1>Belajar seru, ulangan jadi lebih tenang.</h1>
          <p className="mb-4">
            Kerjakan ulangan online dari sekolah dengan tampilan yang jelas, waktu yang adil, dan
            hasil yang cepat kamu lihat.
          </p>
          <div className="d-flex flex-wrap gap-3">
            <TombolTaut to={RUTE.masuk} besar>
              Masuk
            </TombolTaut>
            <TombolTaut to={RUTE.daftar} varian="tepi" besar>
              Daftar murid
            </TombolTaut>
          </div>
        </div>
      </section>

      <div className="row g-3 g-lg-4">
        {fitur.map(({ Ikon, kelas, judul, isi }) => (
          <div key={judul} className="col-md-4">
            <article className="kartu-soft fitur">
              <span className={`fitur-ikon ${kelas}`.trim()}>
                <Ikon size={26} />
              </span>
              <h2>{judul}</h2>
              <p className="teks-lembut mb-0">{isi}</p>
            </article>
          </div>
        ))}
      </div>
    </div>
  )
}

/** @param {{ user: import('../auth/authStore.js').DataUser }} props */
function BerandaGuru({ user }) {
  const [tab, setTab] = useState(/** @type {'hari'|'minggu'} */ ('hari'))

  const kuis = useQuery({ queryKey: ['kuis'], queryFn: ambilKuis })
  const kelas = useQuery({ queryKey: ['kelas'], queryFn: ambilKelas })
  const murid = useQuery({ queryKey: ['murid', null, 1], queryFn: () => ambilMurid(null, 1) })
  const avatar = useQuery({ queryKey: ['avatar-moderasi'], queryFn: antreanModerasi })

  // Diringkas lewat useMemo supaya daftar dari React Query tidak membuat
  // perhitungan di bawah dihitung ulang setiap render.
  const daftarKuis = useMemo(() => kuis.data ?? [], [kuis.data])
  const jadwal = bagiJadwal(daftarKuis)
  const baris = tab === 'hari' ? jadwal.hari : jadwal.minggu
  const kuisBerjalan = daftarKuis.find((satu) => satu.sedang_berjalan) ?? null

  // Antrean koreksi diambil untuk kuis terbit yang paling baru — endpointnya
  // memang per kuis, jadi satu panggilan saja (bukan semua kuis).
  const kuisUntukKoreksi = useMemo(
    () =>
      daftarKuis.find((satu) => satu.status === 'publikasi' && !satu.sedang_berjalan) ?? null,
    [daftarKuis],
  )
  const idUntukKoreksi = kuisUntukKoreksi?.id ?? 0
  const koreksi = useQuery({
    queryKey: ['koreksi-antrean', idUntukKoreksi],
    queryFn: () => ambilAntreanKoreksi(idUntukKoreksi),
    enabled: idUntukKoreksi > 0,
  })

  const antreanKoreksi =
    kuisUntukKoreksi !== null && koreksi.data !== undefined
      ? { judul: kuisUntukKoreksi.judul, jumlah: koreksi.data.jumlah }
      : null

  const perhatian = perluPerhatian({
    kuisBerjalan,
    koreksi: antreanKoreksi,
    laporanAvatar: (avatar.data ?? []).length,
  })

  const angka = angkaBeranda({
    kuis: daftarKuis,
    jumlahMurid: murid.data?.meta.total ?? 0,
    jumlahKelas: (kelas.data ?? []).length,
    menungguKoreksi: antreanKoreksi?.jumlah ?? 0,
  })

  const ikonPerhatian = { monitor: IkonJam, koreksi: IkonCentang, avatar: IkonBendera }
  const tautanPerhatian = {
    monitor: kuisBerjalan === null ? RUTE.kuis : ruteMonitorKuis(kuisBerjalan.id),
    koreksi: kuisUntukKoreksi === null ? RUTE.kuis : ruteKoreksiKuis(kuisUntukKoreksi.id),
    avatar: RUTE.avatar,
  }

  return (
    <div className="muncul">
      <HeaderHalaman
        judul={`${sapaanWaktu()}, ${namaDepan(user.name)}!`}
        jejak={`${user.role} · ${user.statusLabel} · ${tanggalPanjang()}`}
        deskripsi="Ini yang perlu perhatian hari ini."
      >
        <TombolTaut to={RUTE.imporMurid} varian="tepi">
          Impor murid
        </TombolTaut>
        <TombolTaut to={RUTE.kuis} ikon={IkonTambah}>
          Buat kuis
        </TombolTaut>
      </HeaderHalaman>

      <section className="mb-4" aria-labelledby="judul-perhatian">
        <h2 id="judul-perhatian" className="judul-bagian mb-3">
          Perlu perhatian
        </h2>

        {kuis.isPending && <Skeleton baris={2} label="Memuat keadaan hari ini…" />}

        {kuis.isSuccess && perhatian.length === 0 && (
          <KosongData judul="Tidak ada yang mendesak" ikon={IkonCentang}>
            Belum ada kuis berlangsung, antrean koreksi, atau laporan avatar yang menunggu.
            Susun kuis berikutnya kapan saja.
          </KosongData>
        )}

        {perhatian.length > 0 && (
          <div className="perhatian-daftar">
            {perhatian.map((item) => {
              const Ikon = ikonPerhatian[item.jenis]
              return (
                <article key={item.judul} className={`perhatian-item ${item.jenis}`}>
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

      <section className="mb-4" aria-labelledby="judul-angka">
        <h2 id="judul-angka" className="judul-bagian mb-3">
          Ringkasan
        </h2>
        <div className="row g-3">
          {angka.map((satu) => (
            <div key={satu.label} className="col-6 col-lg-3">
              <div className="kartu-soft p-3 h-100">
                <span className="teks-lembut small d-block">{satu.label}</span>
                <strong className="angka-nilai d-block">{satu.nilai}</strong>
                <span className="teks-lembut small">{satu.ket}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="judul-jadwal">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <h2 id="judul-jadwal" className="judul-bagian mb-0 me-auto">
            Jadwal kuis
          </h2>
          {/** @type {Array<['hari'|'minggu', string]>} */ ([
            ['hari', 'Hari ini'],
            ['minggu', 'Minggu ini'],
          ]).map(([nilai, label]) => (
            <button
              key={nilai}
              type="button"
              className="pil-saring"
              aria-pressed={tab === nilai}
              onClick={() => setTab(nilai)}
            >
              {label}
            </button>
          ))}
        </div>

        {kuis.isPending && <SkeletonKartuJadwal />}

        {kuis.isError && (
          <p className="status-salah">Gagal memuat jadwal kuis. Coba muat ulang halaman ini.</p>
        )}

        {kuis.isSuccess && baris.length === 0 && (
          <KosongData
            judul={tab === 'hari' ? 'Tidak ada kuis hari ini' : 'Tidak ada kuis minggu ini'}
            ikon={IkonBuku}
            aksi={
              <TombolTaut to={RUTE.kuis} ikon={IkonTambah}>
                Buat kuis
              </TombolTaut>
            }
          >
            Kuis yang dibuat sebagai draf juga muncul di sini supaya mudah dilanjutkan.
          </KosongData>
        )}

        {baris.length > 0 && (
          <div className="d-flex flex-column gap-3">
            {baris.map((satu) => {
              const status = statusTampilan(satu)
              const tautan = tautanJadwal(satu)
              return (
                <article
                  key={satu.id}
                  className="kartu-soft p-3 d-flex flex-wrap align-items-center gap-3"
                >
                  <div className="flex-grow-1" style={{ minWidth: '16rem' }}>
                    <strong className="d-block">{satu.judul}</strong>
                    <span className="teks-lembut small">
                      {satu.kelas_nama ?? '—'} · {formatJadwal(satu.mulai_at)} ·{' '}
                      {satu.jumlah_soal ?? 0} soal
                    </span>
                  </div>
                  <span className={`badge-status ${status.jenis}`}>{status.label}</span>
                  <TombolTaut to={tautan.to} varian="tepi" ukuran="sedang">
                    {tautan.label}
                  </TombolTaut>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function SkeletonKartuJadwal() {
  return (
    <div className="d-flex flex-column gap-3">
      <Skeleton baris={1} label="Memuat jadwal kuis…" />
      <Skeleton baris={1} />
    </div>
  )
}

/** @param {{ user: import('../auth/authStore.js').DataUser }} props */
function BerandaMurid({ user }) {
  const kuis = useQuery({ queryKey: ['kuis'], queryFn: ambilKuis })
  const daftar = kuis.data ?? []
  const berjalan = daftar.find((satu) => satu.sedang_berjalan) ?? null
  const berikutnya =
    daftar
      .filter((satu) => satu.status === 'publikasi' && !satu.sedang_berjalan && satu.mulai_at !== null)
      .sort((a, b) => new Date(a.mulai_at ?? 0).getTime() - new Date(b.mulai_at ?? 0).getTime())[0] ??
    null

  const pintasan = [
    { to: RUTE.materi, ikon: IkonBuku, label: 'Materi' },
    { to: RUTE.progresTema, ikon: IkonGrafik, label: 'Progres Tema' },
    { to: RUTE.badge, ikon: IkonBintang, label: 'Lencana' },
  ]

  return (
    <div className="muncul">
      <HeaderHalaman
        judul={`${sapaanWaktu()}, ${namaDepan(user.name)}!`}
        jejak={`${user.role} · ${tanggalPanjang()}`}
        deskripsi="Ulangan dan materimu ada di sini."
      />

      {kuis.isPending && <Skeleton judul baris={2} label="Memuat ulanganmu…" />}

      {kuis.isError && (
        <p className="status-salah">Gagal memuat ulangan. Coba muat ulang halaman ini.</p>
      )}

      {kuis.isSuccess && (
        <>
          <section className="mb-4" aria-labelledby="judul-berikutnya">
            <h2 id="judul-berikutnya" className="judul-bagian mb-3">
              {berjalan ? 'Sedang berlangsung' : 'Ulangan berikutnya'}
            </h2>

            {(berjalan ?? berikutnya) === null ? (
              <KosongData judul="Belum ada ulangan" ikon={IkonBuku}>
                Ulangan akan muncul di sini setelah gurumu menerbitkannya. Sementara itu, kamu bisa
                membaca materi atau melihat progresmu.
              </KosongData>
            ) : (
              <article className="kartu-soft p-3 p-md-4 d-flex flex-wrap align-items-center gap-3">
                <div className="flex-grow-1" style={{ minWidth: '16rem' }}>
                  <strong className="d-block judul-bagian">{(berjalan ?? berikutnya)?.judul}</strong>
                  <span className="teks-lembut">
                    {(berjalan ?? berikutnya)?.kelas_nama ?? '—'} ·{' '}
                    {formatJadwal((berjalan ?? berikutnya)?.mulai_at ?? null)} ·{' '}
                    {(berjalan ?? berikutnya)?.jumlah_soal ?? 0} soal
                  </span>
                </div>
                <TombolTaut
                  to={ruteKerjakanKuis((berjalan ?? berikutnya)?.id ?? 0)}
                  ukuran="sedang"
                >
                  {berjalan ? 'Lanjut mengerjakan' : 'Mulai kerjakan'}
                </TombolTaut>
              </article>
            )}
          </section>

          <section aria-labelledby="judul-pintasan">
            <h2 id="judul-pintasan" className="judul-bagian mb-3">
              Lanjut belajar
            </h2>
            <div className="row g-3">
              {pintasan.map(({ to, ikon: Ikon, label }) => (
                <div key={label} className="col-md-4">
                  <TombolTaut to={to} varian="tepi" ikon={Ikon} className="w-100 justify-content-center">
                    {label}
                  </TombolTaut>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default function Beranda() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    document.title = 'Ulangan Sekolah'
  }, [])

  if (!user) return <BerandaTamu />
  return user.role === 'murid' ? <BerandaMurid user={user} /> : <BerandaGuru user={user} />
}
