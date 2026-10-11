/**
 * Formulir "masuk sebagai siswa tamu" (mode tamu tanpa login).
 *
 * Muncul di halaman masuk HANYA bila guru sudah membuka kuis untuk tamu
 * (`izinkan_tamu`) — server yang memutuskan lewat `GET /v1/tamu`, jadi klien
 * tidak menebak dan tidak pernah menawarkan pintu yang pasti ditolak.
 *
 * Satu isian saja: nama. Nama itu menjadi identitas tamu di daftar nilai, dan
 * karena itu pemakaian ulang nama yang sama akan melanjutkan identitas yang
 * sama (bukan murid baru) — makanya pemilihan nama dijelaskan di bantuan isian.
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

/** @param {{ berhasil?: (user: import('./authStore.js').DataUser) => void }} props */
export default function MasukTamu({ berhasil }) {
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
        Atau ikut sebagai siswa tamu
      </h2>
      <p className="teks-lembut small">
        Gurumu sudah membuka kuis untuk tamu? Tulis namamu — tanpa akun dan tanpa kata
        sandi. Nama itu dipakai di daftar nilai, jadi pakai ejaan yang khas milikmu.
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
          bantuan="Tanpa akun: hasil ulanganmu tetap tercatat atas nama ini."
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
