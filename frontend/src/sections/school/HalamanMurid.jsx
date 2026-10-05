/**
 * Halaman kelola murid (slice 02) — daftar, filter kelas, tambah/ubah/hapus,
 * plus tautan impor & ekspor CSV.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaMuridForm } from './validasi.js'
import {
  URL_EKSPOR_MURID,
  ambilKelas,
  ambilMurid,
  buatMurid,
  ubahMurid,
  hapusMurid,
} from './api.js'
import { pesanGalatApi, teksGalat } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { RUTE } from '../../routes.js'

const nilaiAwal = { nama: '', email: '', class_id: '', nis: '', nisn: '' }

export default function HalamanMurid() {
  const queryClient = useQueryClient()
  const [filterKelas, setFilterKelas] = useState('')
  const [idUbah, setIdUbah] = useState(/** @type {number | null} */ (null))

  const kelasId = filterKelas ? Number(filterKelas) : null
  const daftarKelas = useQuery({ queryKey: ['kelas'], queryFn: ambilKelas })
  const daftarMurid = useQuery({
    queryKey: ['murid', kelasId],
    queryFn: () => ambilMurid(kelasId),
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaMuridForm),
    defaultValues: nilaiAwal,
  })

  const simpan = useMutation({
    mutationFn: async (/** @type {import('./validasi.js').DataMuridForm} */ data) => {
      const muatan = {
        nama: data.nama,
        email: data.email,
        class_id: Number(data.class_id),
        nis: data.nis || undefined,
        nisn: data.nisn || undefined,
      }
      return idUbah === null ? buatMurid(muatan) : ubahMurid(idUbah, muatan)
    },
    onSuccess: async () => {
      tampilkanToast('sukses', idUbah === null ? 'Murid ditambahkan.' : 'Murid diperbarui.')
      setIdUbah(null)
      reset(nilaiAwal)
      await queryClient.invalidateQueries({ queryKey: ['murid'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const hapus = useMutation({
    mutationFn: async (/** @type {number} */ id) => hapusMurid(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Murid dihapus.')
      await queryClient.invalidateQueries({ queryKey: ['murid'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  /** @param {import('./api.js').DataMurid} murid */
  function mulaiUbah(murid) {
    setIdUbah(murid.id)
    setValue('nama', murid.nama)
    setValue('email', murid.email)
    setValue('class_id', String(murid.class_id))
    setValue('nis', murid.nis ?? '')
    setValue('nisn', murid.nisn ?? '')
  }

  return (
    <div className="row g-4">
      <div className="col-lg-8">
        <div className="kartu-soft p-4 h-100">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <h1 className="h5 fw-bold mb-0 me-auto">Data Murid</h1>
            <Link className="btn btn-sm btn-outline-primary" to={RUTE.imporMurid}>
              Impor CSV
            </Link>
            <a className="btn btn-sm btn-outline-primary" href={URL_EKSPOR_MURID}>
              Ekspor CSV
            </a>
          </div>

          <div className="mb-3" style={{ maxWidth: '16rem' }}>
            <label className="form-label small fw-semibold" htmlFor="filter-kelas">Filter kelas</label>
            <select
              id="filter-kelas"
              className="form-select form-select-sm"
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
            >
              <option value="">Semua kelas</option>
              {(daftarKelas.data ?? []).map((kelas) => (
                <option key={kelas.id} value={String(kelas.id)}>{kelas.nama}</option>
              ))}
            </select>
          </div>

          {daftarMurid.isLoading && <p className="text-body-secondary">Memuat murid…</p>}
          {daftarMurid.isError && <p className="status-salah">Gagal memuat data murid.</p>}

          {daftarMurid.data && daftarMurid.data.length === 0 && (
            <p className="text-body-secondary">Belum ada murid pada filter ini.</p>
          )}

          {daftarMurid.data && daftarMurid.data.length > 0 && (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th scope="col">NIS</th>
                    <th scope="col">Nama</th>
                    <th scope="col">Kelas</th>
                    <th scope="col" className="text-end">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {daftarMurid.data.map((murid) => (
                    <tr key={murid.id}>
                      <td>{murid.nis ?? '—'}</td>
                      <td>
                        <span className="fw-semibold d-block">{murid.nama}</span>
                        <span className="text-body-secondary small">{murid.email}</span>
                      </td>
                      <td>{murid.kelas_nama}</td>
                      <td className="text-end">
                        <button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={() => mulaiUbah(murid)}>
                          Ubah
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={hapus.isPending}
                          onClick={() => {
                            if (window.confirm(`Hapus murid ${murid.nama}?`)) hapus.mutate(murid.id)
                          }}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="col-lg-4">
        <div className="kartu-soft p-4 h-100">
          <h2 className="h6 fw-bold mb-3">{idUbah === null ? 'Tambah Murid' : 'Ubah Murid'}</h2>

          <form onSubmit={handleSubmit((data) => simpan.mutate(data))} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="nama-murid">Nama</label>
              <input id="nama-murid" className="form-control" {...register('nama')} />
              {errors.nama && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.nama)}</p>}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="email-murid">Email</label>
              <input id="email-murid" type="email" className="form-control" {...register('email')} />
              {errors.email && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.email)}</p>}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="kelas-murid">Kelas</label>
              <select id="kelas-murid" className="form-select" {...register('class_id')}>
                <option value="">Pilih kelas…</option>
                {(daftarKelas.data ?? []).map((kelas) => (
                  <option key={kelas.id} value={String(kelas.id)}>{kelas.nama}</option>
                ))}
              </select>
              {errors.class_id && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.class_id)}</p>}
            </div>

            <div className="row g-2 mb-4">
              <div className="col-6">
                <label className="form-label fw-semibold" htmlFor="nis-murid">NIS</label>
                <input id="nis-murid" className="form-control" {...register('nis')} />
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold" htmlFor="nisn-murid">NISN</label>
                <input id="nisn-murid" className="form-control" {...register('nisn')} />
              </div>
            </div>

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-aksen" disabled={isSubmitting || simpan.isPending}>
                {idUbah === null ? 'Tambah' : 'Simpan'}
              </button>
              {idUbah !== null && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setIdUbah(null)
                    reset(nilaiAwal)
                  }}
                >
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
