/** Halaman 404 — rute tak dikenal tidak lagi diam-diam menampilkan beranda. */
import { useEffect } from 'react'
import { RUTE } from '../../routes.js'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import { IkonBuku } from '../../icons.jsx'

export default function HalamanTidakDitemukan() {
  useEffect(() => {
    document.title = 'Halaman tidak ditemukan — Ulangan Sekolah'
  }, [])

  return (
    <div className="text-center py-4 muncul">
      <span className="fitur-ikon mx-auto" aria-hidden="true">
        <IkonBuku size={28} />
      </span>
      <h1 className="h2 fw-bold">Ups, halaman ini tidak ketemu</h1>
      <p className="teks-lembut mb-4">
        Alamatnya mungkin salah ketik atau halamannya sudah pindah.
      </p>
      <TombolTaut to={RUTE.beranda} besar ikon={IkonBuku}>
        Kembali ke beranda
      </TombolTaut>
    </div>
  )
}
