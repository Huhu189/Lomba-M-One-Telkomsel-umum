/**
 * Halaman bank soal (slice 03) — guru/admin menyaring, menambah, mengubah,
 * dan menghapus soal objektif. Kunci jawaban hanya terlihat di sini.
 *
 * Daftarnya dimuat **bertahap** (20 soal per permintaan + tombol "muat
 * berikutnya") dan pencariannya dikerjakan server. Sekolah dengan ratusan soal
 * tidak lagi mengirim seluruh bank dalam satu respons hanya untuk menampilkan
 * baris pertama.
 */
import { useEffect, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ambilMapel } from '../school/api.js'
import { ambilSoal, ambilTag, buatSoal, hapusSoal, ubahSoal } from './api.js'
import { DAFTAR_TIPE, teksAman } from './tipeSoal.js'
import EditorSoal from './EditorSoal.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import DialogKonfirmasi from '../../shared/ui/DialogKonfirmasi.jsx'
import HeaderHalaman from '../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../shared/ui/KosongData.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import TabelData from '../../shared/ui/TabelData.jsx'
import { Tombol, TombolIkon } from '../../shared/ui/Tombol.jsx'
import {
  IkonCari,
  IkonPanahKiri,
  IkonPapan,
  IkonPensil,
  IkonSilang,
  IkonTambah,
  IkonTongSampah,
} from '../../icons.jsx'

/** @param {string} teks */
function ringkas(teks) {
  const bersih = teks.trim()
  return bersih.length > 90 ? `${bersih.slice(0, 90)}…` : bersih || '(tanpa teks)'
}

/** Soal per permintaan — bank soal dimuat bertahap, bukan sekaligus. */
const PER_HALAMAN = 20

/** Ketikan baru dipakai 300 ms sesudah ketikan terakhir (pola halaman Murid). */
const JEDA_CARI_MS = 300

const filterAwal = { subject_id: '', tag_id: '', tipe: '' }

export default function HalamanBankSoal() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState(filterAwal)
  const [cari, setCari] = useState('')
  const [cariDipakai, setCariDipakai] = useState('')
  const [modeEditor, setModeEditor] = useState(false)
  const [soalDiubah, setSoalDiubah] = useState(/** @type {import('./api.js').DataSoal|null} */ (null))
  const [soalDihapus, setSoalDihapus] = useState(/** @type {import('./api.js').DataSoal|null} */ (null))

  // Ketikan digabung dulu: satu permintaan per jeda, bukan satu per huruf.
  useEffect(() => {
    const jeda = window.setTimeout(() => setCariDipakai(cari.trim()), JEDA_CARI_MS)
    return () => window.clearTimeout(jeda)
  }, [cari])

  const mapel = useQuery({ queryKey: ['mapel'], queryFn: ambilMapel })
  const tag = useQuery({ queryKey: ['tag'], queryFn: ambilTag })
  const bankSoal = useInfiniteQuery({
    // Filter/kata kunci jadi bagian kunci kueri: mengubahnya memulai daftar
    // dari halaman 1 lagi (halaman lama tidak menempel di bawah hasil baru).
    queryKey: ['soal', filter, cariDipakai],
    queryFn: ({ pageParam }) =>
      ambilSoal({
        subjectId: filter.subject_id === '' ? null : Number(filter.subject_id),
        tagId: filter.tag_id === '' ? null : Number(filter.tag_id),
        tipe: filter.tipe === '' ? null : filter.tipe,
        cari: cariDipakai,
        halaman: pageParam,
        perHalaman: PER_HALAMAN,
      }),
    initialPageParam: 1,
    getNextPageParam: (terakhir) =>
      terakhir.meta.current_page < terakhir.meta.last_page
        ? terakhir.meta.current_page + 1
        : undefined,
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
      setSoalDihapus(null)
      await queryClient.invalidateQueries({ queryKey: ['soal'] })
      await queryClient.invalidateQueries({ queryKey: ['tag'] })
    },
    onError: (galat) => {
      tampilkanToast('salah', pesanGalatApi(galat))
      setSoalDihapus(null)
    },
  })

  const daftar = bankSoal.data?.pages.flatMap((satu) => satu.data) ?? []
  const total = bankSoal.data?.pages[0]?.meta.total
  const adaLagi = bankSoal.hasNextPage

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
    <>
      {modeEditor ? (
        <>
          <HeaderHalaman
            jejak={
              <Tombol varian="teks" ikon={IkonPanahKiri} onClick={tutupEditor}>
                Bank soal
              </Tombol>
            }
            judul={soalDiubah === null ? 'Tambah soal' : `Ubah soal #${soalDiubah.id}`}
            deskripsi="Soal yang lengkap bisa langsung dipakai menyusun kuis."
          />

          <EditorSoal
            key={soalDiubah === null ? 'baru' : String(soalDiubah.id)}
            soal={soalDiubah}
            daftarMapel={mapel.data ?? []}
            daftarTag={tag.data ?? []}
            sedangMenyimpan={simpan.isPending}
            onSimpan={(muatan) => simpan.mutate(muatan)}
            onBatal={tutupEditor}
          />
        </>
      ) : (
        <>
          {/* Daftar memakai lebar penuh; formulirnya pindah ke halaman editor. */}
          <HeaderHalaman
            judul="Bank soal"
            jejak="Soal / Bank soal"
            deskripsi="Hanya soal objektif (pilihan ganda, benar/salah, menjodohkan, mengurutkan) yang siap dipakai kuis."
          >
            <Tombol ikon={IkonTambah} onClick={mulaiTambah}>
              Tambah soal
            </Tombol>
          </HeaderHalaman>

          <div className="kartu-soft p-4">

            <div className="row g-2 mb-3">
              <div className="col-sm-4">
                <label className="form-label small fw-semibold" htmlFor="saring-mapel">Mapel</label>
                <select
                  id="saring-mapel"
                  className="form-select form-select-sm"
                  value={filter.subject_id}
                  onChange={(e) => setFilter({ ...filter, subject_id: e.target.value })}
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
                  onChange={(e) => setFilter({ ...filter, tag_id: e.target.value })}
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
                  onChange={(e) => setFilter({ ...filter, tipe: e.target.value })}
                >
                  <option value="">Semua tipe</option>
                  {DAFTAR_TIPE.filter((tipe) => tipe.objektif).map((tipe) => (
                    <option key={tipe.nilai} value={tipe.nilai}>{tipe.label}</option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold" htmlFor="cari-soal">Cari soal</label>
                <div className="d-flex gap-2">
                  <input
                    id="cari-soal"
                    type="search"
                    className="form-control form-control-sm"
                    placeholder="Potongan teks soal"
                    value={cari}
                    onChange={(e) => setCari(e.target.value)}
                  />
                  {cari !== '' && (
                    <TombolIkon
                      label="Bersihkan pencarian"
                      ikon={IkonSilang}
                      varian="tepi"
                      onClick={() => setCari('')}
                    />
                  )}
                </div>
                <p className="teks-lembut small mb-0 mt-1">
                  Dicari ke seluruh bank soal, bukan hanya yang tampil di sini.
                </p>
              </div>
            </div>

            {bankSoal.isPending && <Skeleton judul baris={4} label="Memuat soal…" />}

            {bankSoal.isError && (
              <Banner jenis="salah" judul="Gagal memuat bank soal">
                <p className="mb-2">Periksa koneksi, lalu coba lagi.</p>
                <Tombol varian="tepi" onClick={() => bankSoal.refetch()}>
                  Coba lagi
                </Tombol>
              </Banner>
            )}

            {bankSoal.isSuccess && daftar.length === 0 && cariDipakai !== '' && (
              <KosongData
                judul={`Tidak ada soal yang cocok dengan “${cariDipakai}”`}
                ikon={IkonCari}
                aksi={
                  <Tombol varian="tepi" onClick={() => setCari('')}>
                    Bersihkan pencarian
                  </Tombol>
                }
              >
                Coba potongan teks yang lebih pendek. Pencarian berlaku ke seluruh bank soal, jadi
                soal lama pun ikut ditemukan.
              </KosongData>
            )}

            {bankSoal.isSuccess && daftar.length === 0 && cariDipakai === '' && (
              <KosongData
                judul="Belum ada soal yang cocok"
                ikon={IkonPapan}
                aksi={
                  <Tombol ikon={IkonTambah} onClick={mulaiTambah}>
                    Tambah soal
                  </Tombol>
                }
              >
                Longgarkan saringan di atas, atau tambahkan soal baru ke bank soal.
              </KosongData>
            )}

            {daftar.length > 0 && (
              <TabelData
                label="Daftar soal"
                caption={
                  total !== undefined
                    ? `Menampilkan ${daftar.length} dari ${total} soal (dimuat bertahap)`
                    : undefined
                }
                kolom={[
                  {
                    kunci: 'teks',
                    judul: 'Soal',
                    sel: (soal) => (
                      <>
                        <strong className="d-block">{ringkas(teksAman(soal.konten.teks))}</strong>
                        <span className="teks-lembut small">
                          Kunci: {ringkasKunci(soal)}
                          {soal.aktif ? '' : ' · nonaktif'}
                        </span>
                      </>
                    ),
                  },
                  { kunci: 'tipe_label', judul: 'Tipe' },
                  { kunci: 'mapel_nama', judul: 'Mapel', sel: (soal) => soal.mapel_nama ?? '—' },
                  { kunci: 'tag_nama', judul: 'Tag', sel: (soal) => soal.tag_nama ?? '—' },
                  { kunci: 'skor', judul: 'Skor' },
                  {
                    kunci: 'aksi',
                    judul: 'Aksi',
                    aksi: true,
                    sel: (soal) => (
                      <div className="aksi-baris">
                        <TombolIkon
                          label={`Ubah soal: ${ringkas(teksAman(soal.konten.teks))}`}
                          ikon={IkonPensil}
                          onClick={() => mulaiUbah(soal)}
                        />
                        <TombolIkon
                          label={`Hapus soal: ${ringkas(teksAman(soal.konten.teks))}`}
                          ikon={IkonTongSampah}
                          varian="bahaya"
                          onClick={() => setSoalDihapus(soal)}
                        />
                      </div>
                    ),
                  },
                ]}
                baris={daftar}
                kunciBaris={(soal) => soal.id}
              />
            )}

            {adaLagi && (
              <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  memuat={bankSoal.isFetchingNextPage}
                  onClick={() => void bankSoal.fetchNextPage()}
                >
                  Muat {PER_HALAMAN} soal berikutnya
                </Tombol>
                <span className="teks-lembut small">
                  Baru {daftar.length} dari {total ?? '?'} soal yang dimuat.
                </span>
              </div>
            )}
          </div>
        </>
      )}

      <DialogKonfirmasi
        buka={soalDihapus !== null}
        judul="Hapus soal ini dari bank soal?"
        labelYa="Hapus soal"
        bahaya
        memuat={hapus.isPending}
        onYa={() => {
          if (soalDihapus !== null) hapus.mutate(soalDihapus.id)
        }}
        onBatal={() => setSoalDihapus(null)}
      >
        Soal ini tidak lagi bisa dipakai menyusun kuis. Kuis yang sudah terlanjur memakainya tetap
        menyimpan susunannya. Tindakan ini tidak bisa dibatalkan.
      </DialogKonfirmasi>
    </>
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
