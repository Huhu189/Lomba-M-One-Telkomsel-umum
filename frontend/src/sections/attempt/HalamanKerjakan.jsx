/**
 * Layar pengerjaan ulangan (slice 04).
 *
 * Aturan yang dijaga di sini:
 * - soal + urutan datang dari server (sudah diacak per attempt, tanpa kunci);
 * - timer hanya tampilan, dikoreksi `server_now` dari server;
 * - setiap perubahan langsung dicatat ke cadangan lokal, lalu dikirim diam-diam
 *   (autosave) dengan antrean ulang bila jaringan bermasalah;
 * - mengumpulkan memakai kunci idempotensi yang sama untuk attempt ini, jadi
 *   dobel klik atau dua tab tidak menggandakan hasil.
 *
 * Catatan implementasi: jawaban dan sisa waktu DITURUNKAN (bukan disalin ke
 * state lewat effect) supaya tidak ada setState di badan effect.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol, TombolTaut } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import RendererSoal from '../question/render/RendererSoal.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { RUTE, ruteHasil } from '../../routes.js'
import { kirimJawaban, kumpulkanAttempt, kunciIdempotensiBaru, mulaiKuis } from './api.js'
import { formatSisa, sisaDetikAttempt, tingkatWaktu } from './hitungMundur.js'
import { gabungJawaban, useSimpananJawaban } from './simpananJawaban.js'

/** Jeda autosave per perubahan (ms). */
const JEDA_KIRIM = 800
/** Jeda percobaan ulang saat jaringan/5xx (ms). */
const JEDA_ULANG = 5000
/** Ambang peringatan waktu (detik). */
const AMBANG_PERINGATAN = 300

/**
 * Kirim seluruh antrean jawaban; yang gagal karena masalah jaringan
 * dikembalikan ke antrean, yang ditolak permanen (4xx) dibuang + diberitahukan.
 *
 * @param {number} attemptId
 * @param {Map<string, unknown>} antrean
 * @param {(attemptId: number, questionId: number) => void} tandaiTerkirim
 * @returns {Promise<number>} jumlah yang gagal
 */
async function kirimAntrean(attemptId, antrean, tandaiTerkirim) {
  const entri = [...antrean.entries()]
  antrean.clear()
  let gagal = 0

  for (const [questionId, nilai] of entri) {
    const idSoal = Number(questionId)

    try {
      await kirimJawaban(attemptId, idSoal, nilai)
      tandaiTerkirim(attemptId, idSoal)
    } catch (galat) {
      const respons = /** @type {{ status?: number }|undefined} */ (
        /** @type {{ response?: { status?: number } }} */ (galat).response
      )
      const status = respons?.status
      const layakCobaLagi = status === undefined || status === 408 || status === 429 || status >= 500

      if (layakCobaLagi) {
        antrean.set(questionId, nilai)
        gagal += 1
      } else {
        // Server menolak permanen (mis. sudah lewat deadline) — beri tahu murid.
        tampilkanToast('salah', pesanGalatApi(galat))
      }
    }
  }

  return gagal
}

export default function HalamanKerjakan() {
  const { kuisId } = useParams()
  const idKuis = Number(kuisId)
  const navigate = useNavigate()

  const mulainya = useQuery({
    queryKey: ['attempt-mulai', idKuis],
    queryFn: () => mulaiKuis(idKuis),
    enabled: Number.isInteger(idKuis) && idKuis > 0,
    retry: 1,
  })

  const attempt = mulainya.data

  const catat = useSimpananJawaban((s) => s.catat)
  const tandaiTerkirim = useSimpananJawaban((s) => s.tandaiTerkirim)
  const ambilCadangan = useSimpananJawaban((s) => s.ambil)
  const kunciIdempotensi = useSimpananJawaban((s) => s.kunciIdempotensi)
  const bersihkan = useSimpananJawaban((s) => s.bersihkan)

  const [perubahan, setPerubahan] = useState(/** @type {Record<string, unknown>|null} */ (null))
  const [sekarang, setSekarang] = useState(() => Date.now())
  const [sedangKirim, setSedangKirim] = useState(false)
  const [sudahKumpul, setSudahKumpul] = useState(false)

  const antrean = useRef(new Map())
  const timerKirim = useRef(0)
  const timerUlang = useRef(0)
  const sedangKirimRef = useRef(false)
  const peringatanTersiar = useRef(false)
  const jalankanRef = useRef(/** @type {() => Promise<void>} */ (async () => {}))

  // Jawaban = jawaban server + sisa antrean lokal, ditimpa perubahan murid.
  const jawaban = useMemo(() => {
    if (attempt === undefined) return {}

    return perubahan ?? gabungJawaban(attempt.jawaban, ambilCadangan(attempt.id))
  }, [attempt, perubahan, ambilCadangan])

  const detik = attempt === undefined ? 0 : sisaDetikAttempt(attempt, sekarang)

  // Detak 1 detik + peringatan sisa 5 menit (semua efek di dalam callback).
  useEffect(() => {
    if (attempt === undefined) return

    const id = window.setInterval(() => {
      const kini = Date.now()
      setSekarang(kini)

      const sisa = sisaDetikAttempt(attempt, kini)

      if (!peringatanTersiar.current && sisa > 0 && sisa <= AMBANG_PERINGATAN) {
        peringatanTersiar.current = true
        tampilkanToast('info', 'Sisa waktu 5 menit. Periksa jawabanmu.')
      }
    }, 1000)

    return () => window.clearInterval(id)
  }, [attempt])

  const jalankanAntrean = useCallback(async () => {
    if (attempt === undefined) return

    await kirimAntrean(attempt.id, antrean.current, tandaiTerkirim)

    if (antrean.current.size > 0 && timerUlang.current === 0) {
      timerUlang.current = window.setTimeout(() => {
        timerUlang.current = 0
        void jalankanRef.current()
      }, JEDA_ULANG)
    }
  }, [attempt, tandaiTerkirim])

  useEffect(() => {
    jalankanRef.current = jalankanAntrean
  }, [jalankanAntrean])

  const kumpulkan = useCallback(
    async (/** @type {boolean} */ otomatis) => {
      if (attempt === undefined || sedangKirimRef.current) return

      sedangKirimRef.current = true
      setSedangKirim(true)

      if (timerKirim.current !== 0) {
        window.clearTimeout(timerKirim.current)
        timerKirim.current = 0
      }

      try {
        await kirimAntrean(attempt.id, antrean.current, tandaiTerkirim)
        const kunci = kunciIdempotensi(attempt.id, kunciIdempotensiBaru)
        await kumpulkanAttempt(attempt.id, kunci)
        bersihkan(attempt.id)
        setSudahKumpul(true)
        tampilkanToast('sukses', otomatis ? 'Waktu habis — jawaban terkumpul otomatis.' : 'Jawaban terkumpul.')
        navigate(ruteHasil(attempt.id), { replace: true })
      } catch (galat) {
        tampilkanToast('salah', pesanGalatApi(galat))
      } finally {
        sedangKirimRef.current = false
        setSedangKirim(false)
      }
    },
    [attempt, bersihkan, kunciIdempotensi, navigate, tandaiTerkirim],
  )

  // Waktu habis → kumpulkan otomatis (server tetap penentu akhir).
  useEffect(() => {
    if (attempt === undefined || attempt.status !== 'berjalan') return
    if (detik > 0 || sudahKumpul || sedangKirim) return

    const id = window.setTimeout(() => {
      void kumpulkan(true)
    }, 0)

    return () => window.clearTimeout(id)
  }, [attempt, detik, sudahKumpul, sedangKirim, kumpulkan])

  // Bersihkan timer saat meninggalkan halaman.
  useEffect(() => {
    return () => {
      if (timerKirim.current !== 0) window.clearTimeout(timerKirim.current)
      if (timerUlang.current !== 0) window.clearTimeout(timerUlang.current)
    }
  }, [])

  /**
   * Simpan jawaban lokal + jadwalkan autosave.
   * @param {number} soalId
   * @param {unknown} nilai
   */
  function ubahJawaban(soalId, nilai) {
    if (attempt === undefined) return

    setPerubahan((lama) => ({ ...(lama ?? jawaban), [String(soalId)]: nilai }))
    catat(attempt.id, soalId, nilai)
    antrean.current.set(String(soalId), nilai)

    if (timerKirim.current === 0) {
      timerKirim.current = window.setTimeout(() => {
        timerKirim.current = 0
        void jalankanRef.current()
      }, JEDA_KIRIM)
    }
  }

  if (mulainya.isLoading) {
    return <p className="text-body-secondary">Menyiapkan ulangan…</p>
  }

  if (mulainya.isError || attempt === undefined) {
    return (
      <Banner jenis="salah" judul="Ulangan belum bisa dibuka">
        <p className="mb-3">
          Mungkin gurumu belum menerbitkan kuis ini, jadwalnya belum mulai, atau sudah berakhir.
        </p>
        <TombolTaut to={RUTE.kuis} varian="tepi">
          Kembali ke daftar ulangan
        </TombolTaut>
      </Banner>
    )
  }

  if (attempt.status !== 'berjalan') {
    return (
      <Banner jenis="info" judul="Ulangan ini sudah dikumpulkan">
        <p className="mb-3">Hasilnya bisa kamu lihat di halaman hasil.</p>
        <TombolTaut to={ruteHasil(attempt.id)}>Lihat hasil</TombolTaut>
      </Banner>
    )
  }

  const waktuHabis = detik === 0
  const terjawab = attempt.soal.filter((satu) => jawaban[String(satu.id)] !== undefined).length
  const tingkat = tingkatWaktu(detik)

  return (
    <div className="row justify-content-center">
      <div className="col-lg-9">
        <div className="kartu-soal p-3 p-md-4 mb-3">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="me-auto">
              <h1 className="h5 fw-bold mb-0">{attempt.judul_kuis ?? 'Ulangan'}</h1>
              <p className="teks-lembut small mb-0">
                {attempt.mapel_nama ?? '—'} · {attempt.kelas_nama ?? '—'} · {attempt.jumlah_soal} soal
              </p>
            </div>
            <div className="text-end">
              <span className="teks-lembut small d-block">Sisa waktu</span>
              <span className={`timer-ulangan ${tingkat}`} role="timer">
                {formatSisa(detik)}
              </span>
            </div>
            <div className="text-end">
              <span className="teks-lembut small d-block">Terjawab</span>
              <span className="h5 fw-bold mb-0">
                {terjawab} / {attempt.soal.length}
              </span>
            </div>
          </div>
        </div>

        {waktuHabis && (
          <Banner jenis="peringatan" judul="Waktu habis">
            <p className="mb-0">Jawabanmu sedang dikumpulkan otomatis.</p>
          </Banner>
        )}

        <div className="d-flex flex-column gap-3 mb-4">
          {attempt.soal.map((soal) => (
            <section key={soal.id} className="kartu-soft p-3 p-md-4" aria-label={`Soal nomor ${soal.nomor}`}>
              <div className="d-flex align-items-baseline gap-2 mb-2">
                <h2 className="h6 fw-bold mb-0">Soal {soal.nomor}</h2>
                <span className="badge-status lembut">{soal.tipe_label}</span>
                <span className="teks-lembut small ms-auto">{soal.skor} poin</span>
              </div>

              <RendererSoal
                tipe={soal.tipe}
                konten={soal.konten}
                nilai={jawaban[String(soal.id)]}
                onUbah={(nilai) => ubahJawaban(soal.id, nilai)}
                dinonaktifkan={waktuHabis}
                nama={`attempt-${attempt.id}-soal-${soal.id}`}
              />
            </section>
          ))}
        </div>

        <div className="kartu-soal p-3 d-flex flex-wrap align-items-center gap-3">
          <span className="teks-lembut small me-auto">
            Jawaban tersimpan otomatis. Tekan kumpulkan bila sudah selesai.
          </span>
          <Tombol
            memuat={sedangKirim}
            teksMemuat="Mengumpulkan…"
            disabled={waktuHabis}
            onClick={() => {
              if (window.confirm('Kumpulkan jawaban sekarang? Kamu tidak bisa mengubahnya lagi.')) {
                void kumpulkan(false)
              }
            }}
          >
            Kumpulkan jawaban
          </Tombol>
        </div>

        <p className="teks-lembut small mt-3 mb-0">
          Keluar dari halaman ini tidak menghapus jawaban. <Link to={RUTE.kuis}>Kembali ke daftar</Link>
        </p>
      </div>
    </div>
  )
}
