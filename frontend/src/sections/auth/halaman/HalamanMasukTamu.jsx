/**
 * Halaman "Masuk sebagai siswa tamu" — halaman tersendiri (tidak lagi menempel
 * di bawah formulir akun pada halaman masuk).
 *
 * Isinya dua pintu tanpa kata sandi sekolah: menulis nama (`MasukTamu`) atau
 * tombol Google (`GoogleMasuk`). Tombol Google hanya muncul bila sekolah
 * menyalakannya; formulir nama hanya muncul bila guru membuka kuis untuk tamu
 * (`GET /v1/tamu`) — server yang memutuskan, klien tidak menebak.
 *
 * `state.lanjut` (tujuan dari tautan ulangan guru) dibawa terus lewat tautan
 * dari halaman masuk, sehingga sesudah masuk murid kembali ke ulangannya.
 */
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { ambilInfoTamu } from '../api.js'
import KartuAuth from '../komponen/KartuAuth.jsx'
import MasukTamu from '../komponen/MasukTamu.jsx'
import GoogleMasuk from '../komponen/GoogleMasuk.jsx'
import Banner from '../../../shared/ui/Banner.jsx'
import MemuatHalaman from '../../../shared/ui/MemuatHalaman.jsx'
import { IkonPanahKiri, IkonPengguna } from '../../../icons.jsx'
import { RUTE } from '../../../routes.js'

/**
 * @param {{ berhasil?: (user: import('../authStore.js').DataUser) => void }} props
 */
export default function HalamanMasukTamu({ berhasil }) {
  const lokasi = useLocation()
  const infoTamu = useQuery({ queryKey: ['tamu-info'], queryFn: ambilInfoTamu, staleTime: 60_000 })

  return (
    <KartuAuth
      judul="Ikut sebagai siswa tamu"
      sub="Tulis namamu, atau masuk dengan Google."
      ikon={IkonPengguna}
    >
      {infoTamu.isLoading ? (
        <MemuatHalaman />
      ) : (
        <>
          {infoTamu.data?.diizinkan === true ? (
            <MasukTamu berhasil={berhasil} utama />
          ) : (
            <Banner jenis="info" judul="Belum dibuka untuk siswa tanpa akun">
              Minta gurumu menyalakan “Izinkan siswa tamu” lalu menerbitkan kuisnya. Sementara itu
              kamu bisa masuk dengan Google atau akun sekolah.
            </Banner>
          )}

          <GoogleMasuk berhasil={berhasil} />
        </>
      )}

      <p className="mt-4 mb-0">
        <Link
          to={RUTE.masuk}
          state={lokasi.state}
          className="btn-teks"
        >
          <IkonPanahKiri size={20} />
          <span>Kembali ke halaman masuk</span>
        </Link>
      </p>
    </KartuAuth>
  )
}
