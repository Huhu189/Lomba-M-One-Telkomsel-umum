/**
 * Layar materi guru (slice 08).
 *
 * Halaman ini hanya mengurus daftar dan pembuatan materi. Begitu materi dibuat,
 * guru langsung dibawa ke editor bergaya video editor (`EditorMateri`) supaya
 * bisa menimpa media, menyisipkan kuis, dan menyusun urutan blok tanpa langkah
 * tambahan. Server tetap penentu akhir kelengkapan materi.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { ambilKelas, ambilMapel } from '../school/api.js'
import { ambilTag } from '../question/api.js'
import { ruteMateriEditor } from '../../routes.js'
import { ambilMateri, buatMateri } from './api.js'

export default function HalamanMateri() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [galat, setGalat] = useState('')
  const [form, setForm] = useState({
    judul: '',
    deskripsi: '',
    subject_id: '',
    class_id: '',
    tag_id: '',
  })

  const daftar = useQuery({ queryKey: ['materi'], queryFn: ambilMateri })
  const kelas = useQuery({ queryKey: ['kelas'], queryFn: ambilKelas })
  const mapel = useQuery({ queryKey: ['mapel'], queryFn: ambilMapel })
  const tag = useQuery({ queryKey: ['tag'], queryFn: ambilTag })

  const simpanMateri = useMutation({
    mutationFn: async (/** @type {import('./api.js').MuatanMateri} */ data) => buatMateri(data),
    onSuccess: (materi) => {
      setGalat('')
      setForm({ judul: '', deskripsi: '', subject_id: '', class_id: '', tag_id: '' })
      tampilkanToast('sukses', 'Materi dibuat. Lanjut menyusun di editor.')
      void queryClient.invalidateQueries({ queryKey: ['materi'] })
      // Langsung masuk editor: guru tidak perlu mencari materi di daftar dulu.
      navigate(ruteMateriEditor(materi.id))
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  return (
    <div className="container py-4">
      <h1 className="h4 fw-bold mb-1">Materi Pelajaran</h1>
      <p className="teks-lembut">
        Buat materi baru, lalu susun blok media, teks, dan kuis sisipan di editor.
      </p>

      {galat && <Banner jenis="salah">{galat}</Banner>}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <section className="kartu-soal p-3">
            <h2 className="h6 fw-bold mb-3">Materi baru</h2>
            <div className="mb-2">
              <label className="form-label" htmlFor="materi-judul">
                Judul
              </label>
              <input
                id="materi-judul"
                className="form-control"
                value={form.judul}
                onChange={(e) => setForm({ ...form, judul: e.target.value })}
                maxLength={150}
              />
            </div>
            <div className="mb-2">
              <label className="form-label" htmlFor="materi-mapel">
                Mapel
              </label>
              <select
                id="materi-mapel"
                className="form-select"
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              >
                <option value="">Pilih mapel…</option>
                {(mapel.data ?? []).map((satu) => (
                  <option key={satu.id} value={satu.id}>
                    {satu.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label" htmlFor="materi-kelas">
                Kelas
              </label>
              <select
                id="materi-kelas"
                className="form-select"
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              >
                <option value="">Pilih kelas…</option>
                {(kelas.data ?? []).map((satu) => (
                  <option key={satu.id} value={satu.id}>
                    {satu.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="materi-tema">
                Tema
              </label>
              <select
                id="materi-tema"
                className="form-select"
                value={form.tag_id}
                onChange={(e) => setForm({ ...form, tag_id: e.target.value })}
              >
                <option value="">Tanpa tema</option>
                {(tag.data ?? []).map((satu) => (
                  <option key={satu.id} value={satu.id}>
                    {satu.nama}
                  </option>
                ))}
              </select>
            </div>
            <Tombol
              memuat={simpanMateri.isPending}
              disabled={!form.judul || !form.subject_id || !form.class_id}
              onClick={() =>
                simpanMateri.mutate({
                  judul: form.judul,
                  deskripsi: form.deskripsi || undefined,
                  subject_id: Number(form.subject_id),
                  class_id: Number(form.class_id),
                  tag_id: form.tag_id ? Number(form.tag_id) : null,
                })
              }
            >
              Buat & buka editor
            </Tombol>
          </section>
        </div>

        <div className="col-12 col-lg-7">
          <section className="kartu-soal p-3">
            <h2 className="h6 fw-bold mb-3">Daftar materi</h2>
            {daftar.isLoading && <p className="teks-lembut mb-0">Memuat…</p>}
            {daftar.data?.length === 0 && <p className="teks-lembut mb-0">Belum ada materi.</p>}
            <ul className="list-unstyled mb-0">
              {(daftar.data ?? []).map((satu) => (
                <li key={satu.id} className="py-2 border-bottom">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <div className="flex-grow-1">
                      <span className="fw-semibold">{satu.judul}</span>
                      <span className="d-block small teks-lembut">
                        {satu.kelas_nama ?? '-'} · {satu.jumlah_blok ?? 0} blok · {satu.status_label}
                      </span>
                    </div>
                    <Link className="btn btn-sm btn-tepi" to={ruteMateriEditor(satu.id)}>
                      Buka editor
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
