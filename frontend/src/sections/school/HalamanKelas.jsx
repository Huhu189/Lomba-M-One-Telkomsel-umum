/**
 * Halaman Kelas (slice 02) mengikuti papan desain "Kelola Kelas (sesudah)":
 * kepala halaman bersama, saringan tingkat, tabel data yang berubah jadi kartu
 * di HP, kolom aksi berisi tombol ikon ber-aria-label, keadaan memuat/kosong/
 * galat yang utuh, dan dialog konfirmasi hapus yang menyebut dampaknya.
 *
 * Formulir tambah/ubah tampil sebagai panel samping (bukan kolom tetap) supaya
 * daftar kelas memakai lebar penuh dan tidak ada halaman setengah kosong.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaKelasForm } from './validasi.js'
import { ambilKelas, buatKelas, ubahKelas, hapusKelas } from './api.js'
import { pesanGalatApi, teksGalat } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import DialogKonfirmasi from '../../shared/ui/DialogKonfirmasi.jsx'
import HeaderHalaman from '../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../shared/ui/KosongData.jsx'
import PanelForm from '../../shared/ui/PanelForm.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import TabelData from '../../shared/ui/TabelData.jsx'
import { Tombol, TombolIkon } from '../../shared/ui/Tombol.jsx'
import { IkonKisi, IkonPensil, IkonTambah, IkonTongSampah } from '../../icons.jsx'

const nilaiAwal = { nama: '', tingkat: '', tahun_ajaran: '' }

/** @type {import('../../shared/ui/TabelData.jsx').KolomTabel[]} */
const kolomKelas = [
  {
    kunci: 'nama',
    judul: 'Kelas',
    sel: (kelas) => <strong>{kelas.nama}</strong>,
  },
  { kunci: 'tingkat', judul: 'Tingkat', sel: (kelas) => `Tingkat ${kelas.tingkat}` },
  {
    kunci: 'tahun_ajaran',
    judul: 'Tahun ajaran',
    sel: (kelas) => kelas.tahun_ajaran || '—',
  },
  { kunci: 'jumlah_murid', judul: 'Murid', sel: (kelas) => `${kelas.jumlah_murid ?? 0} murid` },
]

export default function HalamanKelas() {
  const queryClient = useQueryClient()
  const [idUbah, setIdUbah] = useState(/** @type {number | null} */ (null))
  const [panelBuka, setPanelBuka] = useState(false)
  const [kelasDihapus, setKelasDihapus] = useState(
    /** @type {import('./api.js').DataKelas | null} */ (null),
  )
  const [saring, setSaring] = useState(/** @type {'semua' | number} */ ('semua'))

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
      tutupPanel()
      await queryClient.invalidateQueries({ queryKey: ['kelas'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const hapus = useMutation({
    mutationFn: async (/** @type {number} */ id) => hapusKelas(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Kelas dihapus.')
      setKelasDihapus(null)
      await queryClient.invalidateQueries({ queryKey: ['kelas'] })
    },
    onError: (galat) => {
      tampilkanToast('salah', pesanGalatApi(galat))
      setKelasDihapus(null)
    },
  })

  const data = daftarKelas.data ?? []
  const terlihat = saring === 'semua' ? data : data.filter((kelas) => kelas.tingkat === saring)
  const tahunAjaran = data[0]?.tahun_ajaran || '—'
  const ringkas = daftarKelas.isSuccess
    ? `${data.length} kelas · Tahun ajaran ${tahunAjaran}`
    : 'Memuat daftar kelas…'

  function bukaTambah() {
    setIdUbah(null)
    reset(nilaiAwal)
    setPanelBuka(true)
  }

  /** @param {import('./api.js').DataKelas} kelas */
  function bukaUbah(kelas) {
    setIdUbah(kelas.id)
    setValue('nama', kelas.nama)
    setValue('tingkat', String(kelas.tingkat))
    setValue('tahun_ajaran', kelas.tahun_ajaran ?? '')
    setPanelBuka(true)
  }

  function tutupPanel() {
    setPanelBuka(false)
    setIdUbah(null)
    reset(nilaiAwal)
  }

  return (
    <>
      <HeaderHalaman
        judul="Kelas"
        jejak="Data induk / Kelas"
        deskripsi={ringkas}
      >
        <Tombol ikon={IkonTambah} onClick={bukaTambah}>
          Tambah kelas
        </Tombol>
      </HeaderHalaman>

      {daftarKelas.isPending && <Skeleton judul baris={4} label="Memuat kelas…" />}

      {daftarKelas.isError && (
        <Banner jenis="salah" judul="Gagal memuat kelas">
          <p className="mb-2">Periksa koneksi, lalu coba lagi.</p>
          <Tombol varian="tepi" onClick={() => daftarKelas.refetch()}>
            Coba lagi
          </Tombol>
        </Banner>
      )}

      {daftarKelas.isSuccess && data.length > 0 && (
        <div role="group" aria-label="Saring menurut tingkat" className="d-flex flex-wrap gap-2 mb-4">
          {/** @type {('semua' | number)[]} */ (['semua', 1, 2, 3, 4, 5, 6]).map((tingkat) => (
            <button
              key={String(tingkat)}
              type="button"
              className="pil-saring"
              aria-pressed={saring === tingkat}
              onClick={() => setSaring(tingkat)}
            >
              {tingkat === 'semua' ? 'Semua' : `Tingkat ${tingkat}`}
            </button>
          ))}
        </div>
      )}

      {daftarKelas.isSuccess && data.length > 0 && terlihat.length > 0 && (
        <div className="kartu-soft p-0">
          <TabelData
            label="Daftar kelas"
            kolom={[
              ...kolomKelas,
              {
                kunci: 'aksi',
                judul: 'Aksi',
                aksi: true,
                sel: (kelas) => (
                  <div className="aksi-baris">
                    <TombolIkon
                      label={`Ubah kelas ${kelas.nama}`}
                      ikon={IkonPensil}
                      onClick={() => bukaUbah(kelas)}
                    />
                    <TombolIkon
                      label={`Hapus kelas ${kelas.nama}`}
                      ikon={IkonTongSampah}
                      varian="bahaya"
                      onClick={() => setKelasDihapus(kelas)}
                    />
                  </div>
                ),
              },
            ]}
            baris={terlihat}
            kunciBaris={(kelas) => kelas.id}
          />
        </div>
      )}

      {daftarKelas.isSuccess && (data.length === 0 || terlihat.length === 0) && (
        <KosongData
          judul={data.length === 0 ? 'Belum ada kelas' : `Belum ada kelas tingkat ${saring}`}
          ikon={IkonKisi}
          aksi={
            <Tombol ikon={IkonTambah} onClick={bukaTambah}>
              Tambah kelas
            </Tombol>
          }
        >
          Kelas dipakai untuk mengelompokkan murid dan membagikan kuis. Tambahkan satu kelas, lalu
          impor murid ke dalamnya.
        </KosongData>
      )}

      <PanelForm
        buka={panelBuka}
        judul={idUbah === null ? 'Tambah kelas' : 'Ubah kelas'}
        labelTutup="Tutup formulir kelas"
        onTutup={tutupPanel}
      >
        <form onSubmit={handleSubmit((isi) => simpan.mutate(isi))} noValidate>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="nama-kelas">
              Nama kelas
            </label>
            <input
              id="nama-kelas"
              className="form-control"
              placeholder="Contoh: 6A"
              autoComplete="off"
              {...register('nama')}
            />
            {errors.nama && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.nama)}</p>}
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="tingkat-kelas">
              Tingkat
            </label>
            <select id="tingkat-kelas" className="form-select" {...register('tingkat')}>
              <option value="">Pilih tingkat…</option>
              {[1, 2, 3, 4, 5, 6].map((t) => (
                <option key={t} value={String(t)}>
                  Kelas {t}
                </option>
              ))}
            </select>
            {errors.tingkat && (
              <p className="status-salah small mb-0 mt-1">{teksGalat(errors.tingkat)}</p>
            )}
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold" htmlFor="tahun-kelas">
              Tahun ajaran <span className="teks-lembut fw-normal">(opsional)</span>
            </label>
            <input
              id="tahun-kelas"
              className="form-control"
              placeholder="2026/2027"
              {...register('tahun_ajaran')}
            />
          </div>

          <div className="d-flex flex-wrap justify-content-end gap-2">
            <Tombol varian="tepi" onClick={tutupPanel}>
              Batal
            </Tombol>
            <Tombol type="submit" memuat={isSubmitting || simpan.isPending}>
              {idUbah === null ? 'Simpan kelas' : 'Simpan perubahan'}
            </Tombol>
          </div>
        </form>
      </PanelForm>

      <DialogKonfirmasi
        buka={kelasDihapus !== null}
        judul={`Hapus kelas ${kelasDihapus?.nama ?? ''}?`}
        labelYa="Hapus kelas"
        bahaya
        memuat={hapus.isPending}
        onYa={() => {
          if (kelasDihapus !== null) hapus.mutate(kelasDihapus.id)
        }}
        onBatal={() => setKelasDihapus(null)}
      >
        {kelasDihapus?.jumlah_murid ?? 0} murid akan dilepas dari kelas ini. Hasil kuis mereka tetap
        tersimpan. Tindakan ini tidak bisa dibatalkan.
      </DialogKonfirmasi>
    </>
  )
}
