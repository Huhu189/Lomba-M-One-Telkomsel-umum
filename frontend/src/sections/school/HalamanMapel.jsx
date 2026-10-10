/**
 * Halaman Mata Pelajaran (slice 02) dengan pola yang sama seperti halaman
 * Kelas: kepala halaman bersama, tabel data yang jadi kartu di HP, kolom aksi
 * tombol ikon ber-label, panel formulir samping, dan dialog konfirmasi hapus.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaMapelForm } from './validasi.js'
import { ambilMapel, buatMapel, ubahMapel, hapusMapel } from './api.js'
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
import { IkonLapis, IkonPensil, IkonTambah, IkonTongSampah } from '../../icons.jsx'

const nilaiAwal = { nama: '', kode: '' }

export default function HalamanMapel() {
  const queryClient = useQueryClient()
  const [idUbah, setIdUbah] = useState(/** @type {number | null} */ (null))
  const [panelBuka, setPanelBuka] = useState(false)
  const [mapelDihapus, setMapelDihapus] = useState(
    /** @type {import('./api.js').DataMapel | null} */ (null),
  )

  const daftarMapel = useQuery({ queryKey: ['mapel'], queryFn: ambilMapel })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaMapelForm),
    defaultValues: nilaiAwal,
  })

  const simpan = useMutation({
    mutationFn: async (/** @type {import('./validasi.js').DataMapelForm} */ data) => {
      const muatan = { nama: data.nama, kode: data.kode || undefined }
      return idUbah === null ? buatMapel(muatan) : ubahMapel(idUbah, muatan)
    },
    onSuccess: async () => {
      tampilkanToast('sukses', idUbah === null ? 'Mapel ditambahkan.' : 'Mapel diperbarui.')
      tutupPanel()
      await queryClient.invalidateQueries({ queryKey: ['mapel'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const hapus = useMutation({
    mutationFn: async (/** @type {number} */ id) => hapusMapel(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Mapel dihapus.')
      setMapelDihapus(null)
      await queryClient.invalidateQueries({ queryKey: ['mapel'] })
    },
    onError: (galat) => {
      tampilkanToast('salah', pesanGalatApi(galat))
      setMapelDihapus(null)
    },
  })

  const data = daftarMapel.data ?? []

  function bukaTambah() {
    setIdUbah(null)
    reset(nilaiAwal)
    setPanelBuka(true)
  }

  /** @param {import('./api.js').DataMapel} mapel */
  function bukaUbah(mapel) {
    setIdUbah(mapel.id)
    setValue('nama', mapel.nama)
    setValue('kode', mapel.kode ?? '')
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
        judul="Mata Pelajaran"
        jejak="Data induk / Mapel"
        deskripsi={
          daftarMapel.isSuccess
            ? `${data.length} mata pelajaran aktif`
            : 'Memuat daftar mata pelajaran…'
        }
      >
        <Tombol ikon={IkonTambah} onClick={bukaTambah}>
          Tambah mapel
        </Tombol>
      </HeaderHalaman>

      {daftarMapel.isPending && <Skeleton judul baris={3} label="Memuat mapel…" />}

      {daftarMapel.isError && (
        <Banner jenis="salah" judul="Gagal memuat mata pelajaran">
          <p className="mb-2">Periksa koneksi, lalu coba lagi.</p>
          <Tombol varian="tepi" onClick={() => daftarMapel.refetch()}>
            Coba lagi
          </Tombol>
        </Banner>
      )}

      {daftarMapel.isSuccess && data.length > 0 && (
        <div className="kartu-soft p-0">
          <TabelData
            label="Daftar mata pelajaran"
            kolom={[
              { kunci: 'nama', judul: 'Nama', sel: (mapel) => <strong>{mapel.nama}</strong> },
              { kunci: 'kode', judul: 'Kode', sel: (mapel) => mapel.kode || '—' },
              {
                kunci: 'aksi',
                judul: 'Aksi',
                aksi: true,
                sel: (mapel) => (
                  <div className="aksi-baris">
                    <TombolIkon
                      label={`Ubah mapel ${mapel.nama}`}
                      ikon={IkonPensil}
                      onClick={() => bukaUbah(mapel)}
                    />
                    <TombolIkon
                      label={`Hapus mapel ${mapel.nama}`}
                      ikon={IkonTongSampah}
                      varian="bahaya"
                      onClick={() => setMapelDihapus(mapel)}
                    />
                  </div>
                ),
              },
            ]}
            baris={data}
            kunciBaris={(mapel) => mapel.id}
          />
        </div>
      )}

      {daftarMapel.isSuccess && data.length === 0 && (
        <KosongData
          judul="Belum ada mata pelajaran"
          ikon={IkonLapis}
          aksi={
            <Tombol ikon={IkonTambah} onClick={bukaTambah}>
              Tambah mapel
            </Tombol>
          }
        >
          Mata pelajaran dipakai saat menyusun kuis dan laporan. Tambahkan satu, contohnya Matematika
          atau IPAS.
        </KosongData>
      )}

      <PanelForm
        buka={panelBuka}
        judul={idUbah === null ? 'Tambah mapel' : 'Ubah mapel'}
        labelTutup="Tutup formulir mapel"
        onTutup={tutupPanel}
      >
        <form onSubmit={handleSubmit((isi) => simpan.mutate(isi))} noValidate>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="nama-mapel">
              Nama mapel
            </label>
            <input
              id="nama-mapel"
              className="form-control"
              placeholder="Contoh: Matematika"
              autoComplete="off"
              {...register('nama')}
            />
            {errors.nama && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.nama)}</p>}
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold" htmlFor="kode-mapel">
              Kode <span className="teks-lembut fw-normal">(opsional)</span>
            </label>
            <input id="kode-mapel" className="form-control" placeholder="MTK" {...register('kode')} />
            {errors.kode && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.kode)}</p>}
          </div>

          <div className="d-flex flex-wrap justify-content-end gap-2">
            <Tombol varian="tepi" onClick={tutupPanel}>
              Batal
            </Tombol>
            <Tombol type="submit" memuat={isSubmitting || simpan.isPending}>
              {idUbah === null ? 'Simpan mapel' : 'Simpan perubahan'}
            </Tombol>
          </div>
        </form>
      </PanelForm>

      <DialogKonfirmasi
        buka={mapelDihapus !== null}
        judul={`Hapus mapel ${mapelDihapus?.nama ?? ''}?`}
        labelYa="Hapus mapel"
        bahaya
        memuat={hapus.isPending}
        onYa={() => {
          if (mapelDihapus !== null) hapus.mutate(mapelDihapus.id)
        }}
        onBatal={() => setMapelDihapus(null)}
      >
        Kuis yang memakai mapel ini kehilangan penanda mapelnya. Tindakan ini tidak bisa dibatalkan.
      </DialogKonfirmasi>
    </>
  )
}
