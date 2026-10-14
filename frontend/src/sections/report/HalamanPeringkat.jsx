/**
 * Halaman peringkat satu kuis (slice 05; aturan baru 14 Oktober 2026).
 *
 * Peringkat dihitung server HANYA dari skor asli (percobaan pertama), jadi
 * mengulang kuis tidak mengubah urutan. Bila guru mematikan saklar ranking,
 * murid melihat pesan kosong; guru tetap melihat data untuk laporan.
 *
 * Dua aturan yang menentukan bentuk halaman ini:
 *
 * 1. **Nomor peringkat hanya untuk N% teratas** (bawaan 30%). Murid di bawahnya
 *    tetap melihat skornya sendiri dan diberi tahu bahwa nomornya belum dibuka
 *    — bukan layar kosong tanpa penjelasan. Guru selalu melihat seluruh papan.
 * 2. **Papan guru bisa diproyeksikan** (mode proyektor): huruf dan angkanya
 *    diperbesar supaya terbaca dari belakang kelas. Yang tampil di sana adalah
 *    angka yang sama dengan yang dilihat murid, ditambah tanda pada baris yang
 *    dibantu bonus penyemangat. Murid tidak pernah melihat tanda itu — server
 *    memang tidak mengirim jejak bonus kepada mereka.
 *
 * Papan itu sendiri disusun `PapanPeringkat.jsx` — komponen yang sama yang
 * dipakai panel layar kelas di perangkat murid (14 Oktober 2026), supaya papan
 * di HP murid tidak bisa berbeda dari papan di halaman ini.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import PapanPeringkat from './PapanPeringkat.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { RUTE, kunciKuisSah } from '../../routes.js'
import { useAuthStore } from '../auth/authStore.js'
import usePeringkat, { TOP_GURU, TOP_MURID } from './usePeringkat.js'

export default function HalamanPeringkat() {
  const { slug } = useParams()
  const kunci = kunciKuisSah(slug)
  const user = useAuthStore((s) => s.user)
  const sebagaiGuru = user?.role === 'guru' || user?.role === 'admin'
  const [proyektor, setProyektor] = useState(false)

  const peringkat = usePeringkat(kunci, {
    sebagaiGuru,
    top: sebagaiGuru ? TOP_GURU : TOP_MURID,
  })

  const data = peringkat.data

  if (peringkat.isLoading) {
    return <p className="text-body-secondary">Menyusun peringkat…</p>
  }

  if (peringkat.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Peringkat belum bisa dibuka">
        <p className="mb-3">Peringkat ini tidak tersedia untukmu.</p>
        <Link className="btn btn-tepi" to={RUTE.kuis}>
          Kembali ke daftar kuis
        </Link>
      </Banner>
    )
  }

  // Papan yang terbuka untuk guru bisa dinyalakan muridnya? `data.guru` dari
  // server yang menentukan, bukan dugaan dari peran di peramban.
  const guru = data.guru === true
  const modeProyektor = guru && proyektor

  return (
    <div className="row justify-content-center">
      <div className={modeProyektor ? 'col-12' : 'col-lg-9'}>
        <div className="kartu-soft p-4 p-md-5">
          <PapanPeringkat
            data={data}
            guru={guru}
            proyektor={modeProyektor}
            aksi={
              guru ? (
                <Tombol varian="tepi" ukuran="sedang" onClick={() => setProyektor(!proyektor)}>
                  {modeProyektor ? 'Keluar mode proyektor' : 'Mode proyektor'}
                </Tombol>
              ) : null
            }
          />

          {!modeProyektor && (
            <div className="d-flex flex-wrap gap-2 mt-4">
              <Link className="btn btn-tepi" to={`${RUTE.kuis}/${kunci}`}>
                Lihat kuis
              </Link>
              <Link className="btn btn-teks" to={RUTE.kuis}>
                Daftar kuis
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
