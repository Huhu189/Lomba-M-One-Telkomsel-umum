/**
 * Kelola tim untuk kuis mode kelompok (slice 09-C) — layar guru.
 *
 * Satu tim memakai satu lembar jawaban bersama, jadi susunan tim ditentukan
 * SEBELUM kuis dikerjakan. Setelah ada tim yang mulai mengerjakan, server
 * membekukan susunannya (dan halaman ini menampilkan alasannya) supaya tidak ada
 * anak yang nilainya berpindah di tengah jalan.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { RUTE, ruteKuisDetail } from '../../routes.js'
import {
  ambilDaftarTim,
  bagiTimOtomatis,
  hapusTim,
  muridTanpaTim,
  ringkasAnggotaTim,
  simpanTim,
  usulJumlahTim,
} from './tim.js'

/**
 * Form satu tim: nama + pilih anggota dari murid kelas.
 * @param {{
 *   kuisId: number,
 *   muridKelas: import('./tim.js').DataMuridKelas[],
 *   tim: import('./tim.js').DataTim | null,
 *   onSelesai: () => void,
 *   onBatal?: () => void,
 * }} props
 */
function FormTim({ kuisId, muridKelas, tim, onSelesai, onBatal }) {
  const [nama, setNama] = useState(tim?.nama ?? '')
  const [pilihan, setPilihan] = useState(/** @type {number[]} */ (tim?.anggota.map((a) => a.murid_id) ?? []))

  const simpan = useMutation({
    mutationFn: () =>
      simpanTim(kuisId, {
        ...(tim !== null ? { tim_id: tim.id } : {}),
        nama: nama.trim(),
        murid: pilihan,
      }),
    onSuccess: (hasil) => {
      tampilkanToast('sukses', `${hasil.tim.nama} tersimpan (${hasil.tim.jumlah_anggota} anggota).`)
      onSelesai()
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const gagalNama = nama.trim().length < 2
  const gagalAnggota = pilihan.length < 2

  return (
    <div className="kartu-lembut p-3 mb-3">
      <div className="row g-2 align-items-end">
        <div className="col-sm-5">
          <label className="form-label fw-semibold" htmlFor={`nama-tim-${tim?.id ?? 'baru'}`}>
            Nama tim
          </label>
          <input
            id={`nama-tim-${tim?.id ?? 'baru'}`}
            className="form-control"
            value={nama}
            maxLength={60}
            onChange={(e) => setNama(e.target.value)}
            placeholder="mis. Tim Merah"
          />
        </div>
        <div className="col-sm-7 d-flex flex-wrap gap-2">
          <Tombol
            memuat={simpan.isPending}
            teksMemuat="Menyimpan…"
            disabled={gagalNama || gagalAnggota}
            onClick={() => simpan.mutate()}
          >
            {tim !== null ? 'Simpan perubahan' : 'Buat tim'}
          </Tombol>
          {onBatal !== undefined && (
            <button type="button" className="btn btn-tepi" onClick={onBatal}>
              Batal
            </button>
          )}
        </div>
      </div>

      <fieldset className="mt-3">
        <legend className="form-label fw-semibold">Anggota (minimal 2 murid)</legend>
        <div className="d-flex flex-wrap gap-3">
          {muridKelas.map((murid) => {
            const timLain = murid.tim_id !== null && murid.tim_id !== tim?.id
            const dicentang = pilihan.includes(murid.murid_id)

            return (
              <div className="form-check" key={murid.murid_id}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`anggota-${tim?.id ?? 'baru'}-${murid.murid_id}`}
                  checked={dicentang}
                  disabled={timLain}
                  onChange={(e) =>
                    setPilihan((sebelum) =>
                      e.target.checked
                        ? [...sebelum, murid.murid_id]
                        : sebelum.filter((satu) => satu !== murid.murid_id),
                    )
                  }
                />
                <label className="form-check-label" htmlFor={`anggota-${tim?.id ?? 'baru'}-${murid.murid_id}`}>
                  {murid.nama}
                  {timLain && <span className="teks-lembut small"> ({murid.tim_nama})</span>}
                </label>
              </div>
            )
          })}
        </div>
      </fieldset>

      {gagalAnggota && pilihan.length > 0 && (
        <p className="status-salah small mb-0 mt-2">Pilih minimal 2 murid supaya tim benar-benar bekerja bersama.</p>
      )}
    </div>
  )
}

export default function HalamanTim() {
  const { id } = useParams()
  const nomor = Number(id)
  const klienQuery = useQueryClient()

  const [timDiedit, setTimDiedit] = useState(/** @type {import('./tim.js').DataTim | null} */ (null))
  const [buatBaru, setBuatBaru] = useState(false)
  const [jumlahTim, setJumlahTim] = useState('')

  const daftar = useQuery({
    queryKey: ['tim', nomor],
    queryFn: () => ambilDaftarTim(nomor),
    enabled: Number.isInteger(nomor) && nomor > 0,
  })

  const data = daftar.data

  const bagi = useMutation({
    mutationFn: (/** @type {number} */ jumlah) => bagiTimOtomatis(nomor, jumlah),
    onSuccess: (hasil) => {
      tampilkanToast('sukses', `${hasil.jumlah_tim} tim dibagi otomatis.`)
      setJumlahTim('')
      void klienQuery.invalidateQueries({ queryKey: ['tim', nomor] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const buang = useMutation({
    mutationFn: (/** @type {number} */ timId) => hapusTim(nomor, timId),
    onSuccess: (hasil) => {
      tampilkanToast('sukses', hasil.message)
      setTimDiedit(null)
      void klienQuery.invalidateQueries({ queryKey: ['tim', nomor] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  if (daftar.isLoading) {
    return <p className="text-body-secondary">Menyusun daftar tim…</p>
  }

  if (daftar.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Daftar tim belum bisa dibuka">
        <p className="mb-0">Halaman ini khusus guru pemilik kuis.</p>
      </Banner>
    )
  }

  const saranJumlah = jumlahTim !== '' ? Number(jumlahTim) : usulJumlahTim(data.murid_kelas.length)
  const belumBertim = muridTanpaTim(data.murid_kelas)

  return (
    <div className="row justify-content-center">
      <div className="col-lg-10">
        <div className="kartu-soft p-4 p-md-5">
          <Link className="btn btn-sm btn-tepi mb-3" to={ruteKuisDetail(data.kuis_id)}>
            ← Kembali ke detail kuis
          </Link>

          <h1 className="h5 fw-bold mb-1">Kelola tim · {data.judul_kuis}</h1>
          <p className="teks-lembut small mb-3">
            {data.mapel_nama ?? '—'} · {data.kelas_nama ?? '—'} · {data.jumlah_tim} tim ·{' '}
            {data.murid_kelas.length} murid di kelas ini.
          </p>

          {!data.mode_tim && (
            <Banner jenis="peringatan" judul="Mode tim belum dinyalakan">
              <p className="mb-0">
                Susunan tim di bawah sudah tersimpan, tetapi kuis baru berjalan sebagai tim setelah kunci{' '}
                <strong>mode tim</strong> dinyalakan di <Link to={RUTE.pengaturan}>pengaturan</Link> (bisa per kuis).
              </p>
            </Banner>
          )}

          {data.ada_attempt && (
            <Banner jenis="info" judul="Susunan tim sudah dibekukan">
              <p className="mb-0">
                Sudah ada tim yang mengerjakan kuis ini, jadi anggota tidak bisa diubah lagi — supaya nilai tim tidak
                berpindah setelah jawaban dikirim.
              </p>
            </Banner>
          )}

          {!data.ada_attempt && data.murid_kelas.length >= 4 && (
            <div className="kartu-lembut p-3 mb-3">
              <label className="form-label fw-semibold" htmlFor="jumlah-tim">
                Bagi otomatis jadi berapa tim?
              </label>
              <div className="d-flex flex-wrap gap-2 align-items-end">
                <input
                  id="jumlah-tim"
                  className="form-control"
                  style={{ maxWidth: '8rem' }}
                  type="number"
                  min={2}
                  max={20}
                  value={jumlahTim}
                  onChange={(e) => setJumlahTim(e.target.value)}
                  placeholder={String(usulJumlahTim(data.murid_kelas.length))}
                />
                <Tombol
                  varian="tepi"
                  memuat={bagi.isPending}
                  teksMemuat="Membagi…"
                  disabled={saranJumlah < 2}
                  onClick={() => bagi.mutate(saranJumlah)}
                >
                  Bagi otomatis
                </Tombol>
                <span className="teks-lembut small">
                  Pembagian ini menggantikan seluruh tim yang ada dan mencampur murid secara bergiliran.
                </span>
              </div>
            </div>
          )}

          {data.tim.length === 0 && (
            <p className="text-body-secondary">Belum ada tim. Bagi otomatis di atas, atau buat tim satu per satu.</p>
          )}

          {data.tim.map((tim) =>
            timDiedit?.id === tim.id ? (
              <FormTim
                key={tim.id}
                kuisId={data.kuis_id}
                muridKelas={data.murid_kelas}
                tim={tim}
                onBatal={() => setTimDiedit(null)}
                onSelesai={() => {
                  setTimDiedit(null)
                  void klienQuery.invalidateQueries({ queryKey: ['tim', nomor] })
                }}
              />
            ) : (
              <section className="kartu-soft p-3 mb-3" key={tim.id} aria-label={`Tim ${tim.nama}`}>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="fw-semibold">{tim.nama}</span>
                  <span className="badge-status lembut">{tim.jumlah_anggota} anggota</span>
                  <div className="ms-auto d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-tepi"
                      disabled={data.ada_attempt}
                      onClick={() => setTimDiedit(tim)}
                    >
                      Ubah anggota
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-tepi"
                      disabled={data.ada_attempt || buang.isPending}
                      onClick={() => buang.mutate(tim.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
                <p className="teks-lembut small mb-0 mt-2">{ringkasAnggotaTim(tim)}</p>
              </section>
            ),
          )}

          {!buatBaru && !data.ada_attempt && (
            <Tombol varian="tepi" onClick={() => setBuatBaru(true)}>
              Buat tim baru
            </Tombol>
          )}

          {buatBaru && (
            <FormTim
              kuisId={data.kuis_id}
              muridKelas={data.murid_kelas}
              tim={null}
              onBatal={() => setBuatBaru(false)}
              onSelesai={() => {
                setBuatBaru(false)
                void klienQuery.invalidateQueries({ queryKey: ['tim', nomor] })
              }}
            />
          )}

          {belumBertim.length > 0 && !data.ada_attempt && (
            <p className="teks-lembut small mt-3 mb-0">
              Belum masuk tim: {belumBertim.map((murid) => murid.nama).join(', ')}.
            </p>
          )}

          <div className="d-flex flex-wrap gap-2 mt-4">
            <Link className="btn btn-tepi" to={RUTE.kuis}>
              Daftar kuis
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
