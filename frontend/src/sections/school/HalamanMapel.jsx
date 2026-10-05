/**
 * Halaman kelola mapel (slice 02) — guru/admin menambah, mengubah, menghapus.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaMapelForm } from './validasi.js'
import { ambilMapel, buatMapel, ubahMapel, hapusMapel } from './api.js'
import { pesanGalatApi, teksGalat } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'

const nilaiAwal = { nama: '', kode: '' }

export default function HalamanMapel() {
  const queryClient = useQueryClient()
  const [idUbah, setIdUbah] = useState(/** @type {number | null} */ (null))

  const daftarMapel = useQuery({ queryKey: ['mapel'], queryFn: ambilMapel })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaMapelForm),
    defaultValues: nilaiAwal,
  })

  const simpan = useMutation({
    mutationFn: async (/** @type {import('./validasi.js').DataMapelForm} */ data) => {
      const muatan = { nama: data.nama, kode: data.kode || undefined }
      return idUbah === null ? buatMapel(muatan) : ubahMapel(idUbah, muatan)
    },
    onSuccess: async () => {
      tampilkanToast('sukses', idUbah === null ? 'Mapel ditambahkan.' : 'Mapel diperbarui.')
      setIdUbah(null)
      reset(nilaiAwal)
      await queryClient.invalidateQueries({ queryKey: ['mapel'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const hapus = useMutation({
    mutationFn: async (/** @type {number} */ id) => hapusMapel(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Mapel dihapus.')
      await queryClient.invalidateQueries({ queryKey: ['mapel'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  /** @param {import('./api.js').DataMapel} mapel */
  function mulaiUbah(mapel) {
    setIdUbah(mapel.id)
    setValue('nama', mapel.nama)
    setValue('kode', mapel.kode ?? '')
  }

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <div className="kartu-soft p-4 h-100">
          <h1 className="h5 fw-bold mb-3">Kelola Mata Pelajaran</h1>

          {daftarMapel.isLoading && <p className="text-body-secondary">Memuat mapel…</p>}
          {daftarMapel.isError && <p className="status-salah">Gagal memuat mapel.</p>}

          {daftarMapel.data && daftarMapel.data.length === 0 && (
            <p className="text-body-secondary">Belum ada mata pelajaran.</p>
          )}

          {daftarMapel.data && daftarMapel.data.length > 0 && (
            <ul className="list-group list-group-flush">
              {daftarMapel.data.map((mapel) => (
                <li key={mapel.id} className="list-group-item d-flex align-items-center gap-3 px-0">
                  <div className="me-auto">
                    <span className="fw-semibold">{mapel.nama}</span>
                    {mapel.kode && <span className="badge text-bg-light ms-2">{mapel.kode}</span>}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => mulaiUbah(mapel)}
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={hapus.isPending}
                    onClick={() => {
                      if (window.confirm(`Hapus mapel ${mapel.nama}?`)) hapus.mutate(mapel.id)
                    }}
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="col-lg-5">
        <div className="kartu-soft p-4 h-100">
          <h2 className="h6 fw-bold mb-3">{idUbah === null ? 'Tambah Mapel' : 'Ubah Mapel'}</h2>

          <form onSubmit={handleSubmit((data) => simpan.mutate(data))} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="nama-mapel">Nama mapel</label>
              <input id="nama-mapel" className="form-control" placeholder="Contoh: Matematika" {...register('nama')} />
              {errors.nama && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.nama)}</p>}
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="kode-mapel">Kode (opsional)</label>
              <input id="kode-mapel" className="form-control" placeholder="MTK" {...register('kode')} />
              {errors.kode && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.kode)}</p>}
            </div>

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-aksen" disabled={isSubmitting || simpan.isPending}>
                {idUbah === null ? 'Tambah' : 'Simpan perubahan'}
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
