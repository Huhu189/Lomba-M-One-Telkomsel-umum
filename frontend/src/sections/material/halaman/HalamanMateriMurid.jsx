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
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Banner from '../../../shared/ui/Banner.jsx'
import { RUTE, ruteMateriTautan } from '../../../routes.js'
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import { pesanGalatApi } from '../../auth/api.js'
import KuisSisipan from '../kuis/KuisSisipan.jsx'
import PemutarMateri, { PenjelasanKuis } from '../pemutar/PemutarMateri.jsx'
import PetaPerjalanan from '../perjalanan/PetaPerjalanan.jsx'
import { kenaikanUntuk } from '../perjalanan/perjalanan.js'
import PratinjauDokumen from '../editor/PratinjauDokumen.jsx'
import { sajianBerkas } from '../berkas/sajianBerkas.js'
import { kirimJawaban, kumpulkanAttempt, kunciIdempotensiBaru } from '../../attempt/api.js'
import {
  bolehDibuka,
  bukaBlok,
  materiSaya,
  progresMateri,
  selesaikanBlok,
} from '../api.js'

export default function HalamanMateriMurid() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // Tautan yang dibagikan guru berakhir di `/materi/<id>` (15 Oktober 2026).
  // Id-nya dibaca apa adanya: angka tak masuk akal diabaikan, jadi tautan rusak
  // cukup menampilkan daftar materi — bukan layar galat.
  const { id: idDariTautan } = useParams()
  const idTautan = /^\d+$/.test(String(idDariTautan ?? '')) ? Number(idDariTautan) : null
  const [terpilihId, setTerpilihId] = useState(/** @type {number|null} */ (idTautan))
  const [blokAktif, setBlokAktif] = useState(
    /** @type {import('../api.js').DataIsiBlok|null} */ (null),
  )
  const [attempt, setAttempt] = useState(
    /** @type {import('../../attempt/api.js').DataAttempt|null} */ (null),
  )
  const [jawaban, setJawaban] = useState(/** @type {Record<string, unknown>} */ ({}))
  const [galat, setGalat] = useState('')
  const [hasilLatihan, setHasilLatihan] = useState(
    /** @type {import('../../attempt/api.js').DataHasil|null} */ (null),
  )
  /** Perayaan kenaikan pos/tingkat dari perbandingan peta sebelum & sesudah. */
  const [kenaikan, setKenaikan] = useState(
    /** @type {ReturnType<typeof kenaikanUntuk>} */ (null),
  )
  // Peta sebelum satu langkah ditutup: disimpan saat murid menekan tombol, lalu
  // dibandingkan dengan peta terbaru dari server (bukan dihitung di klien).
  const petaSebelumnya = useRef(
    /** @type {import('../perjalanan/perjalanan.js').DataPerjalanan|null} */ (null),
  )

  const daftar = useQuery({ queryKey: ['materi-saya'], queryFn: materiSaya })
  const progres = useQuery({
    queryKey: ['materi-progres', terpilihId],
    queryFn: () => progresMateri(/** @type {number} */ (terpilihId)),
    enabled: terpilihId !== null,
  })

  /**
   * Pilih satu materi: keadaan lokal **dan** alamat halaman ikut berubah.
   *
   * Alamatnya menjadi `/materi/<id>` supaya yang sedang dibuka murid bisa ia
   * bagikan sendiri (persis tautan yang disentuh tombol salin di editor guru) —
   * dulu pilihannya hanya hidup di memori, jadi alamat di bilah peramban selalu
   * `/materi` dan tidak bisa dibagikan.
   * @param {number} id
   */
  function pilihMateri(id) {
    setTerpilihId(id)
    setBlokAktif(null)
    setAttempt(null)
    setHasilLatihan(null)
    navigate(ruteMateriTautan(id), { replace: true })
  }

  // Pindah materi lewat tautan (mis. guru mengirim tautan lain saat halaman sudah
  // terbuka) TIDAK disinkronkan lewat efek di sini: halaman ini dipasang dengan
  // `key` dari id tautan (lihat `PilihHalamanMateri`), jadi id baru = komponen
  // baru dan keadaan awalnya sudah materi yang benar. Menyinkronkan state di
  // dalam efek justru membuat render berantai (`react-hooks/set-state-in-effect`).

  /** Kembali ke daftar materi — dipakai saat materi dari tautan tidak bisa dibuka. */
  function kembaliKeDaftar() {
    setTerpilihId(null)
    setBlokAktif(null)
    setAttempt(null)
    setHasilLatihan(null)
    navigate(RUTE.materi, { replace: true })
  }

  const buka = useMutation({
    mutationFn: async (/** @type {number} */ blockId) =>
      bukaBlok(/** @type {number} */ (terpilihId), blockId),
    onSuccess: (data) => {
      setGalat('')
      setBlokAktif(data.blok)
      setAttempt(data.attempt)
      setJawaban({})
      setHasilLatihan(null)
      setKenaikan(null)
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
    onError: (error) => {
      petaSebelumnya.current = null
      setGalat(pesanGalatApi(error))
    },
  })

  // Kenaikan diumumkan HANYA setelah server mengirim peta terbaru, jadi pesannya
  // tidak pernah mendahului keadaan yang sebenarnya tersimpan.
  useEffect(() => {
    const baru = progres.data?.perjalanan
    const lama = petaSebelumnya.current

    if (!baru || !lama) return

    const peristiwa = kenaikanUntuk(lama, baru)
    petaSebelumnya.current = null

    if (peristiwa) setKenaikan(peristiwa)
  }, [progres.data])

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

  // Kuis yang tayang di dalam video diputar dari pemutar videonya, bukan bagian sendiri.
  const bagian = (progres.data?.blok ?? []).filter((satu) => satu.host_id == null)
  const nomorBagian = (/** @type {number} */ blockId) =>
    bagian.findIndex((satu) => satu.block_id === blockId) + 1
  const sisaSisipan = blokAktif
    ? (progres.data?.blok ?? []).filter(
        (satu) => satu.host_id === blokAktif.block_id && satu.wajib && satu.status !== 'selesai',
      ).length
    : 0

  // Cara menyajikan media blok yang sedang dibuka (lihat `sajianBerkas`):
  // `semat` tampil di halaman, `dokumen` ditampilkan isinya, `unduh` diunduh,
  // `tautan` hanya bisa dibuka.
  const cara = sajianBerkas(blokAktif?.media ?? null)

  // Blok ini diputar pemutarnya sendiri: berkas video, atau **klip tautan**
  // (YouTube/Drive) yang alamat bingkainya dihitung server (`sematan`).
  // Sisipan kuisnya sudah tersedia di dalam pemutar itu (menumpuk di media),
  // jadi tidak didaftar dua kali di bawah.
  const pakaiPemutar =
    blokAktif?.media?.sematan != null ||
    (blokAktif?.media?.mime?.startsWith('video/') ?? false)

  // Latihan sisipan milik blok yang sedang dibuka. Dulu hanya pemutar video yang
  // bisa membukanya; pada blok teks/gambar latihannya tak pernah terjangkau
  // sehingga murid tidak bisa menutup bagian itu (14 Okt 2026).
  const sisipanBlok = blokAktif
    ? (progres.data?.blok ?? []).filter((satu) => satu.host_id === blokAktif.block_id)
    : []

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
                    onClick={() => pilihMateri(satu.id)}
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

          {/* Tautan bisa menunjuk materi yang belum terbit, bukan untuk kelas murid
              ini, atau sudah diarsipkan. Server yang memutuskan (403/404), jadi
              pesannya disebut apa adanya — bukan layar kosong yang membingungkan. */}
          {terpilihId !== null && progres.isError && (
            <Banner jenis="salah" judul="Materi ini tidak bisa dibuka">
              <p className="mb-2">
                Tautan ini menunjuk materi yang belum diterbitkan untuk kelasmu (atau sudah tidak dipakai
                lagi). Minta gurumu memastikan materinya sudah diterbitkan untuk kelasmu.
              </p>
              <button type="button" className="btn btn-teks p-0" onClick={kembaliKeDaftar}>
                Kembali ke daftar materi
              </button>
            </Banner>
          )}

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

              {kenaikan && (
                <Banner jenis="sukses" judul={kenaikan.judul}>
                  {kenaikan.pesan}
                </Banner>
              )}

              {progres.data.perjalanan.langkah.length > 0 && (
                <div className="mb-3">
                  <PetaPerjalanan perjalanan={progres.data.perjalanan} />
                </div>
              )}

              <ol className="list-unstyled mb-3">
                {bagian.map((satu, indeks) => {
                  const boleh = bolehDibuka(progres.data, satu)
                  const aktif = blokAktif?.block_id === satu.block_id

                  return (
                    <li key={satu.block_id} className="d-flex flex-wrap align-items-center gap-2 py-2 border-bottom">
                      <span className="badge-status lembut">Bagian {indeks + 1}</span>
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
                  <h3 className="h6 fw-bold">
                    Bagian {nomorBagian(blokAktif.block_id) || blokAktif.urutan}: {blokAktif.tipe_label}
                  </h3>

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
                      {/* Klip tautan: sebutkan asalnya di atas pemutarnya supaya murid
                          tahu ini video dari luar, bukan berkas materi. */}
                      {blokAktif.media.tersedia !== false &&
                        blokAktif.media.sumber === 'tautan' && (
                          <p className="small teks-lembut mb-2">
                            {blokAktif.media.kategori_label ?? 'Tautan'} ·{' '}
                            {blokAktif.media.nama ?? 'tautan'}
                          </p>
                        )}

                      {blokAktif.media.tersedia !== false && cara === 'semat' && (
                        <>
                          {blokAktif.media.mime?.startsWith('image/') && (
                            <img
                              src={blokAktif.media.url}
                              alt={blokAktif.media.keterangan || blokAktif.media.nama || 'Materi'}
                              className="img-fluid rounded-3"
                            />
                          )}
                          {/* Berkas video ATAU klip tautan (YouTube/Drive): keduanya
                              diputar pemutar yang sama supaya kuis sisipannya bisa
                              menumpuk di atas media, seperti sisipan di dalam video. */}
                          {pakaiPemutar && progres.data && (
                            <PemutarMateri
                              key={blokAktif.block_id}
                              blok={blokAktif}
                              ringkasan={progres.data}
                              materiId={/** @type {number} */ (terpilihId)}
                            />
                          )}
                          {blokAktif.media.mime?.startsWith('audio/') && (
                            <audio src={blokAktif.media.url} controls className="w-100" />
                          )}
                          {blokAktif.media.mime === 'application/pdf' && (
                            <div>
                              {/* PDF langsung tampil di halaman — tidak perlu unduh dulu. */}
                              <iframe
                                className="materi-dokumen"
                                src={`${blokAktif.media.url}#view=FitH`}
                                title={blokAktif.media.nama || 'Dokumen PDF materi'}
                                loading="lazy"
                              />
                              <a
                                className="taut-sentuh small"
                                href={blokAktif.media.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Buka PDF di tab baru
                              </a>
                            </div>
                          )}
                        </>
                      )}
                      {/* Dokumen kantor (Word/PowerPoint/Excel) dibaca isinya di
                          peramban dan ditampilkan di halaman — murid tidak perlu
                          mengunduh dulu untuk membacanya. */}
                      {blokAktif.media.tersedia !== false && cara === 'dokumen' && (
                        <PratinjauDokumen berkas={blokAktif.media} />
                      )}
                      {blokAktif.media.tersedia !== false && cara === 'unduh' && (
                        <a href={blokAktif.media.url} className="btn btn-tepi" download>
                          Unduh berkas ({blokAktif.media.kategori_label})
                        </a>
                      )}
                      {/* Tautan halaman biasa (bukan YouTube/Drive dan bukan berkas
                          media): tidak bisa disematkan di halaman, tapi tidak boleh
                          hilang tanpa jejak — murid tetap harus bisa membukanya. */}
                      {blokAktif.media.tersedia !== false && cara === 'tautan' && (
                        <div>
                          <a
                            className="btn btn-tepi"
                            href={blokAktif.media.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Buka {blokAktif.media.kategori_label ?? 'tautan'} (
                            {blokAktif.media.nama ?? 'tautan'})
                          </a>
                          <p className="small teks-lembut mb-0 mt-2">
                            Alamat ini tidak bisa ditampilkan di dalam halaman materi; halamannya terbuka
                            di tab baru.
                          </p>
                        </div>
                      )}
                      {blokAktif.media.keterangan && (
                        <p className="small teks-lembut mt-2 mb-0">{blokAktif.media.keterangan}</p>
                      )}
                    </div>
                  )}

                  {blokAktif.tipe === 'kuis' && attempt && (
                    <div className="mb-3">
                      <KuisSisipan
                        attempt={attempt}
                        jawaban={jawaban}
                        onUbahJawaban={(id, nilai) => setJawaban((sebelum) => ({ ...sebelum, [id]: nilai }))}
                        hasil={hasilLatihan}
                        galat={galat}
                        sibuk={kumpulkan.isPending}
                        onKumpulkan={() => kumpulkan.mutate()}
                        materiId={/** @type {number} */ (terpilihId)}
                        blockId={blokAktif.block_id}
                        tampilan={blokAktif.tampilan}
                        judul={blokAktif.kuis?.judul}
                        catatan="Latihan tidak masuk ranking ulangan."
                        penjelasan={
                          hasilLatihan !== null && blokAktif.penjelasan ? (
                            <PenjelasanKuis penjelasan={blokAktif.penjelasan} />
                          ) : undefined
                        }
                        labelLanjut="Tandai bagian ini selesai"
                        sibukLanjut={selesai.isPending}
                        onLanjut={() => {
                          petaSebelumnya.current = progres.data?.perjalanan ?? null
                          selesai.mutate(blokAktif.block_id)
                        }}
                      />
                    </div>
                  )}

                  {/* Latihan sisipan pada blok teks/gambar/PDF: ditampilkan di
                      bawah bacaannya (tidak menumpuk di atas media seperti pada
                      video), karena tidak ada yang sedang diputar. */}
                  {blokAktif.tipe !== 'kuis' && !pakaiPemutar && sisipanBlok.length > 0 && (
                    <div className="mt-3">
                      <p className="small fw-semibold mb-2">Latihan di bagian ini</p>
                      <div className="d-flex flex-wrap gap-2">
                        {sisipanBlok.map((satu) => (
                          <Tombol
                            key={satu.block_id}
                            varian={satu.wajib ? 'utama' : 'tepi'}
                            ukuran="sedang"
                            memuat={buka.isPending}
                            onClick={() => buka.mutate(satu.block_id)}
                          >
                            {satu.status === 'selesai' ? 'Buka ulang' : 'Kerjakan'}: {satu.tipe_label}
                          </Tombol>
                        ))}
                      </div>
                    </div>
                  )}

                  {blokAktif.tipe !== 'kuis' && (
                    <Tombol
                      memuat={selesai.isPending}
                      disabled={sisaSisipan > 0}
                      onClick={() => {
                        petaSebelumnya.current = progres.data?.perjalanan ?? null
                        selesai.mutate(blokAktif.block_id)
                      }}
                    >
                      Tandai bagian ini selesai
                    </Tombol>
                  )}
                  {sisaSisipan > 0 && (
                    <p className="small teks-lembut mt-2 mb-0">
                      Jawab {sisaSisipan} kuis wajib{' '}
                      {pakaiPemutar ? 'di dalam video' : 'di bagian ini'} dulu.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
