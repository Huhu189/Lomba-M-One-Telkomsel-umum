/**
 * Halaman Murid (slice 02) mengikuti pola papan desain: kepala halaman bersama
 * dengan tombol impor/ekspor CSV di kanan, saringan kelas, tabel data yang
 * berubah jadi kartu di HP (kolom aksi tetap terlihat), panel formulir samping,
 * dialog konfirmasi hapus, serta keadaan memuat/kosong/galat yang utuh.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaMuridForm } from './validasi.js'
import {
  URL_EKSPOR_MURID,
  ambilKelas,
  ambilMurid,
  buatMurid,
  ubahMurid,
  hapusMurid,
} from './api.js'
import { pesanGalatApi, teksGalat } from '../auth/api.js'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import Banner from '../../shared/ui/Banner.jsx'
import DialogKonfirmasi from '../../shared/ui/DialogKonfirmasi.jsx'
import HeaderHalaman from '../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../shared/ui/KosongData.jsx'
import PanelForm from '../../shared/ui/PanelForm.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import TabelData from '../../shared/ui/TabelData.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { TombolIkon } from '../../shared/ui/Tombol.jsx'
import { RUTE } from '../../routes.js'
import { IkonPengguna, IkonPensil, IkonTambah, IkonTongSampah } from '../../icons.jsx'

const nilaiAwal = { nama: '', email: '', class_id: '', nis: '', nisn: '' }

export default function HalamanMurid() {
  const queryClient = useQueryClient()
  const [filterKelas, setFilterKelas] = useState('')
  const [halaman, setHalaman] = useState(1)
  const [idUbah, setIdUbah] = useState(/** @type {number | null} */ (null))
  const [panelBuka, setPanelBuka] = useState(false)
  const [muridDihapus, setMuridDihapus] = useState(
    /** @type {import('./api.js').DataMurid | null} */ (null),
  )

  const kelasId = filterKelas ? Number(filterKelas) : null
  const daftarKelas = useQuery({ queryKey: ['kelas'], queryFn: ambilKelas })
  const daftarMurid = useQuery({
    queryKey: ['murid', kelasId, halaman],
    queryFn: () => ambilMurid(kelasId, halaman),
  })

  const meta = daftarMurid.data?.meta
  const barisMurid = daftarMurid.data?.data ?? []

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaMuridForm),
    defaultValues: nilaiAwal,
  })

  const simpan = useMutation({
    mutationFn: async (/** @type {import('./validasi.js').DataMuridForm} */ data) => {
      const muatan = {
        nama: data.nama,
        email: data.email,
        class_id: Number(data.class_id),
        nis: data.nis || undefined,
        nisn: data.nisn || undefined,
      }
      return idUbah === null ? buatMurid(muatan) : ubahMurid(idUbah, muatan)
    },
    onSuccess: async () => {
      tampilkanToast('sukses', idUbah === null ? 'Murid ditambahkan.' : 'Murid diperbarui.')
      tutupPanel()
      await queryClient.invalidateQueries({ queryKey: ['murid'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const hapus = useMutation({
    mutationFn: async (/** @type {number} */ id) => hapusMurid(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Murid dihapus.')
      setMuridDihapus(null)
      await queryClient.invalidateQueries({ queryKey: ['murid'] })
    },
    onError: (galat) => {
      tampilkanToast('salah', pesanGalatApi(galat))
      setMuridDihapus(null)
    },
  })

  function bukaTambah() {
    setIdUbah(null)
    reset(nilaiAwal)
    setPanelBuka(true)
  }

  /** @param {import('./api.js').DataMurid} murid */
  function bukaUbah(murid) {
    setIdUbah(murid.id)
    setValue('nama', murid.nama)
    setValue('email', murid.email)
    setValue('class_id', String(murid.class_id))
    setValue('nis', murid.nis ?? '')
    setValue('nisn', murid.nisn ?? '')
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
        judul="Murid"
        jejak="Data induk / Murid"
        deskripsi={
          meta ? `Menampilkan ${barisMurid.length} dari ${meta.total} murid` : 'Memuat data murid…'
        }
      >
        <Link className="btn btn-tepi" to={RUTE.imporMurid}>
          Impor CSV
        </Link>
        <a className="btn btn-tepi" href={URL_EKSPOR_MURID}>
          Ekspor CSV
        </a>
        <Tombol ikon={IkonTambah} onClick={bukaTambah}>
          Tambah murid
        </Tombol>
      </HeaderHalaman>

      <div className="mb-4" style={{ maxWidth: '18rem' }}>
        <label className="form-label fw-semibold" htmlFor="filter-kelas">
          Kelas
        </label>
        <select
          id="filter-kelas"
          className="form-select"
          value={filterKelas}
          onChange={(e) => {
            setFilterKelas(e.target.value)
            setHalaman(1)
          }}
        >
          <option value="">Semua kelas</option>
          {(daftarKelas.data ?? []).map((kelas) => (
            <option key={kelas.id} value={String(kelas.id)}>
              {kelas.nama}
            </option>
          ))}
        </select>
      </div>

      {daftarMurid.isPending && <Skeleton judul baris={4} label="Memuat murid…" />}

      {daftarMurid.isError && (
        <Banner jenis="salah" judul="Gagal memuat data murid">
          <p className="mb-2">Periksa koneksi, lalu coba lagi.</p>
          <Tombol varian="tepi" onClick={() => daftarMurid.refetch()}>
            Coba lagi
          </Tombol>
        </Banner>
      )}

      {daftarMurid.isSuccess && barisMurid.length > 0 && (
        <div className="kartu-soft p-0">
          <TabelData
            label="Daftar murid"
            kolom={[
              { kunci: 'nis', judul: 'NIS', sel: (murid) => murid.nis || '—' },
              {
                kunci: 'nama',
                judul: 'Nama',
                sel: (murid) => (
                  <>
                    <strong className="d-block">{murid.nama}</strong>
                    <span className="teks-lembut small">{murid.email}</span>
                  </>
                ),
              },
              { kunci: 'kelas_nama', judul: 'Kelas', sel: (murid) => murid.kelas_nama || '—' },
              {
                kunci: 'aksi',
                judul: 'Aksi',
                aksi: true,
                sel: (murid) => (
                  <div className="aksi-baris">
                    <TombolIkon
                      label={`Ubah murid ${murid.nama}`}
                      ikon={IkonPensil}
                      onClick={() => bukaUbah(murid)}
                    />
                    <TombolIkon
                      label={`Hapus murid ${murid.nama}`}
                      ikon={IkonTongSampah}
                      varian="bahaya"
                      onClick={() => setMuridDihapus(murid)}
                    />
                  </div>
                ),
              },
            ]}
            baris={barisMurid}
            kunciBaris={(murid) => murid.id}
          />
        </div>
      )}

      {daftarMurid.isSuccess && barisMurid.length === 0 && (
        <KosongData
          judul="Belum ada murid pada saringan ini"
          ikon={IkonPengguna}
          aksi={
            <Tombol ikon={IkonTambah} onClick={bukaTambah}>
              Tambah murid
            </Tombol>
          }
        >
          Murid bisa ditambahkan satu per satu atau sekaligus lewat berkas CSV berisi nama, email,
          dan kelas.
        </KosongData>
      )}

      {meta && meta.last_page > 1 && (
        <nav className="d-flex flex-wrap align-items-center gap-3 mt-4" aria-label="Navigasi halaman">
          <Tombol
            varian="tepi"
            ukuran="sedang"
            disabled={halaman <= 1}
            onClick={() => setHalaman(halaman - 1)}
          >
            Sebelumnya
          </Tombol>
          <span className="teks-lembut">
            Halaman {meta.current_page} dari {meta.last_page}
          </span>
          <Tombol
            varian="tepi"
            ukuran="sedang"
            disabled={halaman >= meta.last_page}
            onClick={() => setHalaman(halaman + 1)}
          >
            Berikutnya
          </Tombol>
        </nav>
      )}

      <PanelForm
        buka={panelBuka}
        judul={idUbah === null ? 'Tambah murid' : 'Ubah murid'}
        labelTutup="Tutup formulir murid"
        onTutup={tutupPanel}
      >
        <form onSubmit={handleSubmit((isi) => simpan.mutate(isi))} noValidate>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="nama-murid">
              Nama
            </label>
            <input id="nama-murid" className="form-control" {...register('nama')} />
            {errors.nama && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.nama)}</p>}
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="email-murid">
              Email
            </label>
            <input id="email-murid" type="email" className="form-control" {...register('email')} />
            {errors.email && (
              <p className="status-salah small mb-0 mt-1">{teksGalat(errors.email)}</p>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="kelas-murid">
              Kelas
            </label>
            <select id="kelas-murid" className="form-select" {...register('class_id')}>
              <option value="">Pilih kelas…</option>
              {(daftarKelas.data ?? []).map((kelas) => (
                <option key={kelas.id} value={String(kelas.id)}>
                  {kelas.nama}
                </option>
              ))}
            </select>
            {errors.class_id && (
              <p className="status-salah small mb-0 mt-1">{teksGalat(errors.class_id)}</p>
            )}
          </div>

          <div className="row g-2 mb-4">
            <div className="col-6">
              <label className="form-label fw-semibold" htmlFor="nis-murid">
                NIS
              </label>
              <input id="nis-murid" className="form-control" {...register('nis')} />
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold" htmlFor="nisn-murid">
                NISN
              </label>
              <input id="nisn-murid" className="form-control" {...register('nisn')} />
            </div>
          </div>

          <div className="d-flex flex-wrap justify-content-end gap-2">
            <Tombol varian="tepi" onClick={tutupPanel}>
              Batal
            </Tombol>
            <Tombol type="submit" memuat={isSubmitting || simpan.isPending}>
              {idUbah === null ? 'Simpan murid' : 'Simpan perubahan'}
            </Tombol>
          </div>
        </form>
      </PanelForm>

      <DialogKonfirmasi
        buka={muridDihapus !== null}
        judul={`Hapus murid ${muridDihapus?.nama ?? ''}?`}
        labelYa="Hapus murid"
        bahaya
        memuat={hapus.isPending}
        onYa={() => {
          if (muridDihapus !== null) hapus.mutate(muridDihapus.id)
        }}
        onBatal={() => setMuridDihapus(null)}
      >
        Akun murid ini tidak bisa dipakai masuk lagi, dan nilainya tidak lagi muncul di daftar kelas.
        Tindakan ini tidak bisa dibatalkan.
      </DialogKonfirmasi>
    </>
  )
}
