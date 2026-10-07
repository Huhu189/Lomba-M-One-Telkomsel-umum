/**
 * Layar avatar murid (slice 08).
 *
 * Murid memasang fotonya sendiri, bisa mengembalikannya ke avatar bawaan
 * (inisial nama), dan bisa melaporkan avatar teman sekelas. Laporan **tidak**
 * menghapus apa pun: gambarnya hanya berhenti tampil untuk murid lain sampai
 * guru meninjaunya — dan pemiliknya tetap melihatnya.
 */
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { useAuthStore } from '../auth/authStore.js'
import { pesanGalatApi } from '../auth/api.js'
import {
  ALASAN_LAPORAN,
  avatarSaya,
  daftarAvatar,
  inisialNama,
  jenisGambarDariMagicBytes,
  kembalikanAvatarBawaan,
  laporAvatar,
  periksaBerkasAvatar,
  terlihatUntukTeman,
  unggahAvatar,
} from './api.js'

export default function HalamanAvatar() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const masukanBerkas = useRef(/** @type {HTMLInputElement|null} */ (null))

  const [galat, setGalat] = useState('')
  const [pesan, setPesan] = useState('')
  const [lapor, setLapor] = useState(/** @type {import('./api.js').DataAvatar|null} */ (null))
  const [alasan, setAlasan] = useState(ALASAN_LAPORAN[0].nilai)
  const [keterangan, setKeterangan] = useState('')

  const saya = useQuery({ queryKey: ['avatar-saya'], queryFn: avatarSaya })
  const daftar = useQuery({ queryKey: ['avatar-daftar'], queryFn: daftarAvatar })

  const unggah = useMutation({
    mutationFn: unggahAvatar,
    onSuccess: () => {
      setGalat('')
      setPesan('Avatar baru tersimpan. Server yang mengecilkan gambarnya.')
      void queryClient.invalidateQueries({ queryKey: ['avatar-saya'] })
      void queryClient.invalidateQueries({ queryKey: ['avatar-daftar'] })
    },
    onError: (error) => {
      setPesan('')
      setGalat(pesanGalatApi(error))
    },
  })

  const bawaan = useMutation({
    mutationFn: kembalikanAvatarBawaan,
    onSuccess: (hasil) => {
      setGalat('')
      setPesan(hasil.message)
      void queryClient.invalidateQueries({ queryKey: ['avatar-saya'] })
      void queryClient.invalidateQueries({ queryKey: ['avatar-daftar'] })
    },
    onError: (error) => {
      setPesan('')
      setGalat(pesanGalatApi(error))
    },
  })

  const laporkan = useMutation({
    mutationFn: () =>
      laporAvatar(
        /** @type {import('./api.js').DataAvatar} */ (lapor).id,
        alasan,
        keterangan,
      ),
    onSuccess: (hasil) => {
      setGalat('')
      setPesan(hasil.message)
      setLapor(null)
      setKeterangan('')
      void queryClient.invalidateQueries({ queryKey: ['avatar-daftar'] })
    },
    onError: (error) => {
      setPesan('')
      setGalat(pesanGalatApi(error))
    },
  })

  /**
   * Periksa berkas di klien lebih dulu (ukuran + magic bytes) supaya anak tidak
   * menunggu unggahan selesai hanya untuk ditolak. Server tetap memeriksa ulang.
   * @param {File} berkas
   */
  async function pilihBerkas(berkas) {
    setPesan('')
    setGalat('')

    const pesanUkuran = periksaBerkasAvatar(berkas)

    if (pesanUkuran !== null) {
      setGalat(pesanUkuran)
      return
    }

    const isi = new Uint8Array(await berkas.arrayBuffer())

    if (jenisGambarDariMagicBytes(isi) === null) {
      setGalat('Hanya gambar JPEG, PNG, atau WebP. Berkas lain (termasuk SVG) ditolak.')
      if (masukanBerkas.current) masukanBerkas.current.value = ''
      return
    }

    unggah.mutate(berkas)
  }

  const avatar = saya.data?.avatar ?? null
  const teman = (daftar.data?.avatar ?? []).filter(terlihatUntukTeman)

  return (
    <div className="container py-4">
      <h1 className="h4 fw-bold mb-1">Avatar Saya</h1>
      <p className="teks-lembut">
        Pasang foto supaya teman sekelas mengenalimu. Gambar dikecilkan sendiri oleh server, jadi
        ukuran aslinya tidak masalah.
      </p>

      {galat && <Banner jenis="salah">{galat}</Banner>}
      {pesan && <Banner jenis="sukses">{pesan}</Banner>}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <section className="kartu-soal p-3">
            <h2 className="h6 fw-bold mb-3">Foto saya</h2>

            <div className="d-flex align-items-center gap-3 mb-3">
              {avatar?.url ? (
                <img
                  src={avatar.url}
                  alt="Avatar saya"
                  width={96}
                  height={96}
                  className="rounded-4 border"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <span
                  className="d-inline-flex align-items-center justify-content-center rounded-4 border fw-bold"
                  style={{ width: 96, height: 96, fontSize: 32 }}
                  aria-hidden="true"
                >
                  {inisialNama(user?.name)}
                </span>
              )}
              <div className="small">
                {avatar === null && <p className="mb-0">Kamu masih memakai avatar bawaan (inisial nama).</p>}
                {avatar !== null && avatar.status === 'disembunyikan' && (
                  <p className="mb-0">
                    Foto ini sementara hanya kamu yang bisa lihat sampai guru selesai meninjau
                    laporan teman.
                  </p>
                )}
                {avatar !== null && avatar.status === 'aktif' && (
                  <p className="mb-0">
                    Aktif · {avatar.lebar}×{avatar.tinggi} px · {avatar.ukuran_manusia}
                  </p>
                )}
              </div>
            </div>

            <input
              ref={masukanBerkas}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="form-control mb-2"
              aria-label="Pilih gambar avatar"
              onChange={(peristiwa) => {
                const berkas = peristiwa.target.files?.[0]
                if (berkas) void pilihBerkas(berkas)
              }}
            />

            <div className="d-flex flex-wrap gap-2">
              <Tombol
                varian="tepi"
                memuat={bawaan.isPending}
                disabled={avatar === null}
                onClick={() => bawaan.mutate()}
              >
                Kembalikan ke bawaan
              </Tombol>
            </div>
            {unggah.isPending && <p className="small teks-lembut mt-2 mb-0">Mengunggah gambar…</p>}
          </section>
        </div>

        <div className="col-12 col-lg-7">
          <section className="kartu-soal p-3">
            <h2 className="h6 fw-bold mb-1">Avatar teman sekelas</h2>
            <p className="small teks-lembut">
              Bila ada gambar yang tidak pantas atau menyinggung, lapor ke guru. Gambarnya langsung
              disembunyikan sampai guru meninjau.
            </p>

            {daftar.isLoading && <p className="teks-lembut mb-0">Memuat…</p>}
            {!daftar.isLoading && teman.length === 0 && (
              <p className="teks-lembut mb-0">Belum ada teman sekelas yang memasang foto.</p>
            )}

            <ul className="list-unstyled mb-0">
              {teman.map((satu) => (
                <li key={satu.id} className="d-flex align-items-center gap-3 py-2 border-bottom">
                  {satu.url ? (
                    <img
                      src={satu.url}
                      alt={`Avatar ${satu.nama_murid ?? 'murid'}`}
                      width={48}
                      height={48}
                      className="rounded-3 border"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <span
                      className="d-inline-flex align-items-center justify-content-center rounded-3 border fw-semibold"
                      style={{ width: 48, height: 48 }}
                      aria-hidden="true"
                    >
                      {inisialNama(satu.nama_murid)}
                    </span>
                  )}
                  <span className="small flex-grow-1">{satu.nama_murid ?? 'Murid'}</span>
                  <Tombol
                    varian="tepi"
                    disabled={!satu.boleh_lapor}
                    onClick={() => {
                      setLapor(satu)
                      setKeterangan('')
                      setPesan('')
                    }}
                  >
                    Lapor
                  </Tombol>
                </li>
              ))}
            </ul>

            {lapor !== null && (
              <div className="border rounded-3 p-3 mt-3">
                <h3 className="h6 fw-bold mb-2">Laporkan avatar {lapor.nama_murid ?? 'murid'}</h3>

                <label className="form-label small" htmlFor="alasan-laporan">
                  Alasan
                </label>
                <select
                  id="alasan-laporan"
                  className="form-select mb-2"
                  value={alasan}
                  onChange={(peristiwa) => setAlasan(peristiwa.target.value)}
                >
                  {ALASAN_LAPORAN.map((satu) => (
                    <option key={satu.nilai} value={satu.nilai}>
                      {satu.label}
                    </option>
                  ))}
                </select>

                <label className="form-label small" htmlFor="keterangan-laporan">
                  Keterangan (boleh dikosongkan)
                </label>
                <textarea
                  id="keterangan-laporan"
                  className="form-control mb-2"
                  rows={2}
                  maxLength={300}
                  value={keterangan}
                  onChange={(peristiwa) => setKeterangan(peristiwa.target.value)}
                />

                <div className="d-flex gap-2">
                  <Tombol memuat={laporkan.isPending} onClick={() => laporkan.mutate()}>
                    Kirim laporan
                  </Tombol>
                  <Tombol varian="teks" onClick={() => setLapor(null)}>
                    Batal
                  </Tombol>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
