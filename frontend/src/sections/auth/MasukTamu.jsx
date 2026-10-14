/**
 * Formulir "masuk sebagai siswa tamu" (mode tamu tanpa login).
 *
 * Muncul di halaman masuk HANYA bila guru sudah membuka kuis untuk tamu
 * (`izinkan_tamu`) — server yang memutuskan lewat `GET /v1/tamu`, jadi klien
 * tidak menebak dan tidak pernah menawarkan pintu yang pasti ditolak.
 *
 * Satu isian saja: nama yang dia ketik sendiri. Nama itu **hanya nama tampilan**
 * di daftar nilai — identitas sesungguhnya adalah kode perangkat yang dibuat
 * dan disimpan peramban (`perangkat.js`), sehingga dua anak bernama sama tidak
 * pernah berbagi akun dan tidak ada nama yang bisa diambil alih orang lain.
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaTamu } from './validasi.js'
import { pesanGalatApi, teksGalat } from './api.js'
import { sudahDitampilkanSebagaiTunggu, useAuthStore } from './authStore.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import Isian from '../../shared/ui/Isian.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { IkonPengguna } from '../../icons.jsx'

/**
 * @param {{
 *   berhasil?: (user: import('./authStore.js').DataUser) => void,
 *   utama?: boolean,
 * }} props
 *
 * `utama` dipakai saat halaman masuk dibuka dari **tautan ulangan** (14 Oktober
 * 2026): pengunjung yang membuka tautan guru umumnya tidak punya akun, jadi
 * formulir tamu tampil lebih dulu dan judulnya tidak lagi berbunyi "Atau …" —
 * tidak ada apa pun yang mendahuluinya untuk di-“atau”-kan.
 */
export default function MasukTamu({ berhasil, utama = false }) {
  const masukTamu = useAuthStore((s) => s.masukTamu)
  const detikTunggu = useAuthStore((s) => s.detikTunggu)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm({
    resolver: zodResolver(skemaTamu),
    defaultValues: { nama: '' },
  })

  const kirim = handleSubmit(async (data) => {
    clearErrors('root')
    try {
      const user = await masukTamu(data.nama)
      tampilkanToast('sukses', `Selamat mengerjakan, ${user.name}!`)
      berhasil?.(user)
    } catch (galat) {
      if (!sudahDitampilkanSebagaiTunggu(galat)) {
        setError('root', { message: pesanGalatApi(galat) })
      }
    }
  })

  return (
    <section className="auth-tamu" aria-labelledby="judul-masuk-tamu">
      <h2 className="auth-pemisah" id="judul-masuk-tamu">
        {utama ? 'Ikut ulangan sebagai siswa tamu' : 'Atau ikut sebagai siswa tamu'}
      </h2>
      <p className="teks-lembut small">
        {utama
          ? 'Kamu membuka tautan ulangan dari gurumu. Cukup tulis namamu — tanpa akun dan tanpa kata sandi.'
          : 'Gurumu sudah membuka kuis untuk tamu? Tulis namamu — tanpa akun dan tanpa kata sandi.'}{' '}
        Hasil ulanganmu tersimpan di perangkat ini, jadi pakai perangkat yang sama
        sampai selesai ya; kamu bisa lanjut kembali walau halamannya sempat tertutup.
      </p>

      <form onSubmit={kirim} noValidate>
        {errors.root?.message && (
          <Banner jenis="salah" judul="Belum bisa masuk sebagai tamu">
            {teksGalat(errors.root)}
          </Banner>
        )}

        <Isian
          label="Namamu"
          ikon={IkonPengguna}
          autoComplete="name"
          maxLength={60}
          placeholder="Contoh: Rara"
          bantuan="Tanpa akun: hasil ulanganmu tersimpan di perangkat ini dan tetap tercatat atas nama ini."
          galat={teksGalat(errors.nama)}
          {...register('nama')}
        />

        <Tombol
          type="submit"
          varian="tepi"
          lebar
          memuat={isSubmitting}
          teksMemuat="Menyiapkan…"
          disabled={detikTunggu > 0}
        >
          {detikTunggu > 0 ? `Tunggu ${detikTunggu} detik` : 'Masuk sebagai tamu'}
        </Tombol>
      </form>
    </section>
  )
}
