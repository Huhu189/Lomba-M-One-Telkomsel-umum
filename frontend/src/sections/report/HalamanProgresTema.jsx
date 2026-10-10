/**
 * Halaman progres tema murid (slice 05) mengikuti papan desain 9.
 *
 * Menampilkan pemahaman per tema + latihan remedial otomatis dari tema lemah.
 * Remedial hanya merekomendasikan soal; nilai asli tidak pernah berubah.
 *
 * Tambahan dari papan: kepala halaman bersama, saringan **Semua tema / Perlu
 * dilatih**, dan keadaan memuat/kosong yang utuh. Tingkat pemahaman selalu
 * ikon + teks (bukan hanya warna).
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TombolTaut } from '../../shared/ui/Tombol.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import HeaderHalaman from '../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../shared/ui/KosongData.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import { IkonBuku, IkonGrafik } from '../../icons.jsx'
import { RUTE } from '../../routes.js'
import { ambilProgresSaya } from './api.js'
import { kelasLencana, ringkasTingkat, tingkatTampilan } from './tampilan.js'

/** Tingkat yang butuh latihan tambahan. */
const PERLU_LATIHAN = new Set(['mulai_paham', 'belum_paham'])

export default function HalamanProgresTema() {
  const [saring, setSaring] = useState(/** @type {'semua'|'perlu'} */ ('semua'))
  const progres = useQuery({ queryKey: ['progres-saya'], queryFn: ambilProgresSaya })
  const data = progres.data

  if (progres.isPending) {
    return <Skeleton judul baris={4} label="Menyusun progres…" />
  }

  if (progres.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Progres belum bisa dibuka">
        <p className="mb-0">Halaman ini khusus murid yang sudah masuk.</p>
      </Banner>
    )
  }

  const ringkasan = ringkasTingkat(data.tema)
  const perluDilatih = data.tema.filter((tema) => PERLU_LATIHAN.has(tema.tingkat))
  const tampil = saring === 'semua' ? data.tema : perluDilatih

  return (
    <>
      <HeaderHalaman
        judul={`Progres Tema · ${data.nama}`}
        jejak="Ulangan / Progres Tema"
        deskripsi={`Dihitung dari nilai ulanganmu. Paham ≥ ${data.ambang.ambang_paham}% dan mulai paham ≥ ${data.ambang.ambang_mulai_paham}%; tema dinilai setelah ${data.ambang.data_minimum} soal.`}
      >
        <TombolTaut to={RUTE.badge} varian="tepi" ikon={IkonGrafik} ukuran="sedang">
          Lencana saya
        </TombolTaut>
      </HeaderHalaman>

      <div className="d-flex flex-wrap gap-2 mb-4">
        <span className="badge-status sukses">{ringkasan.paham} paham</span>
        <span className="badge-status peringatan">{ringkasan.mulai_paham} mulai paham</span>
        <span className="badge-status salah">{ringkasan.belum_paham} belum paham</span>
        <span className="badge-status lembut">{ringkasan.data_belum_cukup} belum cukup data</span>
        <span className={kelasLencana(data.badge.badge[0]?.lencana)}>
          {data.badge.jumlah_lencana} mapel berlencana
        </span>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h2 className="judul-bagian mb-0 me-auto">Tema yang dinilai</h2>
        {/** @type {Array<['semua'|'perlu', string]>} */ ([
          ['semua', 'Semua tema'],
          ['perlu', 'Perlu dilatih'],
        ]).map(([nilai, label]) => (
          <button
            key={nilai}
            type="button"
            className="pil-saring"
            aria-pressed={saring === nilai}
            onClick={() => setSaring(nilai)}
          >
            {label}
          </button>
        ))}
      </div>

      {data.tema.length === 0 && (
        <KosongData judul="Belum ada tema yang bisa dinilai" ikon={IkonBuku}>
          Kerjakan ulangan yang bertag dulu, lalu tingkat pemahamanmu akan muncul di sini.
        </KosongData>
      )}

      {data.tema.length > 0 && tampil.length === 0 && (
        <KosongData judul="Tidak ada tema yang perlu dilatih" ikon={IkonBuku}>
          Semua tema sudah paham. Pertahankan ya — latihan tambahan tetap bisa dikerjakan kapan saja.
        </KosongData>
      )}

      <div className="d-flex flex-column gap-3">
        {tampil.map((tema) => {
          const level = tingkatTampilan(tema.tingkat)

          return (
            <div key={tema.tag_id} className="kartu-soft p-3">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="fw-semibold me-auto">{tema.tag_nama}</span>
                <span className={level.kelas}>{level.label}</span>
              </div>
              <div
                className="bar-tema my-2"
                role="img"
                aria-label={`${tema.tag_nama}: ${tema.persen}%`}
              >
                <span style={{ width: `${Math.max(0, Math.min(100, tema.persen))}%` }} />
              </div>
              <span className="teks-lembut small">
                {tema.jumlah_benar}/{tema.jumlah_soal} soal benar ({tema.persen}%)
              </span>
            </div>
          )
        })}
      </div>

      <h2 className="judul-bagian mt-4 mb-2">Latihan remedial</h2>

      {!data.remedial.diaktifkan && (
        <p className="teks-lembut">
          Remedial sedang dimatikan guru. Nilaimu tetap tersimpan dan bisa dilihat.
        </p>
      )}

      {data.remedial.diaktifkan && data.remedial.soal.length === 0 && (
        <KosongData judul="Belum ada tema yang perlu diulang" ikon={IkonBuku}>
          Pertahankan ya! Kalau nanti ada tema yang masih lemah, soal latihannya muncul di sini.
        </KosongData>
      )}

      {data.remedial.diaktifkan && data.remedial.soal.length > 0 && (
        <>
          <p className="teks-lembut small">
            Soal-soal ini diambil dari tema yang masih lemah. Ini latihan tambahan — nilai ulanganmu
            tidak berubah.
          </p>
          <div className="d-flex flex-column gap-2">
            {data.remedial.soal.map((soal) => (
              <div key={soal.id} className="kartu-soft p-3">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="badge-status lembut">{soal.tipe_label}</span>
                  <span className="badge-status info">{soal.tag_nama ?? 'Tanpa tema'}</span>
                  <span className="teks-lembut small ms-auto">{soal.skor} poin</span>
                </div>
                <p className="mb-0 mt-2">{soal.teks}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
