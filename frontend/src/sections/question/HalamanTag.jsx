/**
 * Halaman tag (slice 03) — tag soal sekaligus tema pemahaman pada laporan,
 * jadi guru menamainya sekali di sini dan memakainya di bank soal.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaTagForm } from './validasi.js'
import { ambilTag, buatTag, hapusTag, ubahTag } from './api.js'
import { pesanGalatApi, teksGalat } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'

const nilaiAwal = { nama: '', deskripsi: '' }

export default function HalamanTag() {
  const queryClient = useQueryClient()
  const [idUbah, setIdUbah] = useState(/** @type {number|null} */ (null))

  const daftarTag = useQuery({ queryKey: ['tag'], queryFn: ambilTag })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaTagForm),
    defaultValues: nilaiAwal,
  })

  const simpan = useMutation({
    mutationFn: async (/** @type {import('./validasi.js').DataTagForm} */ data) => {
      const muatan = { nama: data.nama, deskripsi: data.deskripsi || undefined }
      return idUbah === null ? buatTag(muatan) : ubahTag(idUbah, muatan)
    },
    onSuccess: async () => {
      tampilkanToast('sukses', idUbah === null ? 'Tag ditambahkan.' : 'Tag diperbarui.')
      setIdUbah(null)
      reset(nilaiAwal)
      await queryClient.invalidateQueries({ queryKey: ['tag'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const hapus = useMutation({
    mutationFn: async (/** @type {number} */ id) => hapusTag(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Tag dihapus.')
      await queryClient.invalidateQueries({ queryKey: ['tag'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  /** @param {import('./api.js').DataTag} tag */
  function mulaiUbah(tag) {
    setIdUbah(tag.id)
    setValue('nama', tag.nama)
    setValue('deskripsi', tag.deskripsi ?? '')
  }

  function batalUbah() {
    setIdUbah(null)
    reset(nilaiAwal)
  }

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <div className="kartu-soft p-4 h-100">
          <h1 className="h5 fw-bold mb-1">Tag &amp; Tema Pemahaman</h1>
          <p className="text-body-secondary">
            Satu tag dipakai dua hal: menandai soal di bank soal dan menjadi tema pada laporan pemahaman.
          </p>

          {daftarTag.isLoading && <p className="text-body-secondary">Memuat tag…</p>}
          {daftarTag.isError && <p className="status-salah">Gagal memuat tag.</p>}

          {daftarTag.data && daftarTag.data.length === 0 && (
            <p className="text-body-secondary">Belum ada tag. Tambahkan lewat formulir di samping.</p>
          )}

          {daftarTag.data && daftarTag.data.length > 0 && (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th scope="col">Nama</th>
                    <th scope="col">Deskripsi</th>
                    <th scope="col">Soal</th>
                    <th scope="col" className="text-end">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {daftarTag.data.map((tag) => (
                    <tr key={tag.id}>
                      <td className="fw-semibold">{tag.nama}</td>
                      <td className="text-body-secondary">{tag.deskripsi ?? '—'}</td>
                      <td>{tag.jumlah_soal ?? 0}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary me-2"
                          onClick={() => mulaiUbah(tag)}
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={hapus.isPending}
                          onClick={() => {
                            if (window.confirm(`Hapus tag ${tag.nama}? Soal yang memakainya kehilangan tag.`)) {
                              hapus.mutate(tag.id)
                            }
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
          <h2 className="h6 fw-bold mb-3">{idUbah === null ? 'Tambah Tag' : 'Ubah Tag'}</h2>

          <form onSubmit={handleSubmit((data) => simpan.mutate(data))} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="nama-tag">Nama tag</label>
              <input
                id="nama-tag"
                className="form-control"
                placeholder="Contoh: Operasi Hitung"
                {...register('nama')}
              />
              {errors.nama && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.nama)}</p>}
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="deskripsi-tag">Deskripsi (opsional)</label>
              <textarea
                id="deskripsi-tag"
                className="form-control"
                rows={3}
                placeholder="Keterangan singkat untuk guru lain."
                {...register('deskripsi')}
              />
              {errors.deskripsi && (
                <p className="status-salah small mb-0 mt-1">{teksGalat(errors.deskripsi)}</p>
              )}
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
