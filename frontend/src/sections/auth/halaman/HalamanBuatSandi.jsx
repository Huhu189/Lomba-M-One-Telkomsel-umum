/**
 * Halaman "Buat kata sandimu" — lapisan sekali seumur akun untuk murid yang
 * masuk/daftar lewat Google (14 Oktober 2026).
 *
 * Kenapa diminta sekali saja: akun yang lahir dari tombol Google dibuat server
 * dengan kata sandi acak yang tidak pernah diberitahukan ke siapa pun. Selama
 * itu akunnya hanya bisa dibuka lewat Google — padahal ponsel bisa dipinjam
 * teman, akun Google anak bisa ditutup sekolah, dan perangkat baru menuntut
 * cara masuk yang bisa dipakai sendiri. Sesudah kata sandi ini dibuat, masuk
 * berikutnya tidak pernah menanyakan kata sandi lagi selama sesinya masih hidup
 * (dan murid boleh masuk lewat Google kapan saja).
 *
 * Server menegakkan urutan ini juga, bukan hanya halaman ini: middleware
 * `sandi-disetel` menolak 403 semua rute lain selama `perluBuatSandi` menyala,
 * jadi tidak ada jalan memutar dengan mengetik alamat halaman lain.
 */
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaBuatSandi } from '../validasi.js'
import { buatSandiPertama, pesanGalatApi, teksGalat } from '../api.js'
import { useAuthStore } from '../authStore.js'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'
import Isian from '../../../shared/ui/Isian.jsx'
import Banner from '../../../shared/ui/Banner.jsx'
import MeterSandi from '../../../shared/ui/MeterSandi.jsx'
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import { IkonKunci } from '../../../icons.jsx'
import KartuAuth from '../komponen/KartuAuth.jsx'

/**
 * @param {{
 *   berhasil?: (user: import('../authStore.js').DataUser) => void,
 *   nama?: string,
 * }} props
 */
export default function HalamanBuatSandi({ berhasil, nama = '' }) {
  const aturUser = useAuthStore((s) => s.aturUser)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm({
    resolver: zodResolver(skemaBuatSandi),
    defaultValues: { password: '', konfirmasi: '' },
  })

  const sandi = watch('password')

  const kirim = handleSubmit(async (data) => {
    clearErrors('root')
    try {
      const hasil = await buatSandiPertama({ password: data.password })

      // Penanda `perluBuatSandi` padam di server; simpan user terbarunya supaya
      // gerbang halaman lain (dan middleware di server) sama-sama membukanya.
      aturUser(hasil.user)
      tampilkanToast('sukses', hasil.message)
      berhasil?.(hasil.user)
    } catch (galat) {
      setError('root', { message: pesanGalatApi(galat) })
    }
  })

  return (
    <KartuAuth
      judul="Buat kata sandimu"
      sub={
        nama === ''
          ? 'Sekali ini saja, supaya akunmu bisa dibuka juga tanpa Google.'
          : `Sekali ini saja ya, ${nama} — supaya akunmu bisa dibuka juga tanpa Google.`
      }
      ikon={IkonKunci}
    >
      <Banner jenis="info" judul="Kenapa diminta sekali?">
        Akunmu dibuat lewat Google, jadi kata sandinya belum kamu punya sendiri. Kata sandi ini
        dipakai kalau kamu masuk dari perangkat lain atau saat akun Google-nya tidak bisa dipakai.
        Setelah ini kamu tidak akan ditanya kata sandi lagi selama masih masuk di perangkat ini.
      </Banner>

      <form onSubmit={kirim} noValidate>
        {errors.root?.message && (
          <Banner jenis="salah" judul="Kata sandi belum tersimpan">
            {teksGalat(errors.root)}
          </Banner>
        )}

        <Isian
          label="Kata sandi baru"
          type="password"
          ikon={IkonKunci}
          autoComplete="new-password"
          bantuan="Minimal 10 karakter. Kalimat pendek yang mudah diingat juga boleh."
          galat={teksGalat(errors.password)}
          {...register('password')}
        />
        <MeterSandi sandi={sandi} />

        <Isian
          label="Ulangi kata sandi"
          type="password"
          ikon={IkonKunci}
          autoComplete="new-password"
          galat={teksGalat(errors.konfirmasi)}
          {...register('konfirmasi')}
        />

        <Tombol type="submit" besar lebar className="mt-2" memuat={isSubmitting} teksMemuat="Menyimpan…">
          Simpan kata sandi
        </Tombol>
      </form>
    </KartuAuth>
  )
}
