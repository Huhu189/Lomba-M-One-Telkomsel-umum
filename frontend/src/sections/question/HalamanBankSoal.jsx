/**
 * Halaman bank soal (slice 03) — guru/admin menyaring, menambah, mengubah,
 * dan menghapus soal objektif. Kunci jawaban hanya terlihat di sini.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilMapel } from '../school/api.js'
import { ambilSoal, ambilTag, buatSoal, hapusSoal, ubahSoal } from './api.js'
import { DAFTAR_TIPE, teksAman } from './tipeSoal.js'
import EditorSoal from './EditorSoal.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'

/** @param {string} teks */
function ringkas(teks) {
  const bersih = teks.trim()
  return bersih.length > 90 ? `${bersih.slice(0, 90)}…` : bersih || '(tanpa teks)'
}

const filterAwal = { subject_id: '', tag_id: '', tipe: '' }

export default function HalamanBankSoal() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState(filterAwal)
  const [halaman, setHalaman] = useState(1)
  const [modeEditor, setModeEditor] = useState(false)
  const [soalDiubah, setSoalDiubah] = useState(/** @type {import('./api.js').DataSoal|null} */ (null))

  const mapel = useQuery({ queryKey: ['mapel'], queryFn: ambilMapel })
  const tag = useQuery({ queryKey: ['tag'], queryFn: ambilTag })
  const bankSoal = useQuery({
    queryKey: ['soal', filter, halaman],
    queryFn: () =>
      ambilSoal({
        subjectId: filter.subject_id === '' ? null : Number(filter.subject_id),
        tagId: filter.tag_id === '' ? null : Number(filter.tag_id),
        tipe: filter.tipe === '' ? null : filter.tipe,
        halaman,
      }),
  })

  const simpan = useMutation({
    mutationFn: async (/** @type {import('./tipeSoal.js').MuatanSoal} */ muatan) =>
      soalDiubah === null ? buatSoal(muatan) : ubahSoal(soalDiubah.id, muatan),
    onSuccess: async () => {
      tampilkanToast('sukses', soalDiubah === null ? 'Soal ditambahkan.' : 'Soal diperbarui.')
      setModeEditor(false)
      setSoalDiubah(null)
      await queryClient.invalidateQueries({ queryKey: ['soal'] })
      await queryClient.invalidateQueries({ queryKey: ['tag'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const hapus = useMutation({
    mutationFn: async (/** @type {number} */ id) => hapusSoal(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Soal dihapus.')
      await queryClient.invalidateQueries({ queryKey: ['soal'] })
      await queryClient.invalidateQueries({ queryKey: ['tag'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const daftar = bankSoal.data?.data ?? []
  const meta = bankSoal.data?.meta

  /** @param {import('./api.js').DataSoal} soal */
  function mulaiUbah(soal) {
    setSoalDiubah(soal)
    setModeEditor(true)
  }

  function mulaiTambah() {
    setSoalDiubah(null)
    setModeEditor(true)
  }

  function tutupEditor() {
    setModeEditor(false)
    setSoalDiubah(null)
  }

  return (
    <div className="row g-4">
      <div className="col-12">
        {modeEditor ? (
          <EditorSoal
            key={soalDiubah === null ? 'baru' : String(soalDiubah.id)}
            soal={soalDiubah}
            daftarMapel={mapel.data ?? []}
            daftarTag={tag.data ?? []}
            sedangMenyimpan={simpan.isPending}
            onSimpan={(muatan) => simpan.mutate(muatan)}
            onBatal={tutupEditor}
          />
        ) : (
          <div className="kartu-soft p-4">
            <div className="d-flex flex-wrap align-items-baseline gap-2 mb-3">
              <h1 className="h5 fw-bold mb-0">Bank Soal</h1>
              <span className="teks-lembut small">
                Hanya soal objektif (pilihan ganda, benar/salah, menjodohkan, mengurutkan) yang siap dipakai kuis.
              </span>
              <button type="button" className="btn btn-aksen btn-sm ms-auto" onClick={mulaiTambah}>
                Tambah soal
              </button>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-sm-4">
                <label className="form-label small fw-semibold" htmlFor="saring-mapel">Mapel</label>
                <select
                  id="saring-mapel"
                  className="form-select form-select-sm"
                  value={filter.subject_id}
                  onChange={(e) => {
                    setFilter({ ...filter, subject_id: e.target.value })
                    setHalaman(1)
                  }}
                >
                  <option value="">Semua mapel</option>
                  {(mapel.data ?? []).map((satu) => (
                    <option key={satu.id} value={String(satu.id)}>{satu.nama}</option>
                  ))}
                </select>
              </div>

              <div className="col-sm-4">
                <label className="form-label small fw-semibold" htmlFor="saring-tag">Tag / tema</label>
                <select
                  id="saring-tag"
                  className="form-select form-select-sm"
                  value={filter.tag_id}
                  onChange={(e) => {
                    setFilter({ ...filter, tag_id: e.target.value })
                    setHalaman(1)
                  }}
                >
                  <option value="">Semua tag</option>
                  {(tag.data ?? []).map((satu) => (
                    <option key={satu.id} value={String(satu.id)}>{satu.nama}</option>
                  ))}
                </select>
              </div>

              <div className="col-sm-4">
                <label className="form-label small fw-semibold" htmlFor="saring-tipe">Tipe</label>
                <select
                  id="saring-tipe"
                  className="form-select form-select-sm"
                  value={filter.tipe}
                  onChange={(e) => {
                    setFilter({ ...filter, tipe: e.target.value })
                    setHalaman(1)
                  }}
                >
                  <option value="">Semua tipe</option>
                  {DAFTAR_TIPE.filter((tipe) => tipe.objektif).map((tipe) => (
                    <option key={tipe.nilai} value={tipe.nilai}>{tipe.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {bankSoal.isLoading && <p className="text-body-secondary">Memuat soal…</p>}
            {bankSoal.isError && <p className="status-salah">Gagal memuat bank soal.</p>}

            {meta && (
              <p className="teks-lembut small mb-2">
                Menampilkan {daftar.length} dari {meta.total} soal.
              </p>
            )}

            {!bankSoal.isLoading && daftar.length === 0 && (
              <p className="text-body-secondary">
                Belum ada soal yang cocok. Tekan <strong>Tambah soal</strong> untuk mulai mengisi bank soal.
              </p>
            )}

            {daftar.length > 0 && (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Soal</th>
                      <th scope="col">Tipe</th>
                      <th scope="col">Mapel</th>
                      <th scope="col">Tag</th>
                      <th scope="col">Skor</th>
                      <th scope="col" className="text-end">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daftar.map((soal) => (
                      <tr key={soal.id}>
                        <td>
                          <span className="fw-semibold d-block">{ringkas(teksAman(soal.konten.teks))}</span>
                          <span className="teks-lembut small">
                            Kunci: {ringkasKunci(soal)}
                            {soal.aktif ? '' : ' · nonaktif'}
                          </span>
                        </td>
                        <td>{soal.tipe_label}</td>
                        <td>{soal.mapel_nama ?? '—'}</td>
                        <td>{soal.tag_nama ?? '—'}</td>
                        <td>{soal.skor}</td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => mulaiUbah(soal)}
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            disabled={hapus.isPending}
                            onClick={() => {
                              if (window.confirm('Hapus soal ini dari bank soal?')) hapus.mutate(soal.id)
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

            {meta && meta.last_page > 1 && (
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={halaman <= 1}
                  onClick={() => setHalaman(halaman - 1)}
                >
                  Sebelumnya
                </button>
                <span className="teks-lembut small">Halaman {meta.current_page} dari {meta.last_page}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={halaman >= meta.last_page}
                  onClick={() => setHalaman(halaman + 1)}
                >
                  Berikutnya
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Ringkasan kunci jawaban supaya guru cepat mengenali soal.
 * @param {import('./api.js').DataSoal} soal
 * @returns {string}
 */
function ringkasKunci(soal) {
  const kunci = soal.kunci

  if (soal.tipe === 'benar_salah') return kunci.benar === true ? 'Benar' : 'Salah'

  if (soal.tipe === 'menjodohkan') {
    const pasangan = kunci.pasangan
    if (pasangan === null || typeof pasangan !== 'object') return '—'
    return Object.entries(/** @type {Record<string, unknown>} */ (pasangan))
      .map(([dari, ke]) => `${dari}→${String(ke)}`)
      .join(', ')
  }

  if (soal.tipe === 'mengurutkan') {
    const urutan = kunci.urutan
    return Array.isArray(urutan) ? urutan.map(String).join(' → ') : '—'
  }

  return teksAman(kunci.jawaban) || '—'
}
