/**
 * Layar materi guru (slice 08).
 *
 * Guru menyusun materi sebagai urutan blok, mengunggah berkas (berpotongan,
 * dengan progres), menandai blok wajib/opsional, lalu menerbitkannya. Server
 * yang memeriksa kelengkapan: blok kuis harus menunjuk kuis kelas yang sama
 * berisi soal objektif/isian.
 *
 * Editor blok hidup di komponen terpisah yang berkunci id materi, jadi memilih
 * materi lain selalu memulai editor yang bersih tanpa efek penyelaras.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { ambilKelas, ambilMapel } from '../school/api.js'
import { ambilTag } from '../question/api.js'
import { ambilKuis } from '../quiz/api.js'
import {
  ambilMateri,
  ambilMateriDetail,
  buatMateri,
  laporanMateri,
  publikasiMateri,
  sinkronBlok,
  unggahBerkas,
} from './api.js'

/** @type {Array<{ nilai: 'teks'|'media'|'kuis', label: string }>} */
const TIPE_BLOK = [
  { nilai: 'teks', label: 'Teks' },
  { nilai: 'media', label: 'Media' },
  { nilai: 'kuis', label: 'Kuis sisipan' },
]

/**
 * @typedef {{
 *   tipe: 'teks'|'media'|'kuis',
 *   wajib: boolean,
 *   teks: string,
 *   keterangan: string,
 *   unggahan_kode: string,
 *   quiz_id: number|string,
 * }} BarisBlok
 * @typedef {{ id: number, judul: string, jumlah_soal?: number }} BarisKuis
 */

/**
 * Baris editor blok baru.
 * @param {'teks'|'media'|'kuis'} tipe
 * @returns {BarisBlok}
 */
function blokBaru(tipe) {
  return { tipe, wajib: true, teks: '', keterangan: '', unggahan_kode: '', quiz_id: '' }
}

/**
 * Baris editor dari data server (blok yang sudah tersimpan).
 * @param {Array<Record<string, unknown>>|undefined} blok
 * @returns {BarisBlok[]}
 */
function dariServer(blok) {
  return (blok ?? []).map((satu) => ({
    tipe: /** @type {'teks'|'media'|'kuis'} */ (String(satu.tipe ?? 'teks')),
    wajib: Boolean(satu.wajib),
    teks: typeof satu.teks === 'string' ? satu.teks : '',
    keterangan: typeof satu.keterangan === 'string' ? satu.keterangan : '',
    unggahan_kode: typeof satu.unggahan_kode === 'string' ? satu.unggahan_kode : '',
    quiz_id: typeof satu.quiz_id === 'number' ? satu.quiz_id : '',
  }))
}

/**
 * Ubah baris editor menjadi muatan yang diterima server.
 * @param {BarisBlok[]} blok
 */
function muatanBlok(blok) {
  return blok.map((satu) => ({
    tipe: satu.tipe,
    wajib: satu.wajib,
    isi:
      satu.tipe === 'teks'
        ? { teks: satu.teks }
        : satu.tipe === 'media'
          ? { unggahan_kode: satu.unggahan_kode, keterangan: satu.keterangan }
          : undefined,
    quiz_id: satu.tipe === 'kuis' ? Number(satu.quiz_id) || null : null,
  }))
}

/**
 * Editor blok satu materi.
 * @param {{ materi: import('./api.js').DataMateri, daftarKuis: BarisKuis[] }} props
 */
function PanelMateri({ materi, daftarKuis }) {
  const queryClient = useQueryClient()
  const [blok, setBlok] = useState(() => dariServer(materi.blok))
  const [progresUnggah, setProgresUnggah] = useState(0)
  const [galat, setGalat] = useState('')

  const laporan = useQuery({
    queryKey: ['materi-laporan', materi.id],
    queryFn: () => laporanMateri(materi.id),
    enabled: materi.status === 'publikasi',
  })

  const simpanBlok = useMutation({
    mutationFn: async () => sinkronBlok(materi.id, muatanBlok(blok)),
    onSuccess: () => {
      setGalat('')
      tampilkanToast('sukses', 'Urutan blok tersimpan.')
      void queryClient.invalidateQueries({ queryKey: ['materi'] })
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  const terbitkan = useMutation({
    mutationFn: async () => publikasiMateri(materi.id),
    onSuccess: () => {
      setGalat('')
      tampilkanToast('sukses', 'Materi terbit untuk murid kelas ini.')
      void queryClient.invalidateQueries({ queryKey: ['materi'] })
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  const unggah = useMutation({
    mutationFn: async (/** @type {{ indeks: number, berkas: File }} */ variabel) =>
      unggahBerkas(materi.id, variabel.berkas, { onProgres: setProgresUnggah }),
    onSuccess: (berkasJadi, variabel) => {
      setProgresUnggah(0)
      setBlok((sebelum) =>
        sebelum.map((satu, urutan) =>
          urutan === variabel.indeks ? { ...satu, unggahan_kode: berkasJadi.kode } : satu,
        ),
      )
      void queryClient.invalidateQueries({ queryKey: ['materi'] })
      tampilkanToast(
        'sukses',
        berkasJadi.tampil_langsung
          ? 'Berkas siap ditampilkan.'
          : 'Berkas berisiko: murid akan mengunduhnya (.upload).',
      )
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  /** @param {number} indeks @param {Partial<BarisBlok>} ubah */
  function ubahBaris(indeks, ubah) {
    setBlok((sebelum) =>
      sebelum.map((satu, urutan) => (urutan === indeks ? { ...satu, ...ubah } : satu)),
    )
  }

  /** @param {number} indeks @param {number} arah */
  function geser(indeks, arah) {
    setBlok((sebelum) => {
      const tujuan = indeks + arah
      if (tujuan < 0 || tujuan >= sebelum.length) return sebelum

      const salinan = [...sebelum]
      const simpanan = salinan[indeks]
      salinan[indeks] = salinan[tujuan]
      salinan[tujuan] = simpanan

      return salinan
    })
  }

  const berkasSiap = (materi.unggahan ?? []).filter((satu) => satu.status === 'selesai')

  return (
    <section className="kartu-soal p-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h2 className="h6 fw-bold mb-0">{materi.judul}</h2>
        <span className="badge-status lembut ms-auto">{materi.status_label ?? materi.status}</span>
      </div>

      {galat && <Banner jenis="salah">{galat}</Banner>}

      <div className="d-flex flex-wrap gap-2 mb-3">
        {TIPE_BLOK.map((satu) => (
          <Tombol
            key={satu.nilai}
            varian="tepi"
            onClick={() => setBlok((sebelum) => [...sebelum, blokBaru(satu.nilai)])}
          >
            + {satu.label}
          </Tombol>
        ))}
      </div>

      {blok.map((satu, indeks) => (
        <div className="border rounded-3 p-3 mb-3" key={`blok-${indeks}-${satu.tipe}`}>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <strong className="small">Blok {indeks + 1}</strong>
            <span className="badge-status lembut">{satu.tipe}</span>
            <label className="small d-flex align-items-center gap-1 ms-auto">
              <input
                type="checkbox"
                checked={satu.wajib}
                onChange={(e) => ubahBaris(indeks, { wajib: e.target.checked })}
              />
              wajib
            </label>
            <button
              type="button"
              className="btn btn-teks btn-sm"
              onClick={() => geser(indeks, -1)}
              aria-label={`Naikkan blok ${indeks + 1}`}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-teks btn-sm"
              onClick={() => geser(indeks, 1)}
              aria-label={`Turunkan blok ${indeks + 1}`}
            >
              ↓
            </button>
            <button
              type="button"
              className="btn btn-teks btn-sm"
              onClick={() => setBlok((sebelum) => sebelum.filter((_, urutan) => urutan !== indeks))}
              aria-label={`Hapus blok ${indeks + 1}`}
            >
              Hapus
            </button>
          </div>

          {satu.tipe === 'teks' && (
            <textarea
              className="form-control"
              rows={3}
              value={satu.teks}
              onChange={(e) => ubahBaris(indeks, { teks: e.target.value })}
              placeholder="Tulis penjelasan singkat untuk murid…"
            />
          )}

          {satu.tipe === 'media' && (
            <>
              <input
                className="form-control mb-2"
                type="file"
                aria-label={`Unggah berkas blok ${indeks + 1}`}
                onChange={(e) => {
                  const berkas = e.target.files?.[0]
                  if (berkas) unggah.mutate({ indeks, berkas })
                }}
              />
              {unggah.isPending && (
                <p className="small teks-lembut">Mengunggah… {progresUnggah}%</p>
              )}
              {satu.unggahan_kode !== '' && (
                <p className="small mb-2">Berkas tersimpan: {satu.unggahan_kode}</p>
              )}
              <input
                className="form-control"
                value={satu.keterangan}
                onChange={(e) => ubahBaris(indeks, { keterangan: e.target.value })}
                placeholder="Keterangan berkas (opsional)"
              />
            </>
          )}

          {satu.tipe === 'kuis' && (
            <select
              className="form-select"
              aria-label={`Pilih kuis untuk blok ${indeks + 1}`}
              value={satu.quiz_id}
              onChange={(e) => ubahBaris(indeks, { quiz_id: e.target.value })}
            >
              <option value="">Pilih kuis dari bank soal…</option>
              {daftarKuis.map((satuKuis) => (
                <option key={satuKuis.id} value={satuKuis.id}>
                  {satuKuis.judul} ({satuKuis.jumlah_soal ?? 0} soal)
                </option>
              ))}
            </select>
          )}
        </div>
      ))}

      {blok.length === 0 && (
        <p className="teks-lembut">Belum ada blok. Tambahkan blok teks untuk mulai.</p>
      )}

      <div className="d-flex flex-wrap gap-2">
        <Tombol memuat={simpanBlok.isPending} onClick={() => simpanBlok.mutate()}>
          Simpan urutan blok
        </Tombol>
        <Tombol
          varian="tepi"
          memuat={terbitkan.isPending}
          disabled={blok.length === 0}
          onClick={() => terbitkan.mutate()}
        >
          Terbitkan materi
        </Tombol>
      </div>

      {berkasSiap.length > 0 && (
        <div className="mt-3">
          <h3 className="h6 fw-bold">Berkas materi</h3>
          <ul className="list-unstyled mb-0">
            {berkasSiap.map((satu) => (
              <li key={satu.kode} className="small py-1">
                {satu.nama_asli} · {satu.ukuran_manusia} · {satu.kategori_label}
                {satu.tampil_langsung ? ' · tampil di halaman' : ' · diunduh (.upload)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {laporan.data && (
        <div className="mt-4">
          <h3 className="h6 fw-bold">Hasil murid</h3>
          <p className="small teks-lembut">
            Skor latihan masuk laporan tema materi ini dan tidak menghitung ranking.
          </p>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th scope="col">Murid</th>
                  <th scope="col">Blok selesai</th>
                  <th scope="col">Skor latihan</th>
                  <th scope="col">Tema terlemah</th>
                </tr>
              </thead>
              <tbody>
                {laporan.data.murid.map((satu) => (
                  <tr key={satu.murid_id}>
                    <td>{satu.nama ?? 'Tanpa nama'}</td>
                    <td>
                      {satu.blok_selesai}/{satu.jumlah_blok}
                    </td>
                    <td>
                      {satu.skor_latihan}/{satu.skor_latihan_maksimal}
                    </td>
                    <td>
                      {satu.tema.length === 0
                        ? '—'
                        : `${satu.tema[0].tag_nama} (${satu.tema[0].persen}%)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export default function HalamanMateri() {
  const queryClient = useQueryClient()
  const [terpilihId, setTerpilihId] = useState(/** @type {number|null} */ (null))
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
  const kuis = useQuery({ queryKey: ['kuis'], queryFn: ambilKuis })

  const detail = useQuery({
    queryKey: ['materi', terpilihId],
    queryFn: () => ambilMateriDetail(/** @type {number} */ (terpilihId)),
    enabled: terpilihId !== null,
  })

  const simpanMateri = useMutation({
    mutationFn: async (/** @type {import('./api.js').MuatanMateri} */ data) => buatMateri(data),
    onSuccess: (materi) => {
      setGalat('')
      setForm({ judul: '', deskripsi: '', subject_id: '', class_id: '', tag_id: '' })
      setTerpilihId(materi.id)
      tampilkanToast('sukses', 'Materi dibuat. Lanjutkan menyusun bloknya.')
      void queryClient.invalidateQueries({ queryKey: ['materi'] })
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  return (
    <div className="container py-4">
      <h1 className="h4 fw-bold mb-1">Materi Pelajaran</h1>
      <p className="teks-lembut">Susun bahan belajar berurutan dan sisipkan latihan di tengahnya.</p>

      {galat && <Banner jenis="salah">{galat}</Banner>}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <section className="kartu-soal p-3 mb-4">
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
              Buat materi
            </Tombol>
          </section>

          <section className="kartu-soal p-3">
            <h2 className="h6 fw-bold mb-3">Daftar materi</h2>
            {daftar.isLoading && <p className="teks-lembut mb-0">Memuat…</p>}
            {daftar.data?.length === 0 && <p className="teks-lembut mb-0">Belum ada materi.</p>}
            <ul className="list-unstyled mb-0">
              {(daftar.data ?? []).map((satu) => (
                <li key={satu.id} className="py-2 border-bottom">
                  <button
                    type="button"
                    className="btn btn-teks text-start w-100"
                    onClick={() => setTerpilihId(satu.id)}
                  >
                    <span className="fw-semibold">{satu.judul}</span>
                    <span className="d-block small teks-lembut">
                      {satu.kelas_nama ?? '-'} · {satu.jumlah_blok ?? 0} blok · {satu.status_label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="col-12 col-lg-7">
          {terpilihId === null && (
            <Banner jenis="info">Pilih materi di kiri untuk menyusun bloknya.</Banner>
          )}

          {detail.data && (
            <PanelMateri
              key={detail.data.id}
              materi={detail.data}
              daftarKuis={kuis.data ?? []}
            />
          )}
        </div>
      </div>
    </div>
  )
}
