/**
 * Antrean moderasi avatar untuk guru (slice 08).
 *
 * Guru melihat gambar yang dilaporkan teman sekelas beserta laporannya, lalu
 * memilih **pulihkan** (gambar kembali tampil, laporan ditandai tidak valid) atau
 * **hapus** (berkas dibuang). Kedua keputusan masuk audit, dan tidak ada satu pun
 * tombol di sini yang bisa dipakai murid.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { antreanModerasi, hapusAvatarModerasi, pulihkanAvatar } from './api.js'

export default function HalamanModerasiAvatar() {
  const queryClient = useQueryClient()
  const [galat, setGalat] = useState('')
  const [pesan, setPesan] = useState('')
  const [catatan, setCatatan] = useState(/** @type {Record<number, string>} */ ({}))

  const antrean = useQuery({ queryKey: ['avatar-moderasi'], queryFn: antreanModerasi })

  function segarkan() {
    void queryClient.invalidateQueries({ queryKey: ['avatar-moderasi'] })
  }

  const pulihkan = useMutation({
    mutationFn: (/** @type {number} */ id) => pulihkanAvatar(id, catatan[id] ?? ''),
    onSuccess: () => {
      setGalat('')
      setPesan('Avatar dipulihkan dan kembali tampil.')
      segarkan()
    },
    onError: (error) => {
      setPesan('')
      setGalat(pesanGalatApi(error))
    },
  })

  const hapus = useMutation({
    mutationFn: (/** @type {number} */ id) => hapusAvatarModerasi(id, catatan[id] ?? ''),
    onSuccess: (hasil) => {
      setGalat('')
      setPesan(hasil.message)
      segarkan()
    },
    onError: (error) => {
      setPesan('')
      setGalat(pesanGalatApi(error))
    },
  })

  const daftar = antrean.data ?? []

  return (
    <div className="container py-4">
      <h1 className="h4 fw-bold mb-1">Moderasi Avatar</h1>
      <p className="teks-lembut">
        Avatar yang dilaporkan teman sekelas disembunyikan sampai kamu memutuskan. Laporan teman
        adalah bahan tinjauan, bukan bukti — periksa dulu gambarnya.
      </p>

      {galat && <Banner jenis="salah">{galat}</Banner>}
      {pesan && <Banner jenis="sukses">{pesan}</Banner>}

      {antrean.isLoading && <p className="teks-lembut">Memuat…</p>}

      {!antrean.isLoading && daftar.length === 0 && (
        <Banner jenis="info">Tidak ada avatar yang menunggu tinjauan. Kerja bagus.</Banner>
      )}

      <div className="row g-4">
        {daftar.map((satu) => (
          <div className="col-12 col-xl-6" key={satu.id}>
            <section className="kartu-soal p-3 h-100">
              <div className="d-flex gap-3">
                {satu.url ? (
                  <img
                    src={satu.url}
                    alt={`Avatar ${satu.nama_murid ?? 'murid'}`}
                    width={96}
                    height={96}
                    className="rounded-4 border"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className="teks-lembut" style={{ width: 96 }}>
                    Gambar tidak tersedia
                  </span>
                )}
                <div className="small">
                  <p className="fw-semibold mb-1">{satu.nama_murid ?? 'Murid'}</p>
                  <p className="mb-1 teks-lembut">
                    {satu.kelas_nama ?? '-'} · {satu.jumlah_laporan} laporan
                  </p>
                  <p className="mb-0 teks-lembut">
                    Disembunyikan{' '}
                    {satu.disembunyikan_at ? new Date(satu.disembunyikan_at).toLocaleString('id-ID') : '-'}
                  </p>
                </div>
              </div>

              <ul className="list-unstyled small mt-3 mb-3">
                {(satu.laporan ?? []).map((lapor) => (
                  <li key={lapor.id} className="py-1 border-top">
                    <span className="badge-status lembut me-2">{lapor.alasan_label}</span>
                    {lapor.pelapor_nama ? `dari ${lapor.pelapor_nama}` : 'dari murid'}
                    {lapor.keterangan ? ` — “${lapor.keterangan}”` : ''}
                  </li>
                ))}
              </ul>

              <label className="form-label small" htmlFor={`catatan-${satu.id}`}>
                Catatan keputusan (opsional, masuk audit)
              </label>
              <input
                id={`catatan-${satu.id}`}
                className="form-control mb-2"
                maxLength={300}
                value={catatan[satu.id] ?? ''}
                onChange={(peristiwa) =>
                  setCatatan((sebelum) => ({ ...sebelum, [satu.id]: peristiwa.target.value }))
                }
              />

              <div className="d-flex flex-wrap gap-2">
                <Tombol
                  memuat={pulihkan.isPending}
                  onClick={() => pulihkan.mutate(satu.id)}
                >
                  Pulihkan
                </Tombol>
                <Tombol
                  varian="tepi"
                  memuat={hapus.isPending}
                  onClick={() => hapus.mutate(satu.id)}
                >
                  Hapus avatar
                </Tombol>
              </div>
            </section>
          </div>
        ))}
      </div>
    </div>
  )
}
