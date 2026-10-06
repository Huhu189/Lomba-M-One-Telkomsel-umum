/**
 * Beranda: sambutan untuk tamu (hero + nilai jual) atau ringkasan akun untuk
 * pengguna yang sudah masuk. Daftar kuis menyusul di slice berikutnya —
 * sengaja tidak ada kartu kosong palsu di sini. (Akun belum terverifikasi
 * tidak pernah sampai ke sini: backend menolaknya di jalur login & sesi.)
 */
import { useEffect } from 'react'
import { IkonBintang, IkonJam, IkonPerisai } from '../../icons.jsx'
import { RUTE } from '../../routes.js'
import { inisial } from '../../shared/layout/KerangkaUmum.jsx'
import { HiasanLatar } from '../../shared/ui/Maskot.jsx'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import { useAuthStore } from '../auth/authStore.js'

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

function BerandaTamu() {
  return (
    <div className="muncul">
      <section className="hero mb-4">
        <HiasanLatar className="auth-panel-hias" />
        <div className="position-relative">
          <span className="lencana lencana-pendukung mb-3">
            <IkonBintang size={16} /> Gratis untuk murid
          </span>
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
function BerandaMasuk({ user }) {
  return (
    <div className="row justify-content-center muncul">
      <div className="col-lg-8 col-xl-7">
        <section className="kartu-soft p-4 p-md-5 mb-4">
          <div className="salam mb-4">
            <span className="avatar-huruf avatar-besar" aria-hidden="true">
              {inisial(user.name)}
            </span>
            <div>
              <p className="teks-lembut mb-0">{sapaanWaktu()},</p>
              <h1 className="h2 fw-bold mb-0 text-break">{user.name}!</h1>
            </div>
          </div>

          <dl className="daftar-info">
            <div>
              <dt>Peran</dt>
              <dd className="text-capitalize">{user.role}</dd>
            </div>
            <div>
              <dt>Status akun</dt>
              <dd>{user.statusLabel}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
        </section>

        <p className="teks-lembut text-center">
          Daftar ulangan dan materi akan muncul di sini saat guru sudah membagikannya.
        </p>
      </div>
    </div>
  )
}

export default function Beranda() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    document.title = 'Ulangan Sekolah'
  }, [])

  return user ? <BerandaMasuk user={user} /> : <BerandaTamu />
}
