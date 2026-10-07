/**
 * Layar materi murid (slice 08).
 *
 * Murid menempuh blok satu per satu. Blok wajib yang belum selesai menutup blok
 * berikutnya — dan server tetap penentu akhir, jadi tombol yang dinonaktifkan di
 * sini hanya kesopanan tampilan, bukan pengamanan.
 *
 * Blok kuis memakai attempt latihan yang dibuat server saat blok dibuka: soal
 * ditampilkan dengan renderer yang sama seperti ulangan, jawaban disimpan lewat
 * endpoint attempt yang sama, dan skor latihan hanya masuk laporan tema materi.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { pesanGalatApi } from '../auth/api.js'
import RendererSoal from '../question/render/RendererSoal.jsx'
import { kirimJawaban, kumpulkanAttempt, kunciIdempotensiBaru } from '../attempt/api.js'
import {
  bolehDibuka,
  bukaBlok,
  materiSaya,
  progresMateri,
  selesaikanBlok,
} from './api.js'

export default function HalamanMateriMurid() {
  const queryClient = useQueryClient()
  const [terpilihId, setTerpilihId] = useState(/** @type {number|null} */ (null))
  const [blokAktif, setBlokAktif] = useState(
    /** @type {import('./api.js').DataIsiBlok|null} */ (null),
  )
  const [attempt, setAttempt] = useState(
    /** @type {import('../attempt/api.js').DataAttempt|null} */ (null),
  )
  const [jawaban, setJawaban] = useState(/** @type {Record<string, unknown>} */ ({}))
  const [galat, setGalat] = useState('')
  const [hasilLatihan, setHasilLatihan] = useState(
    /** @type {import('../attempt/api.js').DataHasil|null} */ (null),
  )

  const daftar = useQuery({ queryKey: ['materi-saya'], queryFn: materiSaya })
  const progres = useQuery({
    queryKey: ['materi-progres', terpilihId],
    queryFn: () => progresMateri(/** @type {number} */ (terpilihId)),
    enabled: terpilihId !== null,
  })

  const buka = useMutation({
    mutationFn: async (/** @type {number} */ blockId) =>
      bukaBlok(/** @type {number} */ (terpilihId), blockId),
    onSuccess: (data) => {
      setGalat('')
      setBlokAktif(data.blok)
      setAttempt(data.attempt)
      setJawaban({})
      setHasilLatihan(null)
      void queryClient.invalidateQueries({ queryKey: ['materi-progres', terpilihId] })
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  const selesai = useMutation({
    mutationFn: async (/** @type {number} */ blockId) =>
      selesaikanBlok(/** @type {number} */ (terpilihId), blockId),
    onSuccess: () => {
      setGalat('')
      setBlokAktif(null)
      setAttempt(null)
      setHasilLatihan(null)
      void queryClient.invalidateQueries({ queryKey: ['materi-progres', terpilihId] })
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  const kumpulkan = useMutation({
    mutationFn: async () => {
      const latihan = attempt

      if (latihan === null) {
        throw new Error('Latihan belum dibuka.')
      }

      for (const soal of latihan.soal) {
        const nilai = jawaban[String(soal.id)]
        if (nilai === undefined) continue
        await kirimJawaban(latihan.id, soal.id, nilai)
      }

      return kumpulkanAttempt(latihan.id, kunciIdempotensiBaru())
    },
    onSuccess: (hasil) => {
      setGalat('')
      setHasilLatihan(hasil)
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  return (
    <div className="container py-4">
      <h1 className="h4 fw-bold mb-1">Materi Belajar</h1>
      <p className="teks-lembut">Baca materinya, kerjakan latihan sisipannya, lalu lanjut ke bagian berikutnya.</p>

      {galat && <Banner jenis="salah">{galat}</Banner>}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <section className="kartu-soal p-3">
            <h2 className="h6 fw-bold mb-3">Daftar materi kelasmu</h2>
            {daftar.isLoading && <p className="teks-lembut mb-0">Memuat…</p>}
            {daftar.data?.length === 0 && (
              <p className="teks-lembut mb-0">Guru belum menerbitkan materi untuk kelasmu.</p>
            )}
            <ul className="list-unstyled mb-0">
              {(daftar.data ?? []).map((satu) => (
                <li key={satu.id} className="py-2 border-bottom">
                  <button
                    type="button"
                    className="btn btn-teks text-start w-100"
                    onClick={() => {
                      setTerpilihId(satu.id)
                      setBlokAktif(null)
                      setAttempt(null)
                    }}
                  >
                    <span className="fw-semibold">{satu.judul}</span>
                    <span className="d-block small teks-lembut">
                      {satu.mapel_nama ?? '-'} · {satu.jumlah_blok} bagian
                      {satu.tema_nama ? ` · tema ${satu.tema_nama}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="col-12 col-lg-7">
          {terpilihId === null && <Banner jenis="info">Pilih materi untuk mulai belajar.</Banner>}

          {terpilihId !== null && progres.data && (
            <section className="kartu-soal p-3">
              <h2 className="h6 fw-bold mb-1">{progres.data.materi.judul}</h2>
              <p className="small teks-lembut mb-2">
                {progres.data.selesai_wajib}/{progres.data.jumlah_wajib} bagian wajib selesai ·{' '}
                {progres.data.persen}%
              </p>
              <div className="progress mb-3" role="progressbar" aria-valuenow={progres.data.persen}>
                <div className="progress-bar" style={{ width: `${progres.data.persen}%` }} />
              </div>

              <ol className="list-unstyled mb-3">
                {progres.data.blok.map((satu) => {
                  const boleh = bolehDibuka(progres.data, satu)
                  const aktif = blokAktif?.block_id === satu.block_id

                  return (
                    <li key={satu.block_id} className="d-flex flex-wrap align-items-center gap-2 py-2 border-bottom">
                      <span className="badge-status lembut">Bagian {satu.urutan}</span>
                      <span className="small flex-grow-1">
                        {satu.tipe_label}
                        {satu.wajib ? '' : ' (opsional)'} · {satu.status_label}
                      </span>
                      <Tombol
                        varian="tepi"
                        disabled={!boleh || buka.isPending}
                        onClick={() => buka.mutate(satu.block_id)}
                      >
                        {aktif ? 'Buka ulang' : 'Buka'}
                      </Tombol>
                    </li>
                  )
                })}
              </ol>

              {blokAktif && (
                <div className="border rounded-3 p-3">
                  <h3 className="h6 fw-bold">Bagian {blokAktif.urutan}: {blokAktif.tipe_label}</h3>

                  {blokAktif.tipe === 'teks' && (
                    <p className="mb-3" style={{ whiteSpace: 'pre-wrap' }}>
                      {blokAktif.teks}
                    </p>
                  )}

                  {blokAktif.tipe === 'media' && blokAktif.media && (
                    <div className="mb-3">
                      {blokAktif.media.tersedia === false && (
                        <Banner jenis="peringatan">Berkas ini belum tersedia.</Banner>
                      )}
                      {blokAktif.media.tersedia !== false && blokAktif.media.tampil_langsung && (
                        <>
                          {blokAktif.media.mime?.startsWith('image/') && (
                            <img
                              src={blokAktif.media.url}
                              alt={blokAktif.media.keterangan || blokAktif.media.nama || 'Materi'}
                              className="img-fluid rounded-3"
                            />
                          )}
                          {blokAktif.media.mime?.startsWith('video/') && (
                            <video src={blokAktif.media.url} controls className="w-100 rounded-3" />
                          )}
                          {blokAktif.media.mime?.startsWith('audio/') && (
                            <audio src={blokAktif.media.url} controls className="w-100" />
                          )}
                          {blokAktif.media.mime === 'application/pdf' && (
                            <a href={blokAktif.media.url} target="_blank" rel="noreferrer">
                              Buka dokumen PDF
                            </a>
                          )}
                        </>
                      )}
                      {blokAktif.media.tersedia !== false && !blokAktif.media.tampil_langsung && (
                        <a href={blokAktif.media.url} className="btn btn-tepi" download>
                          Unduh berkas ({blokAktif.media.kategori_label})
                        </a>
                      )}
                      {blokAktif.media.keterangan && (
                        <p className="small teks-lembut mt-2 mb-0">{blokAktif.media.keterangan}</p>
                      )}
                    </div>
                  )}

                  {blokAktif.tipe === 'kuis' && attempt && (
                    <div className="mb-3">
                      <p className="small teks-lembut">
                        {blokAktif.kuis?.judul} · {attempt.soal.length} soal · latihan tidak masuk ranking
                      </p>

                      {attempt.soal.map((soal) => (
                        <div className="mb-3" key={soal.id}>
                          <div className="d-flex align-items-baseline gap-2 mb-2">
                            <strong className="small">Soal {soal.nomor}</strong>
                            <span className="badge-status lembut">{soal.tipe_label}</span>
                          </div>
                          <RendererSoal
                            tipe={soal.tipe}
                            konten={soal.konten}
                            nilai={jawaban[String(soal.id)]}
                            onUbah={(nilai) =>
                              setJawaban((sebelum) => ({ ...sebelum, [String(soal.id)]: nilai }))
                            }
                            dinonaktifkan={hasilLatihan !== null}
                            nama={`latihan-${attempt.id}-soal-${soal.id}`}
                          />
                        </div>
                      ))}

                      {hasilLatihan === null ? (
                        <Tombol memuat={kumpulkan.isPending} onClick={() => kumpulkan.mutate()}>
                          Simpan jawaban & kumpulkan
                        </Tombol>
                      ) : (
                        <Banner jenis="sukses" judul="Latihan selesai">
                          Skor {hasilLatihan.skor} dari {hasilLatihan.skor_maksimal}. Nilai ini masuk
                          laporan tema materi, bukan ranking.
                        </Banner>
                      )}
                    </div>
                  )}

                  <Tombol
                    memuat={selesai.isPending}
                    disabled={blokAktif.tipe === 'kuis' && hasilLatihan === null}
                    onClick={() => selesai.mutate(blokAktif.block_id)}
                  >
                    Tandai bagian ini selesai
                  </Tombol>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
