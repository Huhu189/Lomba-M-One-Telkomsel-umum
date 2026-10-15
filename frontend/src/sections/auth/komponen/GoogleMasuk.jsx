/**
 * Tombol "Masuk dengan Google" (Google Identity Services / GIS).
 *
 * Satu tombol untuk dua hal — **masuk dan daftar**: server yang memutuskan,
 * apakah email itu sudah punya akun (ditautkan lalu masuk) atau belum (akun
 * murid baru dibuatkan). Karena itu komponen ini dipakai di halaman masuk
 * maupun di halaman daftar.
 *
 * Yang penting di sini:
 *
 * - **Id klien tidak ditanam di bundel.** Halaman ini menanyakan dulu
 *   `GET /v1/auth/google`; kalau sekolah belum mengisi `GOOGLE_CLIENT_ID`,
 *   server menjawab `aktif: false` dan tombolnya tidak pernah muncul. Anak tidak
 *   pernah melihat tombol yang pasti gagal.
 * - **Skrip Google bisa diblokir jaringan sekolah.** Kalau `gsi/client` gagal
 *   dimuat, komponen ini pulang diam-diam: jalur email + kata sandi tetap utuh,
 *   dan tidak ada galat yang membuat halaman masuk terasa rusak.
 * - **Isi token tidak dipercaya di klien.** Klien hanya meneruskan `credential`
 *   apa adanya; tanda tangan, penerbit, audiens, dan email diperiksa server
 *   (`GoogleIdTokenVerifier`).
 *
 * Skrip GIS dimuat satu kali per halaman (janji disimpan di modul) dan tombol
 * baru dirender setelah skripnya siap, jadi tidak ada dua inisialisasi GIS yang
 * saling menimpa.
 */
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ambilInfoGoogle, pesanGalatApi } from '../api.js'
import { sudahDitampilkanSebagaiTunggu, useAuthStore } from '../authStore.js'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'
import Banner from '../../../shared/ui/Banner.jsx'

const SUMBER_SKRIP = 'https://accounts.google.com/gsi/client'

/** Janji pemuatan skrip (satu per halaman; modul ini singleton). */
let janjiSkrip = /** @type {Promise<void>|null} */ (null)

/**
 * Muat skrip GIS sekali. Kegagalan diingat (janji yang sama dikembalikan), jadi
 * blokir jaringan tidak dicoba ulang berkali-kali di halaman yang sama.
 * @returns {Promise<void>}
 */
function muatSkrip() {
  if (typeof document === 'undefined') return Promise.reject(new Error('tanpa peramban'))
  if (/** @type {any} */ (window).google?.accounts?.id) return Promise.resolve()

  janjiSkrip ??= new Promise((selesai, gagal) => {
    const skrip = document.createElement('script')
    skrip.src = SUMBER_SKRIP
    skrip.async = true
    skrip.defer = true
    skrip.onload = () => selesai()
    skrip.onerror = () => gagal(new Error('skrip Google tidak bisa dimuat'))
    document.head.appendChild(skrip)
  })

  return janjiSkrip
}

/**
 * @param {{
 *   berhasil?: (user: import('../authStore.js').DataUser) => void,
 *   judul?: string,
 * }} props
 */
export default function GoogleMasuk({ berhasil, judul = 'Atau masuk dengan Google' }) {
  const masukGoogle = useAuthStore((s) => s.masukGoogle)
  const info = useQuery({ queryKey: ['google-info'], queryFn: ambilInfoGoogle, staleTime: 300_000 })
  const refWadah = useRef(/** @type {HTMLDivElement|null} */ (null))
  const [galat, setGalat] = useState('')
  const [siap, setSiap] = useState(false)

  /**
   * `berhasil` milik pemanggil hampir selalu berupa fungsi baru setiap render
   * (arrow inline di App). Disimpan di ref supaya efek pemuatan GIS tidak
   * menginisialisasi ulang tombol pada setiap render halaman.
   */
  const refBerhasil = useRef(berhasil)
  useEffect(() => {
    refBerhasil.current = berhasil
  })

  useEffect(() => {
    // Disalin ke variabel lokal: penyempitan tipe dari `info.data?.aktif` hilang
    // begitu masuk ke callback `.then()` di bawah.
    const infoGoogle = info.data

    if (infoGoogle?.aktif !== true) return

    let dibatalkan = false

    /** @param {unknown} credential */
    const kirim = async (credential) => {
      if (typeof credential !== 'string' || credential === '') {
        setGalat('Google tidak mengirim data masuk. Tekan tombolnya sekali lagi ya.')
        return
      }

      try {
        const hasil = await masukGoogle(credential)
        setGalat('')
        tampilkanToast('sukses', `Selamat datang, ${hasil.user.name}!`)
        refBerhasil.current?.(hasil.user)
      } catch (err) {
        if (!sudahDitampilkanSebagaiTunggu(err)) {
          setGalat(pesanGalatApi(err))
        }
      }
    }

    muatSkrip()
      .then(() => {
        const gis = /** @type {any} */ (window).google?.accounts?.id
        const wadah = refWadah.current

        if (dibatalkan || !gis || !wadah) return

        gis.initialize({
          client_id: infoGoogle.client_id,
          callback: (/** @type {{credential?: unknown}} */ respons) => {
            void kirim(respons?.credential)
          },
        })

        gis.renderButton(wadah, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          logo_alignment: 'center',
          locale: 'id',
          // Lebar mengikuti kolom formulir supaya sejajar dengan tombol
          // “Masuk”/“Daftar” di bawahnya (semuanya lebar penuh). Batas 400px
          // adalah lebar maksimum yang diterima GIS, dan batas bawah 200px
          // menjaga tombolnya tidak dipecah dua baris di ponsel kecil.
          width: Math.max(200, Math.min(400, wadah.clientWidth || 320)),
        })

        setSiap(true)
      })
      .catch(() => {
        // Jaringan sekolah memblokir accounts.google.com: diamkan, karena jalur
        // email + kata sandi di bawahnya tetap bisa dipakai. Murid yang memang
        // punya akun Google akan melihat tombolnya saat jaringannya membuka.
      })

    return () => {
      dibatalkan = true
    }
  }, [info.data, masukGoogle])

  if (info.data?.aktif !== true) return null

  return (
    <section className="google-masuk">
      {/* Pemisah baru muncul setelah tombolnya benar-benar siap: jaringan sekolah
          yang memblokir accounts.google.com tidak boleh menyisakan judul
          “Atau masuk dengan Google” yang menggantung tanpa tombol. */}
      {siap && <p className="auth-pemisah">{judul}</p>}

      {galat !== '' && (
        <Banner jenis="salah" judul="Belum bisa masuk dengan Google">
          {galat}
        </Banner>
      )}

      {/* Wadah tombol resmi GIS (dirender Google ke dalam div ini). Div-nya harus
          SUDAH ada di DOM saat efek berjalan — itu syarat `renderButton` — jadi
          selama belum siap tingginya dibuat nol oleh `google-tombol-muat`. */}
      <div ref={refWadah} className={`google-tombol ${siap ? '' : 'google-tombol-muat'}`.trim()} />
    </section>
  )
}
