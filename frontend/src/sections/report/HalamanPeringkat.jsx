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
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import TabelData from '../../shared/ui/TabelData.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { RUTE, kunciKuisSah } from '../../routes.js'
import { useAuthStore } from '../auth/authStore.js'
import { ambilPeringkat } from './api.js'
import { angkaRapi, angkaTampil, barisMilikSaya, catatanBonusBaris, ringkasAturanPapan } from './tampilan.js'

/** Papan guru ditarik lebih panjang: layar kelas menampung seisi kelas. */
const TOP_GURU = 50
const TOP_MURID = 20

export default function HalamanPeringkat() {
  const { slug } = useParams()
  const kunci = kunciKuisSah(slug)
  const user = useAuthStore((s) => s.user)
  const sebagaiGuru = user?.role === 'guru' || user?.role === 'admin'
  const [proyektor, setProyektor] = useState(false)

  const peringkat = useQuery({
    queryKey: ['peringkat', kunci, sebagaiGuru],
    queryFn: () => ambilPeringkat(kunci, sebagaiGuru ? TOP_GURU : TOP_MURID),
    enabled: kunci !== '',
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
  const aturan = ringkasAturanPapan(data)
  const modeProyektor = guru && proyektor
  const detailSaya = data.detail_saya
  const sapaan = data.mode_tim ? 'Timmu' : 'Kamu'

  /** @type {import('../../shared/ui/TabelData.jsx').KolomTabel[]} */
  const kolom = [
    {
      kunci: 'peringkat',
      judul: '#',
      sel: (baris) => (
        <strong className={modeProyektor ? 'display-6 fw-bold' : undefined}>
          {baris.peringkat}
        </strong>
      ),
    },
    {
      kunci: 'nama',
      judul: data.mode_tim ? 'Tim' : 'Nama',
      sel: (baris) => {
        const milikku = barisMilikSaya(baris, data.peringkat_saya, data.mode_tim)
        return (
          <span className={modeProyektor ? 'fs-3 fw-semibold' : undefined}>
            {baris.nama}
            {data.mode_tim && <span className="badge-status lembut ms-2">tim</span>}
            {milikku && <span className="small ms-2">(kamu)</span>}
            {!modeProyektor && baris.anggota.length > 0 && (
              <div className="teks-lembut small">{baris.anggota.join(', ')}</div>
            )}
          </span>
        )
      },
    },
    {
      kunci: 'skor',
      judul: 'Skor',
      kelas: modeProyektor ? 'text-end fs-3' : 'text-end',
      // Selalu angka TAMPILAN, bukan nilai asli: papan guru dan papan murid
      // harus memperlihatkan angka yang sama.
      sel: (baris) => {
        const angka = angkaTampil(baris)
        return `${angkaRapi(angka.nilai)} / ${angkaRapi(angka.maksimal)} (${angkaRapi(angka.persen)}%)`
      },
    },
    {
      kunci: 'benar',
      judul: 'Benar',
      kelas: modeProyektor ? 'text-end fs-3' : 'text-end',
      sel: (baris) => `${baris.jumlah_benar} / ${baris.jumlah_soal}`,
    },
  ]

  // Kolom catatan ini HANYA untuk guru, dan tertutup lagi begitu guru menyalakan
  // mode proyektor: di sinilah jejak bonus terbaca (siapa yang dibantu, berapa
  // tambahannya, berapa nilai dan peringkat aslinya).
  if (guru && !modeProyektor) {
    kolom.push({
      kunci: 'catatan',
      judul: 'Catatan guru',
      sel: (baris) => {
        const catatan = catatanBonusBaris(baris)
        if (catatan === null) return <span className="teks-lembut small">—</span>

        return (
          <span className="small">
            <span className="badge-status peringatan me-2">dibantu</span>
            {catatan.teks}
            {catatan.peringkatAsli !== null && (
              <span className="teks-lembut"> · peringkat asli #{catatan.peringkatAsli}</span>
            )}
          </span>
        )
      },
    })
  }

  return (
    <div className="row justify-content-center">
      <div className={modeProyektor ? 'col-12' : 'col-lg-9'}>
        <div className="kartu-soft p-4 p-md-5">
          <div className="d-flex flex-wrap align-items-start gap-2">
            <div className="me-auto">
              <h1 className={modeProyektor ? 'display-6 fw-bold mb-1' : 'h5 fw-bold mb-1'}>
                {data.mode_tim ? 'Peringkat tim · ' : 'Peringkat · '}
                {data.judul_kuis}
              </h1>
              {!modeProyektor && (
                <p className="teks-lembut small mb-0">
                  Dihitung dari <strong>nilai asli</strong> (percobaan pertama). Bila nilainya sama, yang
                  lebih cepat mengumpulkan naik; bila masih sama, urut nama.
                </p>
              )}
            </div>

            {guru && (
              <Tombol
                varian="tepi"
                ukuran="sedang"
                onClick={() => setProyektor(!proyektor)}
              >
                {modeProyektor ? 'Keluar mode proyektor' : 'Mode proyektor'}
              </Tombol>
            )}
          </div>

          {!modeProyektor && (
            <p className="teks-lembut small mt-2 mb-3">{aturan.catatanKeterbukaan}</p>
          )}

          {!data.tampil && (
            <Banner jenis="info" judul="Ranking sedang dimatikan guru">
              <p className="mb-0">
                {guru
                  ? 'Murid tidak melihat peringkat sampai saklar ranking dinyalakan di pengaturan. Papan di bawah ini hanya untukmu.'
                  : 'Gurumu mematikan tampilan peringkat untuk kelas ini.'}
              </p>
            </Banner>
          )}

          {aturan.bonusAktif && guru && aturan.catatanBonus !== null && !modeProyektor && (
            <p className="teks-lembut small mb-3">
              {aturan.catatanBonus} Tanda itu tidak ikut tampil di mode proyektor — papan yang
              diproyeksikan sama persis dengan yang dilihat murid.
            </p>
          )}

          {data.tampil && data.mode_tim && !modeProyektor && (
            <p className="teks-lembut small mb-0">
              Kuis ini mode tim: satu nilai untuk satu tim, jadi yang diperingkat adalah timnya.
            </p>
          )}

          {data.tampil && data.total === 0 && (
            <p className="text-body-secondary">
              {data.mode_tim
                ? 'Belum ada tim yang mengumpulkan ulangan ini.'
                : 'Belum ada murid yang mengumpulkan ulangan ini.'}
            </p>
          )}

          {data.peringkat.length > 0 && (
            <TabelData
              label="Peringkat ulangan"
              baris={data.peringkat}
              kunciBaris={(baris) => baris.attempt_id}
              // Baris milik murid sendiri tetap disorot seperti sebelumnya.
              // Baris berbantuan ditandai HANYA di layar kerja guru — di mode
              // proyektor papan itu dilihat seisi kelas, jadi jejaknya dibuang.
              kelasBaris={(baris) =>
                barisMilikSaya(baris, data.peringkat_saya, data.mode_tim)
                  ? 'sorot-hangat'
                  : guru && !modeProyektor && catatanBonusBaris(baris) !== null
                    ? 'peringkat-dibantu'
                    : undefined
              }
              kolom={kolom}
            />
          )}

          {data.tampil && data.total > 0 && !guru && detailSaya === null && (
            <p className="teks-lembut small">
              {sapaan} belum mengumpulkan ulangan ini, jadi belum masuk peringkat.
            </p>
          )}

          {data.tampil && !guru && detailSaya !== null && detailSaya.di_luar_terbuka && (
            <div className="border-top pt-3 mt-4">
              <h2 className="h6 fw-bold mb-1">
                {data.mode_tim ? 'Nomor peringkat timmu belum dibuka' : 'Nomor peringkatmu belum dibuka'}
              </h2>
              <p className="teks-lembut small mb-2">
                Nomor peringkat dibuka untuk {aturan.terbukaJumlah}{' '}
                {data.mode_tim ? 'tim teratas' : 'murid teratas'} dari {data.total} peserta. Gurumu tetap
                melihat seluruh papan, dan {data.mode_tim ? 'nilai timmu' : 'nilaimu'} tetap tercatat.
              </p>
              <p className="mb-0">
                {data.mode_tim ? 'Skor timmu:' : 'Skormu:'}{' '}
                <strong>
                  {angkaRapi(angkaTampil(detailSaya).nilai)} / {angkaRapi(angkaTampil(detailSaya).maksimal)} (
                  {angkaRapi(angkaTampil(detailSaya).persen)}%)
                </strong>
              </p>
            </div>
          )}

          {data.tampil && !guru && detailSaya !== null && !detailSaya.di_luar_terbuka && detailSaya.peringkat !== null && (
            <p className="teks-lembut small mb-0">
              {sapaan} di peringkat <strong>{detailSaya.peringkat}</strong> dari {data.total} peserta.
            </p>
          )}

          {guru && data.total > data.peringkat.length && (
            <p className="teks-lembut small mb-0">
              Menampilkan {data.peringkat.length} peringkat teratas dari {data.total} peserta.
            </p>
          )}

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
