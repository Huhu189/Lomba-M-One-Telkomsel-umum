/**
 * Halaman Murid (slice 02) mengikuti pola papan desain: kepala halaman bersama
 * dengan tombol impor/ekspor CSV di kanan, saringan kelas, kotak pencarian,
 * tabel data yang berubah jadi kartu di HP (kolom aksi tetap terlihat), panel
 * formulir samping, dialog konfirmasi hapus, serta keadaan memuat/kosong/galat
 * yang utuh.
 *
 * Kotak pencarian menyaring di SERVER (`filter[cari]`, dicari ke seluruh
 * halaman) — bukan menyaring tabel yang sedang tampil. Menyaring di klien hanya
 * akan mencari di 50 baris halaman ini, jadi murid ke-51 yang dicari guru tetap
 * "tidak ada" padahal ada; itu yang membuat fitur cari terasa rusak.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaMuridForm } from '../validasi.js'
import { potongUntukSorot } from '../penyorotan.js'
import {
  URL_EKSPOR_MURID,
  ambilKelas,
  ambilMurid,
  buatMurid,
  ubahMurid,
  hapusMurid,
} from '../api.js'
import { galatKolom, pesanGalatApi, teksGalat } from '../../auth/api.js'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'
import Banner from '../../../shared/ui/Banner.jsx'
import DialogKonfirmasi from '../../../shared/ui/DialogKonfirmasi.jsx'
import { useHanyaMelihat } from '../../../shared/akses.js'
import CatatanHanyaMelihat from '../../../shared/ui/CatatanHanyaMelihat.jsx'
import HeaderHalaman from '../../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../../shared/ui/KosongData.jsx'
import PanelForm from '../../../shared/ui/PanelForm.jsx'
import Skeleton from '../../../shared/ui/Skeleton.jsx'
import TabelData from '../../../shared/ui/TabelData.jsx'
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import { TombolIkon } from '../../../shared/ui/Tombol.jsx'
import { RUTE } from '../../../routes.js'
import {
  IkonCari,
  IkonPengguna,
  IkonPensil,
  IkonSilang,
  IkonTambah,
  IkonTongSampah,
} from '../../../icons.jsx'

const nilaiAwal = { nama: '', email: '', class_id: '', nis: '', nisn: '' }

/**
 * Jeda sebelum kata kunci dikirim ke server (ms).
 *
 * Tanpa jeda ini, mengetik "rina" menembak empat permintaan (r, ri, rin, rina)
 * dan hasil ketikan pertama bisa tiba SESUDAH yang terakhir — tabel berhenti di
 * hasil yang salah. 300 ms cukup pendek untuk terasa langsung, cukup panjang
 * untuk menggabungkan satu ketikan cepat.
 */
const JEDA_CARI_MS = 300

/**
 * Sorot bagian teks yang cocok dengan kata kunci pencarian.
 *
 * Tanpa ini daftar hanya menampilkan baris yang cocok tanpa menunjukkan bagian
 * mana yang membuatnya cocok — guru yang mencari "rina" harus menebak sendiri
 * di bagian mana namanya tercocokkan.
 *
 * @param {{ teks: string, kata: string }} props
 */
function Sorot({ teks, kata }) {
  const bagian = potongUntukSorot(teks, kata)

  return (
    <>
      {bagian.map((satu, indeks) =>
        satu.cocok ? (
          <mark key={indeks}>{satu.teks}</mark>
        ) : (
          <span key={indeks}>{satu.teks}</span>
        ),
      )}
    </>
  )
}

export default function HalamanMurid() {
  const queryClient = useQueryClient()
  // Kepala sekolah boleh menelusuri dan mengunduh daftar murid, tetapi tidak
  // menambah, mengimpor, mengubah, atau menghapusnya (server menolak 403).
  const hanyaLihat = useHanyaMelihat()
  const [filterKelas, setFilterKelas] = useState('')
  const [cari, setCari] = useState('')
  const [cariDipakai, setCariDipakai] = useState('')
  const [halaman, setHalaman] = useState(1)
  const [idUbah, setIdUbah] = useState(/** @type {number | null} */ (null))
  const [panelBuka, setPanelBuka] = useState(false)
  const [muridDihapus, setMuridDihapus] = useState(
    /** @type {import('../api.js').DataMurid | null} */ (null),
  )

  const kelasId = filterKelas ? Number(filterKelas) : null
  const daftarKelas = useQuery({ queryKey: ['kelas'], queryFn: ambilKelas })

  // Ketikan baru dipakai 300 ms sesudah ketikan terakhir (lihat JEDA_CARI_MS).
  useEffect(() => {
    const jeda = window.setTimeout(() => setCariDipakai(cari.trim()), JEDA_CARI_MS)
    return () => window.clearTimeout(jeda)
  }, [cari])

  /**
   * Mengetik (atau membersihkan) kotak cari selalu mengembalikan daftar ke
   * halaman 1 — dikerjakan di sini, bukan di effect, supaya kata kunci baru
   * tidak mendarat di halaman 3 dan menampilkan "tidak ada" padahal muridnya
   * ada di halaman 1.
   * @param {string} nilai
   */
  function ubahCari(nilai) {
    setCari(nilai)
    setHalaman(1)
  }

  const daftarMurid = useQuery({
    queryKey: ['murid', kelasId, halaman, cariDipakai],
    queryFn: () => ambilMurid(kelasId, halaman, cariDipakai),
    // Hasil lama tetap tampil selama pencarian baru berjalan; tanpa ini tabel
    // berkedip jadi kerangka di tiap ketikan.
    placeholderData: keepPreviousData,
  })

  const meta = daftarMurid.data?.meta
  const barisMurid = daftarMurid.data?.data ?? []

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaMuridForm),
    defaultValues: nilaiAwal,
  })

  const simpan = useMutation({
    mutationFn: async (/** @type {import('../validasi.js').DataMuridForm} */ data) => {
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
    onError: (galat) => {
      // Sebab per kolom ditampilkan di bawah isiannya. "Email sudah dipakai" dan
      // "NIS sudah dipakai" adalah galat yang paling sering muncul saat guru
      // menambah murid, dan toast sendirian membuat guru menebak kolom mana yang
      // harus diganti — sama seperti halaman Kelas & Mapel.
      const kolom = galatKolom(galat)

      clearErrors()
      if (kolom.nama) setError('nama', { message: kolom.nama })
      if (kolom.email) setError('email', { message: kolom.email })
      if (kolom.class_id) setError('class_id', { message: kolom.class_id })
      if (kolom.nis) setError('nis', { message: kolom.nis })
      if (kolom.nisn) setError('nisn', { message: kolom.nisn })

      tampilkanToast('salah', pesanGalatApi(galat))
    },
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

  /** @param {import('../api.js').DataMurid} murid */
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
          meta
            ? `Menampilkan ${barisMurid.length} dari ${meta.total} murid${
                cariDipakai === '' ? '' : ` untuk “${cariDipakai}”`
              }${daftarMurid.isFetching ? ' — mencari…' : ''}`
            : 'Memuat data murid…'
        }
      >
        {/** Menambah dan mengimpor murid ditolak server untuk kepala sekolah. */}
        {!hanyaLihat && (
          <>
            <Link className="btn btn-tepi" to={RUTE.imporMurid}>
              Impor CSV
            </Link>
            <Tombol ikon={IkonTambah} onClick={bukaTambah}>
              Tambah murid
            </Tombol>
          </>
        )}
        {/** Mengunduh daftar tetap boleh: itu membaca, bukan mengubah. */}
        <a className="btn btn-tepi" href={URL_EKSPOR_MURID}>
          Ekspor CSV
        </a>
      </HeaderHalaman>

      <CatatanHanyaMelihat />

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-5 col-lg-4">
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

        <div className="col-12 col-md-7 col-lg-5">
          <label className="form-label fw-semibold" htmlFor="cari-murid">
            Cari murid
          </label>
          <div className="d-flex gap-2">
            <input
              id="cari-murid"
              type="search"
              className="form-control"
              placeholder="Nama, NIS, NISN, atau email"
              value={cari}
              onChange={(e) => ubahCari(e.target.value)}
            />
            {cari !== '' && (
              <TombolIkon
                label="Bersihkan pencarian"
                ikon={IkonSilang}
                varian="tepi"
                onClick={() => ubahCari('')}
              />
            )}
          </div>
          <p className="teks-lembut small mb-0 mt-1">
            Dicari ke seluruh halaman, bukan hanya yang tampil di sini.
          </p>
        </div>
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
              {
                kunci: 'nis',
                judul: 'NIS',
                sel: (murid) =>
                  murid.nis ? <Sorot teks={murid.nis} kata={cariDipakai} /> : '—',
              },
              {
                kunci: 'nama',
                judul: 'Nama',
                sel: (murid) => (
                  <>
                    <strong className="d-block">
                      <Sorot teks={murid.nama} kata={cariDipakai} />
                    </strong>
                    <span className="teks-lembut small">
                      <Sorot teks={murid.email} kata={cariDipakai} />
                    </span>
                  </>
                ),
              },
              { kunci: 'kelas_nama', judul: 'Kelas', sel: (murid) => murid.kelas_nama || '—' },
              ...(hanyaLihat
                ? []
                : [
                    {
                      kunci: 'aksi',
                      judul: 'Aksi',
                      aksi: true,
                      sel: (/** @type {import('../api.js').DataMurid} */ murid) => (
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
                  ]),
            ]}
            baris={barisMurid}
            kunciBaris={(murid) => murid.id}
          />
        </div>
      )}

      {daftarMurid.isSuccess && barisMurid.length === 0 && cariDipakai !== '' && (
        <KosongData
          judul={`Tidak ada murid yang cocok dengan “${cariDipakai}”`}
          ikon={IkonCari}
          aksi={
            <Tombol varian="tepi" onClick={() => ubahCari('')}>
              Bersihkan pencarian
            </Tombol>
          }
        >
          Coba nama depan, NIS, NISN, atau email. Pencarian berlaku ke seluruh daftar, jadi murid di
          halaman lain pun ikut ditemukan.
        </KosongData>
      )}

      {daftarMurid.isSuccess && barisMurid.length === 0 && cariDipakai === '' && (
        <KosongData
          judul="Belum ada murid pada saringan ini"
          ikon={IkonPengguna}
          aksi={
            hanyaLihat ? undefined : (
              <Tombol ikon={IkonTambah} onClick={bukaTambah}>
                Tambah murid
              </Tombol>
            )
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
