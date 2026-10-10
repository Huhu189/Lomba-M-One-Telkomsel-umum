/**
 * Halaman tag (slice 03) — tag soal sekaligus tema pemahaman pada laporan.
 * Ditulis ulang mengikuti pola papan desain: kepala halaman bersama, tabel
 * data yang jadi kartu di HP, tombol ikon ber-label, panel formulir samping,
 * dan dialog konfirmasi hapus yang menyebut dampaknya ke soal.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { skemaTagForm } from './validasi.js'
import { ambilTag, buatTag, hapusTag, ubahTag } from './api.js'
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
import { IkonPensil, IkonTambah, IkonTanda, IkonTongSampah } from '../../icons.jsx'

const nilaiAwal = { nama: '', deskripsi: '' }

export default function HalamanTag() {
  const queryClient = useQueryClient()
  const [idUbah, setIdUbah] = useState(/** @type {number|null} */ (null))
  const [panelBuka, setPanelBuka] = useState(false)
  const [tagDihapus, setTagDihapus] = useState(/** @type {import('./api.js').DataTag | null} */ (null))

  const daftarTag = useQuery({ queryKey: ['tag'], queryFn: ambilTag })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(skemaTagForm),
    defaultValues: nilaiAwal,
  })

  const simpan = useMutation({
    mutationFn: async (/** @type {import('./validasi.js').DataTagForm} */ data) => {
      const muatan = { nama: data.nama, deskripsi: data.deskripsi || undefined }
      return idUbah === null ? buatTag(muatan) : ubahTag(idUbah, muatan)
    },
    onSuccess: async () => {
      tampilkanToast('sukses', idUbah === null ? 'Tag ditambahkan.' : 'Tag diperbarui.')
      tutupPanel()
      await queryClient.invalidateQueries({ queryKey: ['tag'] })
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const hapus = useMutation({
    mutationFn: async (/** @type {number} */ id) => hapusTag(id),
    onSuccess: async () => {
      tampilkanToast('info', 'Tag dihapus.')
      setTagDihapus(null)
      await queryClient.invalidateQueries({ queryKey: ['tag'] })
    },
    onError: (galat) => {
      tampilkanToast('salah', pesanGalatApi(galat))
      setTagDihapus(null)
    },
  })

  const data = daftarTag.data ?? []

  function bukaTambah() {
    setIdUbah(null)
    reset(nilaiAwal)
    setPanelBuka(true)
  }

  /** @param {import('./api.js').DataTag} tag */
  function bukaUbah(tag) {
    setIdUbah(tag.id)
    setValue('nama', tag.nama)
    setValue('deskripsi', tag.deskripsi ?? '')
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
        judul="Tag & Tema Pemahaman"
        jejak="Ujian / Tag Soal"
        deskripsi="Satu tag dipakai dua hal: menandai soal di bank soal dan menjadi tema pada laporan pemahaman."
      >
        <Tombol ikon={IkonTambah} onClick={bukaTambah}>
          Tambah tag
        </Tombol>
      </HeaderHalaman>

      {daftarTag.isPending && <Skeleton judul baris={3} label="Memuat tag…" />}

      {daftarTag.isError && (
        <Banner jenis="salah" judul="Gagal memuat tag">
          <p className="mb-2">Periksa koneksi, lalu coba lagi.</p>
          <Tombol varian="tepi" onClick={() => daftarTag.refetch()}>
            Coba lagi
          </Tombol>
        </Banner>
      )}

      {daftarTag.isSuccess && data.length > 0 && (
        <div className="kartu-soft p-0">
          <TabelData
            label="Daftar tag"
            kolom={[
              { kunci: 'nama', judul: 'Nama', sel: (tag) => <strong>{tag.nama}</strong> },
              {
                kunci: 'deskripsi',
                judul: 'Deskripsi',
                sel: (tag) => tag.deskripsi || '—',
              },
              { kunci: 'jumlah_soal', judul: 'Soal', sel: (tag) => `${tag.jumlah_soal ?? 0} soal` },
              {
                kunci: 'aksi',
                judul: 'Aksi',
                aksi: true,
                sel: (tag) => (
                  <div className="aksi-baris">
                    <TombolIkon
                      label={`Ubah tag ${tag.nama}`}
                      ikon={IkonPensil}
                      onClick={() => bukaUbah(tag)}
                    />
                    <TombolIkon
                      label={`Hapus tag ${tag.nama}`}
                      ikon={IkonTongSampah}
                      varian="bahaya"
                      onClick={() => setTagDihapus(tag)}
                    />
                  </div>
                ),
              },
            ]}
            baris={data}
            kunciBaris={(tag) => tag.id}
          />
        </div>
      )}

      {daftarTag.isSuccess && data.length === 0 && (
        <KosongData
          judul="Belum ada tag"
          ikon={IkonTanda}
          aksi={
            <Tombol ikon={IkonTambah} onClick={bukaTambah}>
              Tambah tag
            </Tombol>
          }
        >
          Tag membantu guru melihat tema mana yang masih lemah. Tambahkan satu, contohnya Operasi
          Hitung.
        </KosongData>
      )}

      <PanelForm
        buka={panelBuka}
        judul={idUbah === null ? 'Tambah tag' : 'Ubah tag'}
        labelTutup="Tutup formulir tag"
        onTutup={tutupPanel}
      >
        <form onSubmit={handleSubmit((isi) => simpan.mutate(isi))} noValidate>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="nama-tag">
              Nama tag
            </label>
            <input
              id="nama-tag"
              className="form-control"
              placeholder="Contoh: Operasi Hitung"
              autoComplete="off"
              {...register('nama')}
            />
            {errors.nama && <p className="status-salah small mb-0 mt-1">{teksGalat(errors.nama)}</p>}
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold" htmlFor="deskripsi-tag">
              Deskripsi <span className="teks-lembut fw-normal">(opsional)</span>
            </label>
            <textarea
              id="deskripsi-tag"
              className="form-control"
              rows={3}
              placeholder="Keterangan singkat untuk guru lain."
              {...register('deskripsi')}
            />
            {errors.deskripsi && (
              <p className="status-salah small mb-0 mt-1">{teksGalat(errors.deskripsi)}</p>
            )}
          </div>

          <div className="d-flex flex-wrap justify-content-end gap-2">
            <Tombol varian="tepi" onClick={tutupPanel}>
              Batal
            </Tombol>
            <Tombol type="submit" memuat={isSubmitting || simpan.isPending}>
              {idUbah === null ? 'Simpan tag' : 'Simpan perubahan'}
            </Tombol>
          </div>
        </form>
      </PanelForm>

      <DialogKonfirmasi
        buka={tagDihapus !== null}
        judul={`Hapus tag ${tagDihapus?.nama ?? ''}?`}
        labelYa="Hapus tag"
        bahaya
        memuat={hapus.isPending}
        onYa={() => {
          if (tagDihapus !== null) hapus.mutate(tagDihapus.id)
        }}
        onBatal={() => setTagDihapus(null)}
      >
        {tagDihapus?.jumlah_soal ?? 0} soal memakai tag ini dan akan kehilangan tag tersebut. Soal
        dan hasil ulangannya tetap tersimpan.
      </DialogKonfirmasi>
    </>
  )
}
