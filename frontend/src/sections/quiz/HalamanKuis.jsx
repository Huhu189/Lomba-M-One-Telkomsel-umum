/**
 * Halaman kelola kuis (slice 03) — guru menyusun jadwal, memilih soal dari
 * bank soal, lalu menerbitkan kuis dengan validasi kelengkapan dari server.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ambilKelas, ambilMapel } from '../school/api.js'
import { ambilSoal } from '../question/api.js'
import { teksAman } from '../question/tipeSoal.js'
import { skemaKuisForm } from '../question/validasi.js'
import {
  ambilKuis,
  ambilKuisDetail,
  arsipkanKuis,
  buatKuis,
  hapusKuis,
  publikasiKuis,
  sinkronSoalKuis,
  ubahKuis,
} from './api.js'
import { formatDurasi, formatJadwal, keIso, keLokal, statusTampilan } from './status.js'
import { pesanGalatApi, teksGalat } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'

const nilaiAwal = {
  judul: '',
  deskripsi: '',
  subject_id: '',
  class_id: '',
  durasi_menit: '30',
  mulai_at: '',
  selesai_at: '',
  acak_soal: true,
  acak_opsi: true,
}

/**
 * Ringkas teks soal untuk daftar pilihan.
 * @param {Record<string, unknown>} konten
 */
function ringkasSoal(konten) {
  const teks = teksAman(konten.teks).trim()
  return teks.length > 70 ? `${teks.slice(0, 70)}…` : teks || '(tanpa teks)'
}

export default function HalamanKuis() {
  const queryClient = useQueryClient()
  const [idUbah, setIdUbah] = useState(/** @type {number|null} */ (null))
  const [kuisDisusun, setKuisDisusun] = useState(/** @type {import('./api.js').DataKuis|null} */ (null))
  const [soalTerpilih, setSoalTerpilih] = useState(/** @type {number[]} */ ([]))

  const daftarKuis = useQuery({ queryKey: ['kuis'], queryFn: ambilKuis })
  const mapel = useQuery({ queryKey: ['mapel'], queryFn: ambilMapel })
  const kelas = useQuery({ queryKey: ['kelas'], queryFn: ambilKelas })
  const bankSoal = useQuery({ queryKey: ['soal', 'semua'], queryFn: () => ambilSoal({}) })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaKuisForm),
    defaultValues: nilaiAwal,
  })

  const segarkan = async () => {
    await queryClient.invalidateQueries({ queryKey: ['kuis'] })
  }

  const simpan = useMutation({
    mutationFn: async (/** @type {import('../question/validasi.js').DataKuisForm} */ data) => {
      /** @type {import('./api.js').MuatanKuis} */
      const muatan = {
        judul: data.judul,
        deskripsi: data.deskripsi || undefined,
        subject_id: Number(data.subject_id),
        class_id: Number(data.class_id),
        durasi_menit: Number(data.durasi_menit),
        mulai_at: keIso(data.mulai_at),
        selesai_at: keIso(data.selesai_at),
        acak_soal: data.acak_soal,
        acak_opsi: data.acak_opsi,
      }
      return idUbah === null ? buatKuis(muatan) : ubahKuis(idUbah, muatan)
    },
    onSuccess: async (kuis) => {
      tampilkanToast('sukses', idUbah === null ? 'Kuis dibuat sebagai draf.' : 'Kuis diperbarui.')
      setIdUbah(null)
      reset(nilaiAwal)
      await segarkan()
      if (idUbah === null) {
        setKuisDisusun(kuis)
        setSoalTerpilih([])
      }
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const simpanSusunan = useMutation({
    mutationFn: async (/** @type {{ id: number, soal: number[] }} */ muatan) =>
      sinkronSoalKuis(muatan.id, muatan.soal),
    onSuccess: async () => {
      tampilkanToast('sukses', 'Susunan soal disimpan.')
      await segarkan()
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const publikasi = useMutation({
    mutationFn: async (/** @type {number} */ id) => publikasiKuis(id),
    onSuccess: async () => {
      tampilkanToast('sukses', 'Kuis diterbitkan. Murid di kelas itu sudah bisa melihatnya.')
      await segarkan()
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const arsipkan = useMutation({
    mutationFn: async (/** @type {number} */ id) => arsipkanKuis(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Kuis diarsipkan.')
      await segarkan()
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const hapus = useMutation({
    mutationFn: async (/** @type {number} */ id) => hapusKuis(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Kuis dihapus.')
      await segarkan()
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  /** @param {import('./api.js').DataKuis} kuis */
  function mulaiUbah(kuis) {
    setIdUbah(kuis.id)
    setValue('judul', kuis.judul)
    setValue('deskripsi', kuis.deskripsi ?? '')
    setValue('subject_id', String(kuis.subject_id ?? ''))
    setValue('class_id', String(kuis.class_id ?? ''))
    setValue('durasi_menit', String(kuis.durasi_menit))
    setValue('mulai_at', keLokal(kuis.mulai_at))
    setValue('selesai_at', keLokal(kuis.selesai_at))
    setValue('acak_soal', kuis.acak_soal ?? true)
    setValue('acak_opsi', kuis.acak_opsi ?? true)
  }

  function batalUbah() {
    setIdUbah(null)
    reset(nilaiAwal)
  }

  /**
   * Buka panel susun soal dan ambil susunan yang sudah tersimpan.
   * @param {import('./api.js').DataKuis} kuis
   */
  async function bukaSusun(kuis) {
    try {
      const rinci = await ambilKuisDetail(kuis.id)
      setSoalTerpilih((rinci.soal ?? []).map((satu) => satu.id))
      setKuisDisusun(kuis)
    } catch (galat) {
      tampilkanToast('salah', pesanGalatApi(galat))
    }
  }

  /** @param {number} id */
  function alihkan(id) {
    setSoalTerpilih((lama) => (lama.includes(id) ? lama.filter((satu) => satu !== id) : [...lama, id]))
  }

  /** @param {number} index @param {number} arah */
  function geser(index, arah) {
    const tujuan = index + arah
    if (tujuan < 0 || tujuan >= soalTerpilih.length) return
    const salinan = [...soalTerpilih]
    const [dipindah] = salinan.splice(index, 1)
    salinan.splice(tujuan, 0, dipindah)
    setSoalTerpilih(salinan)
  }

  const katalog = bankSoal.data?.data ?? []

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <div className="kartu-soft p-4">
          <h1 className="h5 fw-bold mb-1">Kuis &amp; Ulangan</h1>
          <p className="text-body-secondary">
            Kuis dibuat sebagai draf; murid baru melihatnya setelah diterbitkan dan jadwalnya dimulai.
          </p>

          {daftarKuis.isLoading && <p className="text-body-secondary">Memuat kuis…</p>}
          {daftarKuis.isError && <p className="status-salah">Gagal memuat kuis.</p>}

          {daftarKuis.data && daftarKuis.data.length === 0 && (
            <p className="text-body-secondary">Belum ada kuis. Buat kuis pertama lewat formulir di samping.</p>
          )}

          <div className="d-flex flex-column gap-3">
            {(daftarKuis.data ?? []).map((kuis) => {
              const status = statusTampilan(kuis)

              return (
                <div key={kuis.id} className="kartu-soal p-3">
                  <div className="d-flex flex-wrap align-items-baseline gap-2">
                    <h2 className="h6 fw-bold mb-0">{kuis.judul}</h2>
                    <span className={`badge-status ${status.jenis}`}>{status.label}</span>
                    <span className="teks-lembut small ms-auto">
                      {kuis.mapel_nama ?? '—'} · {kuis.kelas_nama ?? '—'}
                    </span>
                  </div>

                  <p className="teks-lembut small mb-2">
                    {kuis.jumlah_soal ?? 0} soal · {formatDurasi(kuis.durasi_menit)} · jadwal{' '}
                    {formatJadwal(kuis.mulai_at)} s.d. {formatJadwal(kuis.selesai_at)}
                  </p>

                  <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => mulaiUbah(kuis)}>
                      Ubah
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => void bukaSusun(kuis)}>
                      Susun soal
                    </button>
                    {kuis.status === 'draf' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-aksen"
                        disabled={publikasi.isPending}
                        onClick={() => publikasi.mutate(kuis.id)}
                      >
                        Terbitkan
                      </button>
                    )}
                    {kuis.status !== 'arsip' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={arsipkan.isPending}
                        onClick={() => arsipkan.mutate(kuis.id)}
                      >
                        Arsipkan
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={hapus.isPending}
                      onClick={() => {
                        if (window.confirm(`Hapus kuis “${kuis.judul}”?`)) hapus.mutate(kuis.id)
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="col-lg-5">
        <div className="kartu-soft p-4">
          <h2 className="h6 fw-bold mb-3">{idUbah === null ? 'Buat Kuis' : 'Ubah Kuis'}</h2>

          <form onSubmit={handleSubmit((data) => simpan.mutate(data))} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="kuis-judul">Judul</label>
              <input
                id="kuis-judul"
                className="form-control"
                placeholder="Ulangan Harian Matematika"
                {...register('judul')}
              />
              {errors.judul && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.judul)}</p>}
            </div>

            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <label className="form-label fw-semibold" htmlFor="kuis-mapel">Mapel</label>
                <select id="kuis-mapel" className="form-select" {...register('subject_id')}>
                  <option value="">Pilih mapel…</option>
                  {(mapel.data ?? []).map((satu) => (
                    <option key={satu.id} value={String(satu.id)}>{satu.nama}</option>
                  ))}
                </select>
                {errors.subject_id && (
                  <p className="status-salah small mb-0 mt-1">{teksGalat(errors.subject_id)}</p>
                )}
              </div>

              <div className="col-sm-6">
                <label className="form-label fw-semibold" htmlFor="kuis-kelas">Kelas</label>
                <select id="kuis-kelas" className="form-select" {...register('class_id')}>
                  <option value="">Pilih kelas…</option>
                  {(kelas.data ?? []).map((satu) => (
                    <option key={satu.id} value={String(satu.id)}>{satu.nama}</option>
                  ))}
                </select>
                {errors.class_id && (
                  <p className="status-salah small mb-0 mt-1">{teksGalat(errors.class_id)}</p>
                )}
              </div>

              <div className="col-sm-6">
                <label className="form-label fw-semibold" htmlFor="kuis-durasi">Durasi (menit)</label>
                <input
                  id="kuis-durasi"
                  className="form-control"
                  type="number"
                  min={1}
                  max={300}
                  {...register('durasi_menit')}
                />
                {errors.durasi_menit && (
                  <p className="status-salah small mb-0 mt-1">{teksGalat(errors.durasi_menit)}</p>
                )}
              </div>

              <div className="col-sm-6">
                <label className="form-label fw-semibold" htmlFor="kuis-mulai">Mulai</label>
                <input id="kuis-mulai" className="form-control" type="datetime-local" {...register('mulai_at')} />
              </div>

              <div className="col-sm-6">
                <label className="form-label fw-semibold" htmlFor="kuis-selesai">Selesai</label>
                <input
                  id="kuis-selesai"
                  className="form-control"
                  type="datetime-local"
                  {...register('selesai_at')}
                />
                {errors.selesai_at && (
                  <p className="status-salah small mb-0 mt-1">{teksGalat(errors.selesai_at)}</p>
                )}
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="kuis-deskripsi">Deskripsi (opsional)</label>
              <textarea id="kuis-deskripsi" className="form-control" rows={2} {...register('deskripsi')} />
            </div>

            <div className="d-flex flex-wrap gap-3 mb-4">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" role="switch" id="kuis-acak-soal" {...register('acak_soal')} />
                <label className="form-check-label" htmlFor="kuis-acak-soal">Acak urutan soal</label>
              </div>
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" role="switch" id="kuis-acak-opsi" {...register('acak_opsi')} />
                <label className="form-check-label" htmlFor="kuis-acak-opsi">Acak urutan opsi</label>
              </div>
            </div>

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-aksen" disabled={isSubmitting || simpan.isPending}>
                {idUbah === null ? 'Buat kuis' : 'Simpan perubahan'}
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

      {kuisDisusun !== null && (
        <div className="col-12">
          <div className="kartu-soft p-4">
            <div className="d-flex flex-wrap align-items-baseline gap-2 mb-3">
              <h2 className="h6 fw-bold mb-0">Susun soal — {kuisDisusun.judul}</h2>
              <span className="teks-lembut small">
                Urutan di kanan adalah urutan soal bagi murid (bila acak soal dimatikan).
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary ms-auto"
                onClick={() => setKuisDisusun(null)}
              >
                Tutup
              </button>
            </div>

            <div className="row g-4">
              <div className="col-lg-6">
                <h3 className="h6 fw-semibold teks-lembut">Bank soal</h3>
                {bankSoal.isLoading && <p className="text-body-secondary">Memuat bank soal…</p>}
                {katalog.length === 0 && <p className="text-body-secondary">Bank soal masih kosong.</p>}

                <ul className="list-unstyled mb-0">
                  {katalog.map((soal) => (
                    <li key={soal.id} className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`pilih-soal-${soal.id}`}
                        checked={soalTerpilih.includes(soal.id)}
                        onChange={() => alihkan(soal.id)}
                      />
                      <label className="form-check-label" htmlFor={`pilih-soal-${soal.id}`}>
                        <span className="badge-status lembut me-2">{soal.tipe_label}</span>
                        {ringkasSoal(soal.konten)}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="col-lg-6">
                <h3 className="h6 fw-semibold teks-lembut">Susunan kuis ({soalTerpilih.length} soal)</h3>

                {soalTerpilih.length === 0 && (
                  <p className="text-body-secondary">Belum ada soal dipilih.</p>
                )}

                <ol className="list-unstyled mb-3">
                  {soalTerpilih.map((id, index) => {
                    const soal = katalog.find((satu) => satu.id === id)

                    return (
                      <li key={id} className="d-flex align-items-center gap-2 mb-2">
                        <span className="opsi-huruf">{index + 1}</span>
                        <span className="flex-grow-1 small">{soal ? ringkasSoal(soal.konten) : `Soal #${id}`}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          aria-label={`Naikkan soal nomor ${index + 1}`}
                          disabled={index === 0}
                          onClick={() => geser(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          aria-label={`Turunkan soal nomor ${index + 1}`}
                          disabled={index === soalTerpilih.length - 1}
                          onClick={() => geser(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          aria-label={`Keluarkan soal nomor ${index + 1}`}
                          onClick={() => alihkan(id)}
                        >
                          Keluarkan
                        </button>
                      </li>
                    )
                  })}
                </ol>

                <button
                  type="button"
                  className="btn btn-aksen"
                  disabled={simpanSusunan.isPending}
                  onClick={() => simpanSusunan.mutate({ id: kuisDisusun.id, soal: soalTerpilih })}
                >
                  Simpan susunan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
