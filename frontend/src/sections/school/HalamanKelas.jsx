/**
 * Halaman kelola kelas (slice 02) — guru/admin menambah, mengubah, menghapus.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaKelasForm } from './validasi.js'
import { ambilKelas, buatKelas, ubahKelas, hapusKelas } from './api.js'
import { pesanGalatApi, teksGalat } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'

const nilaiAwal = { nama: '', tingkat: '', tahun_ajaran: '' }

export default function HalamanKelas() {
  const queryClient = useQueryClient()
  const [idUbah, setIdUbah] = useState(/** @type {number | null} */ (null))

  const daftarKelas = useQuery({ queryKey: ['kelas'], queryFn: ambilKelas })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaKelasForm),
    defaultValues: nilaiAwal,
  })

  const simpan = useMutation({
    mutationFn: async (/** @type {import('./validasi.js').DataKelasForm} */ data) => {
      const muatan = {
        nama: data.nama,
        tingkat: Number(data.tingkat),
        tahun_ajaran: data.tahun_ajaran || undefined,
      }
      return idUbah === null ? buatKelas(muatan) : ubahKelas(idUbah, muatan)
    },
    onSuccess: async () => {
      tampilkanToast('sukses', idUbah === null ? 'Kelas ditambahkan.' : 'Kelas diperbarui.')
      setIdUbah(null)
      reset(nilaiAwal)
      await queryClient.invalidateQueries({ queryKey: ['kelas'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const hapus = useMutation({
    mutationFn: async (/** @type {number} */ id) => hapusKelas(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Kelas dihapus.')
      await queryClient.invalidateQueries({ queryKey: ['kelas'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  /** @param {import('./api.js').DataKelas} kelas */
  function mulaiUbah(kelas) {
    setIdUbah(kelas.id)
    setValue('nama', kelas.nama)
    setValue('tingkat', String(kelas.tingkat))
    setValue('tahun_ajaran', kelas.tahun_ajaran ?? '')
  }

  function batalUbah() {
    setIdUbah(null)
    reset(nilaiAwal)
  }

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <div className="kartu-soft p-4 h-100">
          <h1 className="h5 fw-bold mb-3">Kelola Kelas</h1>

          {daftarKelas.isLoading && <p className="text-body-secondary">Memuat kelas…</p>}
          {daftarKelas.isError && <p className="status-salah">Gagal memuat kelas.</p>}

          {daftarKelas.data && daftarKelas.data.length === 0 && (
            <p className="text-body-secondary">Belum ada kelas. Tambahkan lewat formulir di samping.</p>
          )}

          {daftarKelas.data && daftarKelas.data.length > 0 && (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th scope="col">Nama</th>
                    <th scope="col">Tingkat</th>
                    <th scope="col">Murid</th>
                    <th scope="col" className="text-end">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {daftarKelas.data.map((kelas) => (
                    <tr key={kelas.id}>
                      <td className="fw-semibold">{kelas.nama}</td>
                      <td>{kelas.tingkat}</td>
                      <td>{kelas.jumlah_murid ?? 0}</td>
                      <td className="text-end">
                        <button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={() => mulaiUbah(kelas)}>
                          Ubah
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={hapus.isPending}
                          onClick={() => {
                            if (window.confirm(`Hapus kelas ${kelas.nama}?`)) hapus.mutate(kelas.id)
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

      <div className="col-lg-5">
        <div className="kartu-soft p-4 h-100">
          <h2 className="h6 fw-bold mb-3">{idUbah === null ? 'Tambah Kelas' : 'Ubah Kelas'}</h2>

          <form onSubmit={handleSubmit((data) => simpan.mutate(data))} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="nama-kelas">Nama kelas</label>
              <input id="nama-kelas" className="form-control" placeholder="Contoh: 6A" {...register('nama')} />
              {errors.nama && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.nama)}</p>}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="tingkat-kelas">Tingkat</label>
              <select id="tingkat-kelas" className="form-select" {...register('tingkat')}>
                <option value="">Pilih tingkat…</option>
                {[1, 2, 3, 4, 5, 6].map((t) => (
                  <option key={t} value={String(t)}>{t}</option>
                ))}
              </select>
              {errors.tingkat && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.tingkat)}</p>}
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="tahun-kelas">Tahun ajaran (opsional)</label>
              <input id="tahun-kelas" className="form-control" placeholder="2026/2027" {...register('tahun_ajaran')} />
            </div>

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-aksen" disabled={isSubmitting || simpan.isPending}>
                {idUbah === null ? 'Tambah' : 'Simpan perubahan'}
              </button>
              {idUbah !== null && (
                <button type="button" className="btn btn-outline-secondary" onClick={batalUbah}>
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
