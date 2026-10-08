/**
 * Editor materi gaya video editor (guru).
 *
 * Alur yang diminta: guru membuat materi dari halaman daftar, lalu langsung
 * dibawa ke sini. Di desktop layar ini berbentuk editor: toolbar impor media +
 * sisip kuis, timeline klip, pustaka media, inspector blok, dan monitor
 * pratinjau. Di layar sempit tersedia dua tab (Editor / Hasil) dan area editor
 * sengaja dibuat lebih besar daripada pratinjau supaya mengetik tetap nyaman.
 *
 * Template SENGAJA dikosongkan dulu (lihat `TEMPLATE_MATERI`): panel template
 * hanya menampilkan keadaan kosong sampai template benar-benar disiapkan.
 */
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { RUTE } from '../../routes.js'
import { ambilKuis } from '../quiz/api.js'
import {
  ambilMateriDetail,
  laporanMateri,
  publikasiMateri,
  sinkronBlok,
  unggahBerkas,
} from './api.js'
import {
  TEMPLATE_MATERI,
  adaTemplate,
  blokBaru,
  ciriKlip,
  dariServer,
  muatanBlok,
  pindahBlok,
  sisipBlok,
} from './editorMateri.js'

/**
 * Pratinjau satu blok seperti yang dilihat murid — tanpa aksi nyata.
 * @param {{
 *   satu: import('./editorMateri.js').BarisBlok,
 *   cariUnggahan: (kode: string) => import('./api.js').DataUnggahan | undefined,
 *   daftarKuis: import('../quiz/api.js').DataKuis[],
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

export default function EditorMateri() {
  const { id } = useParams()
  const materiId = Number(id)
  const queryClient = useQueryClient()

  const detail = useQuery({
    queryKey: ['materi', materiId],
    queryFn: () => ambilMateriDetail(materiId),
    enabled: Number.isInteger(materiId) && materiId > 0,
  })
  const kuis = useQuery({ queryKey: ['kuis'], queryFn: ambilKuis })

  const materi = detail.data

  return (
    <div className="container py-4">
      {detail.isLoading && <p className="teks-lembut">Memuat editor materi…</p>}

      {detail.isError && (
        <Banner jenis="salah" judul="Materi belum bisa dibuka">
          <p className="mb-0">Pastikan kamu guru pemilik materi ini.</p>
        </Banner>
      )}

      {materi && (
        <PanelEditor
          key={materi.id}
          materi={materi}
          daftarKuis={kuis.data ?? []}
          onTersimpan={() => void queryClient.invalidateQueries({ queryKey: ['materi'] })}
        />
      )}

      <p className="mt-3 mb-0">
        <Link className="btn btn-sm btn-tepi" to={RUTE.materi}>
          ← Daftar materi
        </Link>
      </p>
    </div>
  )
}

/**
 * @param {{
 *   materi: import('./api.js').DataMateri,
 *   daftarKuis: import('../quiz/api.js').DataKuis[],
 *   onTersimpan: () => void,
 * }} props
 */
function PanelEditor({ materi, daftarKuis, onTersimpan }) {
  const [blok, setBlok] = useState(() => dariServer(materi.blok))
  const [progresUnggah, setProgresUnggah] = useState(0)
  const [galat, setGalat] = useState('')
  const [terpilih, setTerpilih] = useState(0)
  const [indeksSeret, setIndeksSeret] = useState(/** @type {number|null} */ (null))
  const [tabPonsel, setTabPonsel] = useState(/** @type {'editor'|'hasil'} */ ('editor'))
  const inputBerkas = useRef(/** @type {HTMLInputElement|null} */ (null))

  const laporan = useQuery({
    queryKey: ['materi-laporan', materi.id],
    queryFn: () => laporanMateri(materi.id),
    enabled: materi.status === 'publikasi',
  })

  const simpanBlok = useMutation({
    mutationFn: async () => sinkronBlok(materi.id, muatanBlok(blok)),
    onSuccess: () => {
      setGalat('')
      tampilkanToast('sukses', 'Susunan materi tersimpan.')
      onTersimpan()
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  const terbitkan = useMutation({
    mutationFn: async () => publikasiMateri(materi.id),
    onSuccess: () => {
      setGalat('')
      tampilkanToast('sukses', 'Materi terbit untuk murid kelas ini.')
      onTersimpan()
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
      onTersimpan()
      tampilkanToast(
        'sukses',
        berkasJadi.tampil_langsung
          ? 'Berkas siap ditampilkan.'
          : 'Berkas berisiko: murid akan mengunduhnya (.upload).',
      )
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  /** @param {number} indeks @param {Partial<import('./editorMateri.js').BarisBlok>} ubah */
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

  /**
   * Sisipkan satu blok baru di akhir, pilih baris itu, dan kembalikan indeksnya.
   * @param {import('./editorMateri.js').TipeBlok} tipe
   * @param {Partial<import('./editorMateri.js').BarisBlok>} [isi]
   * @returns {number} indeks baris baru
   */
  function tambahBlok(tipe, isi) {
    const hasil = sisipBlok(blok, { ...blokBaru(tipe), ...isi })
    setBlok(hasil.blok)
    setTerpilih(hasil.indeks)
    setTabPonsel('editor')

    return hasil.indeks
  }

  /** Impor media: sisipkan satu blok media lalu unggah berkas ke blok itu. @param {File} berkas */
  function imporMedia(berkas) {
    const indeks = tambahBlok('media')
    unggah.mutate({ indeks, berkas })
  }

  const berkasSiap = (materi.unggahan ?? []).filter((satu) => satu.status === 'selesai')

  /** Blok yang sedang dipilih di timeline (dijepit agar selalu sah). */
  const aktif = Math.min(terpilih, Math.max(blok.length - 1, 0))
  const blokAktif = blok[aktif]

  /** Cari berkas selesai lewat kodenya, untuk pratinjau media. */
  const cariUnggahan = (/** @type {string} */ kode) =>
    berkasSiap.find((satu) => satu.kode === kode)

  const belumTersimpan =
    JSON.stringify(muatanBlok(blok)) !== JSON.stringify(muatanBlok(dariServer(materi.blok)))

  return (
    <section className="kartu-soal p-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="h5 fw-bold mb-0">{materi.judul}</h1>
        {belumTersimpan && <span className="badge-status peringatan">Belum tersimpan</span>}
        <span className="badge-status lembut ms-auto">{materi.status_label ?? materi.status}</span>
      </div>
      <p className="teks-lembut small mb-3">
        {materi.mapel_nama ?? '—'} · {materi.kelas_nama ?? '—'}
        {materi.tema_nama ? ` · ${materi.tema_nama}` : ''}
      </p>

      {galat && <Banner jenis="salah">{galat}</Banner>}

      {/* Toolbar gaya video editor: impor media & sisip blok. */}
      <div className="editor-materi-aksi mb-3" role="toolbar" aria-label="Aksi editor materi">
        <Tombol varian="tepi" onClick={() => inputBerkas.current?.click()}>
          ⬆ Impor media
        </Tombol>
        <input
          ref={inputBerkas}
          className="d-none"
          type="file"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const berkas = e.target.files?.[0]
            if (berkas) imporMedia(berkas)
            e.target.value = ''
          }}
        />
        <Tombol varian="tepi" onClick={() => tambahBlok('kuis')}>
          ? Sisipkan kuis
        </Tombol>
        <Tombol varian="tepi" onClick={() => tambahBlok('teks')}>
          ¶ Tambah teks
        </Tombol>
        <Tombol
          varian="tepi"
          disabled={!adaTemplate()}
          onClick={() => tampilkanToast('info', 'Template belum tersedia.')}
        >
          ▦ Template
        </Tombol>
      </div>

      {/* Di layar sempit guru berpindah antara tab Editor dan Hasil. */}
      <div className="d-lg-none mb-3" role="tablist" aria-label="Tab editor materi">
        <div className="btn-group w-100" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tabPonsel === 'editor'}
            className={`btn ${tabPonsel === 'editor' ? 'btn-primary' : 'btn-tepi'}`}
            onClick={() => setTabPonsel('editor')}
          >
            Editor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tabPonsel === 'hasil'}
            className={`btn ${tabPonsel === 'hasil' ? 'btn-primary' : 'btn-tepi'}`}
            onClick={() => setTabPonsel('hasil')}
          >
            Hasil
          </button>
        </div>
      </div>

      <div className="editor-materi mb-3">
        <div
          className={`editor-utama${tabPonsel === 'editor' ? '' : ' d-none d-lg-block'}`}
          role="tabpanel"
          aria-label="Editor blok"
        >
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
                    if (indeksSeret !== null) {
                      setBlok((sebelum) => pindahBlok(sebelum, indeksSeret, indeks))
                      setTerpilih(indeks)
                    }
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
              <span className="small teks-lembut align-self-center px-2">
                Timeline masih kosong. Impor media atau sisipkan kuis untuk mulai.
              </span>
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
            <div className="border rounded-3 p-3 mb-3">
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
                  onClick={() => setBlok((sebelum) => sebelum.filter((_, urutan) => urutan !== aktif))}
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
            <p className="teks-lembut mb-3">
              Belum ada blok. Pakai tombol impor media atau sisipkan kuis di atas.
            </p>
          )}

          {berkasSiap.length > 0 && (
            <div className="pustaka-media mb-3">
              <h2 className="h6 fw-bold mb-2">Pustaka media</h2>
              <p className="small teks-lembut mb-2">
                Pilih berkas untuk disisipkan lagi sebagai blok tanpa mengunggah ulang.
              </p>
              <ul className="list-unstyled mb-0">
                {berkasSiap.map((satu) => (
                  <li key={satu.kode} className="d-flex flex-wrap align-items-center gap-2 py-1">
                    <span className="small">
                      {satu.nama_asli} · {satu.ukuran_manusia} · {satu.kategori_label}
                      {satu.tampil_langsung ? '' : ' · diunduh (.upload)'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-teks btn-sm ms-auto"
                      onClick={() => tambahBlok('media', { unggahan_kode: satu.kode })}
                    >
                      + Sisipkan
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="template-materi mb-3">
            <h2 className="h6 fw-bold mb-2">Template</h2>
            {adaTemplate() ? (
              <ul className="list-unstyled mb-0">
                {TEMPLATE_MATERI.map((satu) => (
                  <li key={satu.id} className="py-1">
                    <span className="fw-semibold">{satu.nama}</span>
                    <span className="d-block small teks-lembut">{satu.deskripsi}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small teks-lembut mb-0">
                Template belum tersedia (dikosongkan dulu). Untuk sekarang susun materi dari nol.
              </p>
            )}
          </div>
        </div>

        <aside
          className={`monitor-materi p-3${tabPonsel === 'hasil' ? '' : ' d-none d-lg-block'}`}
          role="tabpanel"
          aria-label="Pratinjau tampilan murid"
        >
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <h2 className="h6 fw-bold mb-0">Pratinjau murid</h2>
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
          Simpan materi
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

      {laporan.data && (
        <div className="mt-4">
          <h2 className="h6 fw-bold">Hasil murid</h2>
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
