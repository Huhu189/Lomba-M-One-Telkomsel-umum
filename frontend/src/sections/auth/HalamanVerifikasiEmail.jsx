/**
 * Halaman Verifikasi email — tautan bertanda tangan dari email mengarah ke
 * backend, lalu diarahkan ke sini dengan query ?status=berhasil|gagal.
 * Query string divalidasi Zod (pagar mutu: data luar lewat Zod).
 */
import { useEffect } from 'react'
import { z } from 'zod'
import { useSearchParams } from 'react-router-dom'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import { IkonBuku, IkonPanahKiri, IkonSilang } from '../../icons.jsx'
import { RUTE } from '../../routes.js'
import { useAuthStore } from './authStore.js'
import KartuAuth from './KartuAuth.jsx'
import KirimUlangVerifikasi from './KirimUlangVerifikasi.jsx'

/** Skema query status dari redirect backend. */
const skemaQueryStatus = z.object({
  status: z.enum(['berhasil', 'gagal']),
})

export default function HalamanVerifikasiEmail() {
  const [parameter] = useSearchParams()
  const email = useAuthStore((s) => s.user?.email ?? '')
  const adaSesi = useAuthStore((s) => s.user !== null)
  const muatUser = useAuthStore((s) => s.muatUser)

  const terurai = skemaQueryStatus.safeParse({
    status: parameter.get('status') ?? '',
  })
  const berhasil = terurai.success && terurai.data.status === 'berhasil'

  // Murid baru daftar langsung masuk (auto-login) dengan data user "belum verifikasi" di
  // store. Tanpa penyegaran, tombol "Masuk sekarang" memantul ke beranda lalu dilempar
  // balik ke /perlu-verifikasi walau email sudah terverifikasi.
  useEffect(() => {
    if (berhasil && adaSesi) {
      muatUser().catch(() => {
        // Sesi tidak sah: store dibersihkan oleh event auth:sesi-habis.
      })
    }
  }, [berhasil, adaSesi, muatUser])

  if (berhasil) {
    return (
      <KartuAuth judul="Email terverifikasi!" tengah>
        <span className="fitur-ikon mx-auto" aria-hidden="true">
          <IkonBuku size={28} />
        </span>
        <p className="teks-lembut">Akunmu sudah aktif. Yuk masuk dan mulai belajar.</p>
        <TombolTaut to={RUTE.masuk} besar lebar>
          Masuk sekarang
        </TombolTaut>
      </KartuAuth>
    )
  }

  return (
    <KartuAuth judul="Tautan tidak berlaku" tengah>
      <span className="fitur-ikon lembut mx-auto" aria-hidden="true">
        <IkonSilang size={28} />
      </span>
      <p className="teks-lembut mb-4">
        Tautan ini sudah kedaluwarsa atau tidak benar. Tenang, kamu bisa minta tautan yang baru.
      </p>

      <div className="text-start">
        <KirimUlangVerifikasi emailAwal={email} />
      </div>

      <div className="d-grid mt-3">
        <TombolTaut to={RUTE.masuk} varian="teks" ikon={IkonPanahKiri}>
          Kembali ke halaman masuk
        </TombolTaut>
      </div>
    </KartuAuth>
  )
}
