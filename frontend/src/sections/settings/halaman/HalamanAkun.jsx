/**
 * Halaman akun (/pengaturan) — setelan milik pengguna yang sedang masuk.
 *
 * Sebelum 13 Oktober 2026 halaman ini menampilkan **setelan per ulangan**
 * (anti-cheat, percobaan ulang, peringkat, …) lewat pemilih ulangan. Setelan itu
 * sekarang menyatu dengan kuisnya masing-masing — guru membuka kuisnya dan
 * mengatur di sana — sehingga halaman ini kembali ke arti namanya: akun.
 *
 * Yang bisa diatur di sini: nama tampilan, kata sandi (wajib menyertakan sandi
 * lama), dan tema terang/gelap. Email sengaja hanya ditampilkan: ia alamat
 * verifikasi dan pemulihan akun, jadi perubahannya butuh alur verifikasi
 * tersendiri (belum ada) — dan server memang menolaknya.
 */
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { RUTE } from '../../../routes.js'
import { useAuthStore } from '../../auth/authStore.js'
import { pesanGalatApi, teksGalat } from '../../auth/api.js'
import { gantiSandiAkun, simpanNamaAkun } from '../api.js'
import { skemaAkunNama, skemaAkunSandi } from '../validasiAkun.js'
import { useTemaStore } from '../../../shared/store/tema.js'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'
import Banner from '../../../shared/ui/Banner.jsx'
import HeaderHalaman from '../../../shared/ui/HeaderHalaman.jsx'
import Isian from '../../../shared/ui/Isian.jsx'
import MeterSandi from '../../../shared/ui/MeterSandi.jsx'
import { Tombol, TombolTaut } from '../../../shared/ui/Tombol.jsx'
import { IkonKunci, IkonMatahari, IkonBulan, IkonPengguna, IkonSurat } from '../../../icons.jsx'

export default function HalamanAkun() {
  const user = useAuthStore((s) => s.user)
  const aturUser = useAuthStore((s) => s.aturUser)
  const tema = useTemaStore((s) => s.tema)
  const ubahTema = useTemaStore((s) => s.ubah)

  const tamu = user?.isTamu === true

  const nama = useForm({
    resolver: zodResolver(skemaAkunNama),
    defaultValues: { name: user?.name ?? '' },
  })

  const sandi = useForm({
    resolver: zodResolver(skemaAkunSandi),
    defaultValues: { sandi_sekarang: '', password: '', konfirmasi: '' },
  })

  // useWatch (bukan watch()): React Compiler melewati komponen yang memakai
  // `watch()` karena hasilnya tidak bisa dimemo dengan aman.
  const sandiBaru = useWatch({ control: sandi.control, name: 'password' })

  // Nama di formulir mengikuti user yang sedang masuk: sesudah sesi dipulihkan
  // (atau diganti akun lain), isian kosong tidak boleh membuat murid menyimpan
  // nama kosong dan menimpanya jadi "undefined".
  useEffect(() => {
    nama.reset({ name: user?.name ?? '' })
  }, [user?.name, nama])

  const simpanNama = useMutation({
    mutationFn: simpanNamaAkun,
    onSuccess: (hasil) => {
      aturUser(hasil)
      nama.reset({ name: hasil.name })
      tampilkanToast('sukses', 'Nama disimpan.')
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const simpanSandi = useMutation({
    mutationFn: gantiSandiAkun,
    onSuccess: (hasil) => {
      // Sesi yang sedang dipakai TETAP hidup (server hanya mengakhiri sesi lain),
      // jadi murid tidak terlempar keluar setelah mengganti sandinya.
      aturUser(hasil.user)
      sandi.reset({ sandi_sekarang: '', password: '', konfirmasi: '' })
      tampilkanToast('sukses', hasil.message)
    },
    onError: (galat) => {
      // "Sandi sekarang tidak cocok" ditandai server pada bidangnya sendiri
      // supaya pesannya menempel di isian yang perlu diperbaiki.
      sandi.setError('root', { message: pesanGalatApi(galat) })
    },
  })

  if (user === null) return null

  if (tamu) {
    return (
      <>
        <HeaderHalaman
          judul="Akun"
          jejak="Akun"
          deskripsi="Setelan akun dan tampilan milikmu."
        />
        <Banner jenis="info" judul="Kamu masuk sebagai siswa tamu">
          Akun tamu dibuat hanya dengan nama dan tanpa kata sandi, jadi tidak ada setelan akun
          yang bisa diubah di sini. Daftar sebagai murid supaya punya akun sendiri — lengkap
          dengan kelas, materi, dan lencana.
        </Banner>
        <div className="d-flex flex-wrap gap-2 mt-3">
          <TombolTaut to={RUTE.daftar}>Daftar sebagai murid</TombolTaut>
          <TombolTaut to={RUTE.kuis} varian="tepi">
            Ulangan untuk tamu
          </TombolTaut>
        </div>
      </>
    )
  }

  return (
    <>
      <HeaderHalaman
        judul="Akun"
        jejak="Akun"
        deskripsi="Ubah nama, ganti kata sandi, dan atur tampilan. Setelan ulangan ada di tiap kuis."
      />

      <div className="row g-4">
        <div className="col-lg-7">
          <section className="kartu-soft p-4 mb-4" aria-labelledby="judul-profil">
            <h2 id="judul-profil" className="judul-bagian">
              Profil
            </h2>

            <form onSubmit={nama.handleSubmit((data) => simpanNama.mutate(data.name))} noValidate>
              <Isian
                label="Nama tampilan"
                ikon={IkonPengguna}
                autoComplete="name"
                bantuan="Nama ini yang tampil di kepala aplikasi, laporan, dan daftar nilai."
                galat={teksGalat(nama.formState.errors.name)}
                {...nama.register('name')}
              />

              <div className="mt-3">
                <label className="form-label fw-semibold" htmlFor="akun-email">
                  Email
                </label>
                <input
                  id="akun-email"
                  className="form-control"
                  type="email"
                  value={user.email}
                  readOnly
                  aria-describedby="akun-email-bantuan"
                />
                <p className="teks-lembut small mb-0 mt-1" id="akun-email-bantuan">
                  Email tidak bisa diubah dari sini karena dipakai untuk verifikasi dan pemulihan
                  akun.
                  {user.emailTerverifikasi
                    ? ' Email akun ini sudah terverifikasi.'
                    : ' Email akun ini belum terverifikasi.'}
                </p>
              </div>

              <div className="d-flex justify-content-end mt-3">
                <Tombol
                  type="submit"
                  ukuran="sedang"
                  memuat={simpanNama.isPending}
                  disabled={!nama.formState.isDirty}
                >
                  Simpan nama
                </Tombol>
              </div>
            </form>
          </section>

          <section className="kartu-soft p-4" aria-labelledby="judul-sandi">
            <h2 id="judul-sandi" className="judul-bagian">
              Kata sandi
            </h2>
            <p className="teks-lembut small">
              Setelah kata sandi diganti, sesi di perangkat lain yang memakai akun ini diakhiri —
              perangkat ini tetap masuk.
            </p>

            {sandi.formState.errors.root?.message !== undefined && (
              <Banner jenis="salah" judul="Kata sandi belum diganti">
                {teksGalat(sandi.formState.errors.root)}
              </Banner>
            )}

            <form
              onSubmit={sandi.handleSubmit(async (data) => {
                sandi.clearErrors('root')
                await simpanSandi.mutateAsync({
                  sandiSekarang: data.sandi_sekarang,
                  sandiBaru: data.password,
                })
              })}
              noValidate
            >
              <Isian
                label="Kata sandi sekarang"
                type="password"
                ikon={IkonKunci}
                autoComplete="current-password"
                galat={teksGalat(sandi.formState.errors.sandi_sekarang)}
                {...sandi.register('sandi_sekarang')}
              />

              <Isian
                label="Kata sandi baru"
                type="password"
                ikon={IkonKunci}
                autoComplete="new-password"
                bantuan="Minimal 10 karakter."
                galat={teksGalat(sandi.formState.errors.password)}
                {...sandi.register('password')}
              />
              <MeterSandi sandi={sandiBaru} />

              <Isian
                label="Ulangi kata sandi baru"
                type="password"
                ikon={IkonKunci}
                autoComplete="new-password"
                galat={teksGalat(sandi.formState.errors.konfirmasi)}
                {...sandi.register('konfirmasi')}
              />

              <div className="d-flex justify-content-end mt-3">
                <Tombol
                  type="submit"
                  ukuran="sedang"
                  memuat={simpanSandi.isPending}
                  teksMemuat="Menyimpan…"
                >
                  Ganti kata sandi
                </Tombol>
              </div>
            </form>
          </section>
        </div>

        <div className="col-lg-5">
          <section className="kartu-soft p-4 mb-4" aria-labelledby="judul-tampilan">
            <h2 id="judul-tampilan" className="judul-bagian">
              Tampilan
            </h2>
            <p className="teks-lembut small">
              Pilihan tema disimpan di perangkat ini saja — bukan di akun.
            </p>

            <div className="d-flex gap-2">
              <Tombol
                varian={tema === 'terang' ? 'utama' : 'tepi'}
                ukuran="sedang"
                ikon={IkonMatahari}
                aria-pressed={tema === 'terang'}
                onClick={() => ubahTema('terang')}
              >
                Terang
              </Tombol>
              <Tombol
                varian={tema === 'gelap' ? 'utama' : 'tepi'}
                ukuran="sedang"
                ikon={IkonBulan}
                aria-pressed={tema === 'gelap'}
                onClick={() => ubahTema('gelap')}
              >
                Gelap
              </Tombol>
            </div>
          </section>

          <section className="kartu-soft p-4" aria-labelledby="judul-avatar">
            <h2 id="judul-avatar" className="judul-bagian">
              Avatar
            </h2>
            {user.role === 'murid' ? (
              <>
                <p className="teks-lembut small">
                  Avatar tampil di papan peringkat dan daftar kelas. Guru meninjaunya lebih dulu,
                  jadi pakai gambar yang pantas.
                </p>
                <TombolTaut to={RUTE.avatar} varian="tepi" ukuran="sedang">
                  Buka halaman avatar
                </TombolTaut>
              </>
            ) : (
              <p className="teks-lembut small mb-0">
                Avatar hanya tersedia untuk akun murid — guru dan admin tidak muncul di papan
                peringkat.
              </p>
            )}
          </section>

          <p className="teks-lembut small mt-3 mb-0">
            <IkonSurat size={16} aria-hidden="true" /> Masuk sebagai <strong>{user.email}</strong> ·
            peran <span className="text-capitalize">{user.role}</span>.
          </p>
        </div>
      </div>
    </>
  )
}
