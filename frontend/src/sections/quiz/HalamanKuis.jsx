/**
 * Halaman kelola kuis (slice 03) — guru menyusun kuis dalam tiga langkah
 * (papan desain 10): info & jadwal → susun soal → tinjau dan publikasi.
 *
 * Susunan langkah hanya alat bantu tampilan; yang menentukan tetap server:
 * kuis dibuat sebagai draf, susunan soal disinkronkan, dan publikasi diperiksa
 * kelengkapannya di backend (`KuisController@pub`).
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  IkonBuku,
  IkonCentang,
  IkonDaftar,
  IkonKirim,
  IkonPanahKiri,
  IkonPensil,
  IkonSilang,
  IkonTongSampah,
} from '../../icons.jsx'
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
import { LANGKAH_KUIS, kelengkapanKuis, ringkasJadwal, siapTerbit, totalPoin } from './susunKuis.js'
import { pesanGalatApi, teksGalat } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import DialogKonfirmasi from '../../shared/ui/DialogKonfirmasi.jsx'
import HeaderHalaman from '../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../shared/ui/KosongData.jsx'
import LangkahPil from '../../shared/ui/LangkahPil.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import { Tombol, TombolIkon } from '../../shared/ui/Tombol.jsx'

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
  const [editor, setEditor] = useState(
    /** @type {{ id: number|null, judul: string, status: string }|null} */ (null),
  )
  const [langkah, setLangkah] = useState(0)
  const [soalTerpilih, setSoalTerpilih] = useState(/** @type {number[]} */ ([]))
  const [kuisDihapus, setKuisDihapus] = useState(/** @type {import('./api.js').DataKuis|null} */ (null))

  const daftarKuis = useQuery({ queryKey: ['kuis'], queryFn: ambilKuis })
  const mapel = useQuery({ queryKey: ['mapel'], queryFn: ambilMapel })
  const kelas = useQuery({ queryKey: ['kelas'], queryFn: ambilKelas })
  const bankSoal = useQuery({ queryKey: ['soal', 'semua'], queryFn: () => ambilSoal({}) })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaKuisForm),
    defaultValues: nilaiAwal,
  })

  // Ringkasan langkah 3 ikut berubah saat guru mengetik (useWatch, bukan watch(),
  // supaya React Compiler tidak melewati komponen ini).
  const nilai = { ...nilaiAwal, ...useWatch({ control, defaultValue: nilaiAwal }) }

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
      return editor === null || editor.id === null
        ? buatKuis(muatan)
        : ubahKuis(editor.id, muatan)
    },
    onSuccess: async (kuis) => {
      tampilkanToast('sukses', editor?.id === null ? 'Kuis dibuat sebagai draf.' : 'Kuis diperbarui.')
      setEditor({ id: kuis.id, judul: kuis.judul, status: kuis.status })
      // Langkah 2 langsung bisa dibuka: kuis (draf) sudah punya id di server.
      setLangkah(1)
      await segarkan()
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const simpanSusunan = useMutation({
    mutationFn: async (/** @type {{ id: number, soal: number[] }} */ muatan) =>
      sinkronSoalKuis(muatan.id, muatan.soal),
    onSuccess: async () => {
      await segarkan()
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const publikasi = useMutation({
    mutationFn: async (/** @type {number} */ id) => publikasiKuis(id),
    onSuccess: async () => {
      tampilkanToast('sukses', 'Kuis diterbitkan. Murid di kelas itu sudah bisa melihatnya.')
      tutupEditor()
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
      setKuisDihapus(null)
      await segarkan()
    },
    onError: (galat) => {
      tampilkanToast('salah', pesanGalatApi(galat))
      setKuisDihapus(null)
    },
  })

  function tutupEditor() {
    setEditor(null)
    setLangkah(0)
    setSoalTerpilih([])
    reset(nilaiAwal)
  }

  /** Buka alur tiga langkah untuk kuis baru (draf di server). */
  function buatBaru() {
    setEditor({ id: null, judul: '', status: 'draf' })
    setSoalTerpilih([])
    reset(nilaiAwal)
    setLangkah(0)
  }

  /**
   * Buka langkah 1 dengan isi kuis yang sudah ada; susunan soalnya dimuat
   * sekalian supaya ringkasan di langkah 3 tidak menebak-nebak.
   * @param {import('./api.js').DataKuis} kuis
   */
  async function mulaiUbah(kuis) {
    setEditor({ id: kuis.id, judul: kuis.judul, status: kuis.status })
    setValue('judul', kuis.judul)
    setValue('deskripsi', kuis.deskripsi ?? '')
    setValue('subject_id', String(kuis.subject_id ?? ''))
    setValue('class_id', String(kuis.class_id ?? ''))
    setValue('durasi_menit', String(kuis.durasi_menit))
    setValue('mulai_at', keLokal(kuis.mulai_at))
    setValue('selesai_at', keLokal(kuis.selesai_at))
    setValue('acak_soal', kuis.acak_soal ?? true)
    setValue('acak_opsi', kuis.acak_opsi ?? true)
    setLangkah(0)

    try {
      const rinci = await ambilKuisDetail(kuis.id)
      setSoalTerpilih((rinci.soal ?? []).map((satu) => satu.id))
    } catch (galat) {
      tampilkanToast('salah', pesanGalatApi(galat))
    }
  }

  /**
   * Lompat langsung ke langkah 2 (aksi "Susun soal" pada daftar) dan ambil
   * susunan yang sudah tersimpan.
   * @param {import('./api.js').DataKuis} kuis
   */
  async function bukaSusun(kuis) {
    try {
      const rinci = await ambilKuisDetail(kuis.id)
      setSoalTerpilih((rinci.soal ?? []).map((satu) => satu.id))
      setEditor({ id: kuis.id, judul: kuis.judul, status: kuis.status })
      setLangkah(1)
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

  /** Langkah 2 → 3: susunan soal wajib tersimpan di server lebih dulu. */
  async function keTinjau() {
    if (editor === null || editor.id === null) return

    try {
      const kuis = await simpanSusunan.mutateAsync({ id: editor.id, soal: soalTerpilih })
      setEditor({ id: kuis.id, judul: kuis.judul, status: kuis.status })
      setLangkah(2)
    } catch {
      // pesan galat sudah tampil lewat onError mutasi
    }
  }

  const katalog = bankSoal.data?.data ?? []
  const kelasTerpilih = (kelas.data ?? []).find((satu) => String(satu.id) === nilai.class_id)
  const poinTerpilih = totalPoin(soalTerpilih, katalog)
  const adaSoalNonaktif = soalTerpilih.some(
    (id) => katalog.find((satu) => satu.id === id)?.aktif === false,
  )
  const kelengkapan = kelengkapanKuis(nilai, {
    jumlahSoal: soalTerpilih.length,
    adaSoalNonaktif,
  })
  const bisaTerbit = siapTerbit(kelengkapan)
/** Label & warna lencana status kuis di kepala halaman editor. */
const LABEL_STATUS = /** @type {Record<string, string>} */ ({ draf: 'Draf', publikasi: 'Terbit', arsip: 'Diarsipkan' })
const JENIS_STATUS = /** @type {Record<string, string>} */ ({
  draf: 'lembut',
  publikasi: 'info',
  arsip: 'peringatan',
})

  if (editor !== null) {
    return (
      <>
        <HeaderHalaman
          jejak={
            <Tombol varian="teks" ikon={IkonPanahKiri} onClick={tutupEditor}>
              Kuis &amp; Ulangan
            </Tombol>
          }
          judul={editor.judul.trim() === '' ? 'Kuis baru' : editor.judul}
          deskripsi="Kuis dibuat sebagai draf; murid baru melihatnya setelah diterbitkan."
        >
          <span className={`badge-status ${JENIS_STATUS[editor.status] ?? 'lembut'}`}>
            {LABEL_STATUS[editor.status] ?? 'Draf'}
          </span>
        </HeaderHalaman>

        <LangkahPil
          langkah={LANGKAH_KUIS}
          aktif={langkah}
          onPilih={setLangkah}
          label="Langkah menyusun kuis"
        />

        <div className="mt-4 d-flex flex-column gap-4">
          {langkah === 0 && (
            <form
              className="kartu-soft p-4"
              aria-labelledby="langkah-1"
              noValidate
              onSubmit={handleSubmit((data) => simpan.mutate(data))}
            >
              <h2 id="langkah-1" className="judul-bagian">Info dan jadwal</h2>

              <div className="bidang mb-3">
                <label className="form-label" htmlFor="kuis-judul">Judul kuis</label>
                <input
                  id="kuis-judul"
                  className="form-control"
                  placeholder="Contoh: Ulangan Harian IPA Bab 3"
                  {...register('judul')}
                />
                {errors.judul && <p className="status-salah small mb-0">{teksGalat(errors.judul)}</p>}
              </div>

              <div className="row g-3 mb-3">
                <div className="col-sm-6 col-lg-3">
                  <div className="bidang">
                    <label className="form-label" htmlFor="kuis-mapel">Mapel</label>
                    <select id="kuis-mapel" className="form-select" {...register('subject_id')}>
                      <option value="">Pilih mapel…</option>
                      {(mapel.data ?? []).map((satu) => (
                        <option key={satu.id} value={String(satu.id)}>{satu.nama}</option>
                      ))}
                    </select>
                    {errors.subject_id && (
                      <p className="status-salah small mb-0">{teksGalat(errors.subject_id)}</p>
                    )}
                  </div>
                </div>

                <div className="col-sm-6 col-lg-3">
                  <div className="bidang">
                    <label className="form-label" htmlFor="kuis-kelas">Kelas</label>
                    <select id="kuis-kelas" className="form-select" {...register('class_id')}>
                      <option value="">Pilih kelas…</option>
                      {(kelas.data ?? []).map((satu) => (
                        <option key={satu.id} value={String(satu.id)}>{satu.nama}</option>
                      ))}
                    </select>
                    {errors.class_id && (
                      <p className="status-salah small mb-0">{teksGalat(errors.class_id)}</p>
                    )}
                  </div>
                </div>

                <div className="col-sm-6 col-lg-3">
                  <div className="bidang">
                    <label className="form-label" htmlFor="kuis-durasi">Durasi (menit)</label>
                    <input
                      id="kuis-durasi"
                      className="form-control"
                      type="number"
                      min={1}
                      max={300}
                      {...register('durasi_menit')}
                    />
                    {errors.durasi_menit && (
                      <p className="status-salah small mb-0">{teksGalat(errors.durasi_menit)}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-sm-6">
                  <div className="bidang">
                    <label className="form-label" htmlFor="kuis-mulai">Mulai</label>
                    <input
                      id="kuis-mulai"
                      className="form-control"
                      type="datetime-local"
                      {...register('mulai_at')}
                    />
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="bidang">
                    <label className="form-label" htmlFor="kuis-selesai">Selesai</label>
                    <input
                      id="kuis-selesai"
                      className="form-control"
                      type="datetime-local"
                      {...register('selesai_at')}
                    />
                    {errors.selesai_at && (
                      <p className="status-salah small mb-0">{teksGalat(errors.selesai_at)}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bidang mb-3">
                <label className="form-label" htmlFor="kuis-deskripsi">
                  Deskripsi <span className="teks-lembut fw-normal">(opsional)</span>
                </label>
                <textarea
                  id="kuis-deskripsi"
                  className="form-control"
                  rows={2}
                  placeholder="Pesan singkat untuk murid"
                  {...register('deskripsi')}
                />
              </div>

              <div className="d-flex flex-wrap gap-3 mb-3">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="kuis-acak-soal"
                    {...register('acak_soal')}
                  />
                  <label className="form-check-label" htmlFor="kuis-acak-soal">Acak urutan soal</label>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="kuis-acak-opsi"
                    {...register('acak_opsi')}
                  />
                  <label className="form-check-label" htmlFor="kuis-acak-opsi">Acak urutan pilihan jawaban</label>
                </div>
              </div>

              <p className="teks-lembut small">
                Pengaturan lanjutan (percobaan ulang, peringkat, pengaman) mengikuti pengaturan
                sekolah atau kelas, dan bisa diubah khusus untuk kuis ini di halaman Pengaturan.
              </p>

              <div className="d-flex flex-wrap justify-content-end gap-2 mt-3">
                <Tombol varian="tepi" onClick={tutupEditor}>Batal</Tombol>
                <Tombol type="submit" memuat={isSubmitting || simpan.isPending}>
                  Lanjut: susun soal
                </Tombol>
              </div>
            </form>
          )}

          {langkah === 1 && (
            <>
              <div className="row g-4 align-items-start">
                <div className="col-lg-6">
                  <div className="kartu-soft p-4 h-100">
                    <h2 className="judul-bagian">Bank soal</h2>
                    <p className="teks-lembut small">
                      Pilih soal untuk dimasukkan ke kuis. Soal yang dipilih ditandai centang.
                    </p>

                    {bankSoal.isPending && <Skeleton baris={4} label="Memuat bank soal…" />}
                    {bankSoal.isError && (
                      <Banner jenis="salah" judul="Gagal memuat bank soal">
                        <p className="mb-2">Periksa koneksi, lalu coba lagi.</p>
                        <Tombol varian="tepi" onClick={() => bankSoal.refetch()}>Coba lagi</Tombol>
                      </Banner>
                    )}
                    {bankSoal.isSuccess && katalog.length === 0 && (
                      <div className="kotak-kosong">
                        Bank soal masih kosong. Tambahkan soal dulu di halaman Bank Soal.
                      </div>
                    )}

                    <div className="d-flex flex-column gap-2">
                      {katalog.map((soal) => {
                        const dipilih = soalTerpilih.includes(soal.id)

                        return (
                          <button
                            key={soal.id}
                            type="button"
                            className="pilih-soal"
                            role="checkbox"
                            aria-checked={dipilih}
                            onClick={() => alihkan(soal.id)}
                          >
                            <span className="kotak-centang" aria-hidden="true">
                              {dipilih && <IkonCentang size={14} />}
                            </span>
                            <span className="flex-grow-1 teks-patah">
                              <span className="badge-status lembut me-2">{soal.tipe_label}</span>
                              {!soal.aktif && (
                                <span className="badge-status peringatan me-2">nonaktif</span>
                              )}
                              <span className="fw-semibold">{ringkasSoal(soal.konten)}</span>
                            </span>
                            <span className="teks-lembut small">{soal.skor} poin</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="kartu-soft p-4 h-100">
                    <div className="d-flex align-items-baseline gap-2">
                      <h2 className="judul-bagian flex-grow-1 mb-0">Susunan kuis</h2>
                      <span className="fw-bold">
                        {soalTerpilih.length} soal · {poinTerpilih} poin
                      </span>
                    </div>

                    {soalTerpilih.length === 0 && (
                      <div className="kotak-kosong mt-2">
                        Belum ada soal. Pilih dari bank soal di sebelah kiri.
                      </div>
                    )}

                    <ol className="list-unstyled d-flex flex-column gap-2 mt-2 mb-2">
                      {soalTerpilih.map((id, index) => {
                        const soal = katalog.find((satu) => satu.id === id)

                        return (
                          <li key={id} className="baris-ringkas">
                            <strong className="susunan-no">{index + 1}</strong>
                            <span className="flex-grow-1 teks-patah">
                              {soal ? ringkasSoal(soal.konten) : `Soal #${id}`}
                            </span>
                            <TombolIkon
                              label={`Naikkan soal nomor ${index + 1}`}
                              ikon={IkonPanahKiri}
                              className="putar-90"
                              disabled={index === 0}
                              onClick={() => geser(index, -1)}
                            />
                            <TombolIkon
                              label={`Turunkan soal nomor ${index + 1}`}
                              ikon={IkonPanahKiri}
                              className="putar-270"
                              disabled={index === soalTerpilih.length - 1}
                              onClick={() => geser(index, 1)}
                            />
                            <TombolIkon
                              label={`Keluarkan soal nomor ${index + 1}`}
                              ikon={IkonSilang}
                              varian="bahaya"
                              onClick={() => alihkan(id)}
                            />
                          </li>
                        )
                      })}
                    </ol>

                    <p className="teks-lembut small mb-0">
                      Urutan ini dipakai bila pengacakan dimatikan. Bila dinyalakan, tiap murid
                      mendapat urutan acak dari server.
                    </p>
                  </div>
                </div>
              </div>

              <div className="d-flex flex-wrap justify-content-between gap-2">
                <Tombol varian="tepi" onClick={() => setLangkah(0)}>Kembali</Tombol>
                <Tombol memuat={simpanSusunan.isPending} onClick={() => void keTinjau()}>
                  Lanjut: tinjau
                </Tombol>
              </div>
            </>
          )}

          {langkah === 2 && (
            <>
              <section className="kartu-soft p-4" aria-labelledby="langkah-3">
                <h2 id="langkah-3" className="judul-bagian">Tinjau sebelum dipublikasikan</h2>

                <ul className="list-unstyled d-flex flex-column gap-2">
                  {kelengkapan.map((satu) => (
                    <li key={satu.teks} className="baris-ringkas">
                      <span className={`badge-status ${satu.ok ? 'sukses' : 'peringatan'}`}>
                        {satu.ok ? 'Lengkap' : 'Belum'}
                      </span>
                      <span className="flex-grow-1">{satu.teks}</span>
                    </li>
                  ))}
                </ul>

                <div className="row g-3 mt-1">
                  <div className="col-sm-6 col-lg-4">
                    <div className="petak-ringkas">
                      <span className="teks-lembut small">Untuk kelas</span>
                      <strong className="d-block fs-5">
                        {kelasTerpilih
                          ? `${kelasTerpilih.nama}${kelasTerpilih.jumlah_murid === undefined ? '' : ` · ${kelasTerpilih.jumlah_murid} murid`}`
                          : 'Belum dipilih'}
                      </strong>
                    </div>
                  </div>
                  <div className="col-sm-6 col-lg-4">
                    <div className="petak-ringkas">
                      <span className="teks-lembut small">Jadwal</span>
                      <strong className="d-block fs-5">
                        {`${ringkasJadwal(nilai.mulai_at, nilai.selesai_at)} · ${formatDurasi(Number(nilai.durasi_menit) || 0)}`}
                      </strong>
                    </div>
                  </div>
                  <div className="col-sm-6 col-lg-4">
                    <div className="petak-ringkas">
                      <span className="teks-lembut small">Soal</span>
                      <strong className="d-block fs-5">
                        {soalTerpilih.length} soal · {poinTerpilih} poin
                      </strong>
                    </div>
                  </div>
                </div>

                <p className="badge-status info mt-3 mb-0">
                  Setelah kuis mulai berjalan, soal tidak bisa diubah lagi.
                </p>
              </section>

              <div className="d-flex flex-wrap justify-content-between gap-2">
                <Tombol varian="tepi" onClick={() => setLangkah(1)}>Kembali</Tombol>
                <Tombol
                  ikon={IkonKirim}
                  disabled={!bisaTerbit}
                  memuat={publikasi.isPending}
                  onClick={() => {
                    if (editor.id !== null) publikasi.mutate(editor.id)
                  }}
                >
                  Publikasikan kuis
                </Tombol>
              </div>

              {!bisaTerbit && (
                <p className="teks-lembut small mb-0">
                  Lengkapi butir yang masih “Belum” di atas sebelum menerbitkan.
                </p>
              )}
            </>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <HeaderHalaman
        judul="Kuis & Ulangan"
        jejak="Ujian / Kuis"
        deskripsi="Kuis dibuat sebagai draf; murid baru melihatnya setelah diterbitkan dan jadwalnya dimulai."
      >
        <Tombol onClick={buatBaru}>Buat kuis</Tombol>
      </HeaderHalaman>

      <div className="kartu-soft p-4">
        {daftarKuis.isPending && <Skeleton judul baris={3} label="Memuat kuis…" />}

        {daftarKuis.isError && (
          <Banner jenis="salah" judul="Gagal memuat kuis">
            <p className="mb-2">Periksa koneksi, lalu coba lagi.</p>
            <Tombol varian="tepi" onClick={() => daftarKuis.refetch()}>Coba lagi</Tombol>
          </Banner>
        )}

        {daftarKuis.isSuccess && (daftarKuis.data ?? []).length === 0 && (
          <KosongData
            judul="Belum ada kuis"
            ikon={IkonDaftar}
            aksi={<Tombol onClick={buatBaru}>Buat kuis</Tombol>}
          >
            Susun kuis pertama dalam tiga langkah: info dan jadwal, susun soal, lalu tinjau dan
            publikasikan.
          </KosongData>
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

                <div className="kartu-aksi">
                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    ikon={IkonPensil}
                    onClick={() => void mulaiUbah(kuis)}
                  >
                    Ubah
                  </Tombol>
                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    ikon={IkonDaftar}
                    onClick={() => void bukaSusun(kuis)}
                  >
                    Susun soal
                  </Tombol>
                  {kuis.status === 'draf' && (
                    <Tombol
                      ukuran="sedang"
                      ikon={IkonKirim}
                      memuat={publikasi.isPending}
                      onClick={() => publikasi.mutate(kuis.id)}
                    >
                      Terbitkan
                    </Tombol>
                  )}
                  {kuis.status !== 'arsip' && (
                    <Tombol
                      varian="tepi"
                      ukuran="sedang"
                      ikon={IkonBuku}
                      memuat={arsipkan.isPending}
                      onClick={() => arsipkan.mutate(kuis.id)}
                    >
                      Arsipkan
                    </Tombol>
                  )}
                  <TombolIkon
                    label={`Hapus kuis ${kuis.judul}`}
                    ikon={IkonTongSampah}
                    varian="bahaya"
                    onClick={() => setKuisDihapus(kuis)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <DialogKonfirmasi
        buka={kuisDihapus !== null}
        judul={`Hapus kuis “${kuisDihapus?.judul ?? ''}”?`}
        labelYa="Hapus kuis"
        bahaya
        memuat={hapus.isPending}
        onYa={() => {
          if (kuisDihapus !== null) hapus.mutate(kuisDihapus.id)
        }}
        onBatal={() => setKuisDihapus(null)}
      >
        Soal di dalam kuis ini tidak dihapus dari bank soal, dan murid yang sudah mengerjakan tetap
        menyimpan hasilnya. Tindakan ini tidak bisa dibatalkan.
      </DialogKonfirmasi>
    </>
  )
}
