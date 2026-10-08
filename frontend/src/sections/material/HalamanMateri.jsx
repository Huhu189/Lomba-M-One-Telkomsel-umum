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
 * Ikon singkat & label klip per tipe blok di timeline.
 * @param {'teks'|'media'|'kuis'} tipe
 * @returns {{ ikon: string, label: string }}
 */
function ciriKlip(tipe) {
  if (tipe === 'media') return { ikon: '▶', label: 'Media' }
  if (tipe === 'kuis') return { ikon: '?', label: 'Kuis' }
  return { ikon: '¶', label: 'Teks' }
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
 * Pratinjau satu blok seperti yang dilihat murid — tanpa aksi nyata, hanya
 * tampilan. Sengaja dirender dari state editor, bukan dari server, agar guru
 * melihat hasil susunannya seketika.
 * @param {{
 *   satu: BarisBlok,
 *   cariUnggahan: (kode: string) => import('./api.js').DataUnggahan | undefined,
 *   daftarKuis: BarisKuis[],
 * }} props
 */
function PratinjauBlok({ satu, cariUnggahan, daftarKuis }) {
  if (satu.tipe === 'teks') {
    return satu.teks === '' ? (
      <p className="teks-lembut mb-0">(Teks blok ini belum ditulis.)</p>
    ) : (
      <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
        {satu.teks}
      </p>
    )
  }

  if (satu.tipe === 'media') {
    const berkas = satu.unggahan_kode === '' ? undefined : cariUnggahan(satu.unggahan_kode)

    if (!berkas) {
      return <p className="teks-lembut mb-0">(Belum ada berkas terunggah untuk blok ini.)</p>
    }

    return (
      <div>
        {berkas.tampil_langsung && berkas.mime?.startsWith('image/') && (
          <img
            src={berkas.url ?? undefined}
            alt={satu.keterangan || berkas.nama_asli}
            className="img-fluid rounded-3"
          />
        )}
        {berkas.tampil_langsung && berkas.mime?.startsWith('video/') && (
          <video src={berkas.url ?? undefined} controls className="w-100 rounded-3" />
        )}
        {berkas.tampil_langsung && berkas.mime?.startsWith('audio/') && (
          <audio src={berkas.url ?? undefined} controls className="w-100" />
        )}
        {berkas.tampil_langsung && berkas.mime === 'application/pdf' && (
          <a href={berkas.url ?? undefined} target="_blank" rel="noreferrer">
            Buka dokumen PDF
          </a>
        )}
        {!berkas.tampil_langsung && (
          <a href={berkas.url ?? undefined} className="btn btn-tepi" download>
            Unduh berkas ({berkas.kategori_label})
          </a>
        )}
        {satu.keterangan !== '' && (
          <p className="small teks-lembut mt-2 mb-0">{satu.keterangan}</p>
        )}
      </div>
    )
  }

  const kuis = daftarKuis.find((satuKuis) => String(satuKuis.id) === String(satu.quiz_id))

  return (
    <div className="border rounded-3 p-3">
      <p className="small teks-lembut mb-1">Kuis sisipan · latihan tidak masuk ranking</p>
      <p className="fw-semibold mb-0">
        {kuis ? `${kuis.judul} (${kuis.jumlah_soal ?? 0} soal)` : 'Kuis belum dipilih.'}
      </p>
    </div>
  )
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
  const [terpilih, setTerpilih] = useState(0)
  const [indeksSeret, setIndeksSeret] = useState(/** @type {number|null} */ (null))

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

  /** Blok yang sedang dipilih di timeline (dijepit agar selalu sah). */
  const aktif = Math.min(terpilih, Math.max(blok.length - 1, 0))
  const blokAktif = blok[aktif]

  /** Cari berkas selesai lewat kodenya, untuk pratinjau media. */
  const cariUnggahan = (/** @type {string} */ kode) =>
    berkasSiap.find((satu) => satu.kode === kode)

  /**
 * Pindahkan klip dari satu posisi ke posisi lain (hasil drag).
 * @param {number} dari
 * @param {number} ke
 */
  function pindah(dari, ke) {
    if (dari === ke || dari < 0 || ke < 0 || dari >= blok.length || ke >= blok.length) return

    setBlok((sebelum) => {
      const salinan = [...sebelum]
      const [diangkat] = salinan.splice(dari, 1)
      salinan.splice(ke, 0, diangkat)
      return salinan
    })
    setTerpilih(ke)
  }

  // Pratinjau dihitung dari state lokal, jadi penanda "belum tersimpan" perlu
  // membandingkan muatan editor dengan muatan yang terakhir datang dari server.
  const belumTersimpan =
    JSON.stringify(muatanBlok(blok)) !== JSON.stringify(muatanBlok(dariServer(materi.blok)))

  return (
    <section className="kartu-soal p-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h2 className="h6 fw-bold mb-0">{materi.judul}</h2>
        {belumTersimpan && <span className="badge-status peringatan">Belum tersimpan</span>}
        <span className="badge-status lembut ms-auto">{materi.status_label ?? materi.status}</span>
      </div>

      {galat && <Banner jenis="salah">{galat}</Banner>}

      <div className="d-flex flex-wrap gap-2 mb-3">
        {TIPE_BLOK.map((satu) => (
          <Tombol
            key={satu.nilai}
            varian="tepi"
            onClick={() => {
              setBlok((sebelum) => [...sebelum, blokBaru(satu.nilai)])
              setTerpilih(blok.length)
            }}
          >
            + {satu.label}
          </Tombol>
        ))}
      </div>

      <div className="editor-materi mb-3">
        <div>
          <div className="timeline-klip mb-2" aria-label="Timeline blok materi">
            {blok.map((satu, indeks) => {
              const ciri = ciriKlip(satu.tipe)
              const klipAktif = indeks === aktif

              return (
                <button
                  type="button"
                  key={`klip-${indeks}-${satu.tipe}`}
                  className={`klip${klipAktif ? ' klip-aktif' : ''}${indeksSeret === indeks ? ' klip-diseret' : ''}`}
                  aria-pressed={klipAktif}
                  aria-label={`Blok ${indeks + 1}: ${ciri.label}${satu.wajib ? '' : ', opsional'}`}
                  draggable
                  onDragStart={() => setIndeksSeret(indeks)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (indeksSeret !== null) pindah(indeksSeret, indeks)
                    setIndeksSeret(null)
                  }}
                  onDragEnd={() => setIndeksSeret(null)}
                  onClick={() => setTerpilih(indeks)}
                >
                  <span className="small fw-bold" aria-hidden="true">
                    {ciri.ikon} Blok {indeks + 1}
                  </span>
                  <span className="d-block small teks-lembut">
                    {ciri.label}
                    {satu.wajib ? '' : ' · opsional'}
                  </span>
                </button>
              )
            })}
            {blok.length === 0 && (
              <span className="small teks-lembut align-self-center px-2">Timeline masih kosong.</span>
            )}
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <button
              type="button"
              className="btn btn-teks btn-sm"
              disabled={aktif === 0}
              onClick={() => setTerpilih(aktif - 1)}
              aria-label="Blok sebelumnya"
            >
              ← Mundur
            </button>
            <span className="small teks-lembut" aria-live="polite">
              Blok {blok.length === 0 ? 0 : aktif + 1} dari {blok.length}
            </span>
            <button
              type="button"
              className="btn btn-teks btn-sm"
              disabled={aktif >= blok.length - 1}
              onClick={() => setTerpilih(aktif + 1)}
              aria-label="Blok berikutnya"
            >
              Lanjut →
            </button>
            <span className="small teks-lembut ms-auto">Tarik klip untuk mengurutkan.</span>
          </div>

          {blokAktif && (
            <div className="border rounded-3 p-3">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <strong className="small">Blok {aktif + 1}</strong>
                <span className="badge-status lembut">{blokAktif.tipe}</span>
                <label className="small d-flex align-items-center gap-1 ms-auto">
                  <input
                    type="checkbox"
                    checked={blokAktif.wajib}
                    onChange={(e) => ubahBaris(aktif, { wajib: e.target.checked })}
                  />
                  wajib
                </label>
                <button
                  type="button"
                  className="btn btn-teks btn-sm"
                  onClick={() => geser(aktif, -1)}
                  aria-label={`Naikkan blok ${aktif + 1}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-teks btn-sm"
                  onClick={() => geser(aktif, 1)}
                  aria-label={`Turunkan blok ${aktif + 1}`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-teks btn-sm"
                  onClick={() =>
                    setBlok((sebelum) => sebelum.filter((_, urutan) => urutan !== aktif))
                  }
                  aria-label={`Hapus blok ${aktif + 1}`}
                >
                  Hapus
                </button>
              </div>

              {blokAktif.tipe === 'teks' && (
                <textarea
                  className="form-control"
                  rows={3}
                  value={blokAktif.teks}
                  onChange={(e) => ubahBaris(aktif, { teks: e.target.value })}
                  placeholder="Tulis penjelasan singkat untuk murid…"
                />
              )}

              {blokAktif.tipe === 'media' && (
                <>
                  <input
                    className="form-control mb-2"
                    type="file"
                    aria-label={`Unggah berkas blok ${aktif + 1}`}
                    onChange={(e) => {
                      const berkas = e.target.files?.[0]
                      if (berkas) unggah.mutate({ indeks: aktif, berkas })
                    }}
                  />
                  {unggah.isPending && (
                    <p className="small teks-lembut">Mengunggah… {progresUnggah}%</p>
                  )}
                  {blokAktif.unggahan_kode !== '' && (
                    <p className="small mb-2">Berkas tersimpan: {blokAktif.unggahan_kode}</p>
                  )}
                  <input
                    className="form-control"
                    value={blokAktif.keterangan}
                    onChange={(e) => ubahBaris(aktif, { keterangan: e.target.value })}
                    placeholder="Keterangan berkas (opsional)"
                  />
                </>
              )}

              {blokAktif.tipe === 'kuis' && (
                <select
                  className="form-select"
                  aria-label={`Pilih kuis untuk blok ${aktif + 1}`}
                  value={blokAktif.quiz_id}
                  onChange={(e) => ubahBaris(aktif, { quiz_id: e.target.value })}
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
          )}

          {blok.length === 0 && (
            <p className="teks-lembut mb-0">Belum ada blok. Tambahkan blok teks untuk mulai.</p>
          )}
        </div>

        <aside className="monitor-materi p-3" aria-label="Pratinjau tampilan murid">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <h3 className="h6 fw-bold mb-0">Pratinjau murid</h3>
            <span className="badge-status lembut">langsung</span>
          </div>
          {blokAktif ? (
            <PratinjauBlok satu={blokAktif} cariUnggahan={cariUnggahan} daftarKuis={daftarKuis} />
          ) : (
            <p className="teks-lembut mb-0">Pratinjau blok muncul di sini.</p>
          )}
        </aside>
      </div>

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
