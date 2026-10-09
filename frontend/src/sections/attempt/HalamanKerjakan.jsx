/**
 * Layar pengerjaan ulangan (slice 04).
 *
 * Aturan yang dijaga di sini:
 * - soal + urutan datang dari server (sudah diacak per attempt, tanpa kunci);
 * - timer hanya tampilan, dikoreksi `server_now` dari server;
 * - setiap perubahan langsung dicatat ke cadangan lokal, lalu dikirim diam-diam
 *   (autosave) dengan antrean ulang bila jaringan bermasalah;
 * - mengumpulkan memakai kunci idempotensi yang sama untuk attempt ini, jadi
 *   dobel klik atau dua tab tidak menggandakan hasil;
 * - proteksi anti-cheat (slice 07) hanya dipasang bila guru menyalakannya lewat
 *   pengaturan tiga lapis, dan selalu fail-open: proteksi rusak ≠ ulangan rusak.
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
import UnggahLampiran from './UnggahLampiran.jsx'
import PanelLayarMurid from '../presence/PanelLayarMurid.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { RUTE, ruteHasil } from '../../routes.js'
import { kirimJawaban, kirimKejadian, kumpulkanAttempt, kunciIdempotensiBaru, mulaiKuis } from './api.js'
import { formatSisa, offsetAttemptMs, sisaDetikAttempt, tingkatWaktu } from './hitungMundur.js'
import {
  adaSisa,
  ambilUntukKirim,
  buatAntrean,
  buatPengirim,
  catat as catatAntrean,
  kembalikan,
} from './antreanJawaban.js'
import { gabungJawaban, useSimpananJawaban } from './simpananJawaban.js'
import { hitungTerjawab } from './ringkasanJawaban.js'
import { BATAS_PERCOBAAN_AUTO, harusMandek, jedaAutoMs } from './kebijakanKumpulAuto.js'
import { pesanMulaiGagal, retryMulai } from './pesanMulai.js'
import useExamSecurity from '../../security/useExamSecurity.js'
import ModalProteksi from '../../security/ModalProteksi.jsx'
import { adaProteksiAktif } from '../../security/pengaturanProteksi.js'
import usePresence from '../presence/usePresence.js'

/** Jeda autosave per perubahan (ms). */
const JEDA_KIRIM = 800
/** Jeda percobaan ulang saat jaringan/5xx (ms). */
const JEDA_ULANG = 5000
/** Ambang peringatan waktu (detik). */
const AMBANG_PERINGATAN = 300
/** Berapa kali antrean dicoba dikirim sebelum mengumpulkan (jaringan sekolah bisa putus sesaat). */
const PERCOBAAN_SEBELUM_KUMPUL = 3
/** Jeda antar percobaan kirim sebelum mengumpulkan (ms). */
const JEDA_SEBELUM_KUMPUL = 700
/**
 * Status HTTP dari galat (undefined bila galat jaringan — layak dicoba lagi).
 * @param {unknown} galat
 * @returns {number|undefined}
 */
function statusGalat(galat) {
  return /** @type {{ response?: { status?: number } }} */ (galat)?.response?.status
}

/**
 * Tunggu sekian milidetik — dipakai memberi kesempatan jaringan pulih sebelum
 * jawaban dikumpulkan.
 *
 * @param {number} milidetik
 * @returns {Promise<void>}
 */
function tungguMilidetik(milidetik) {
  return new Promise((selesai) => {
    window.setTimeout(selesai, milidetik)
  }).then(() => undefined)
}

/**
 * Kirim seluruh antrean jawaban; yang gagal karena masalah jaringan
 * dikembalikan ke antrean, yang ditolak permanen (4xx) dibuang + diberitahukan.
 *
 * @param {number} attemptId
 * @param {{ entri: Map<string, { nilai: unknown, seq: number }>, urut: number }} antrean
 * @param {(attemptId: number, questionId: number, nilaiTerkirim: unknown) => void} tandaiTerkirim
 * @returns {Promise<number>} jumlah yang gagal
 */
async function kirimAntrean(attemptId, antrean, tandaiTerkirim) {
  const daftar = ambilUntukKirim(antrean)
  let gagal = 0

  for (const { kunci, nilai, seq } of daftar) {
    const idSoal = Number(kunci)

    try {
      await kirimJawaban(attemptId, idSoal, nilai)
      // Sertakan nilai yang benar-benar tersimpan: entri hanya dibuang bila
      // antrean masih memuat nilai itu (Q-03).
      tandaiTerkirim(attemptId, idSoal, nilai)
    } catch (galat) {
      const respons = /** @type {{ status?: number }|undefined} */ (
        /** @type {{ response?: { status?: number } }} */ (galat).response
      )
      const status = respons?.status
      const layakCobaLagi = status === undefined || status === 408 || status === 429 || status >= 500

      if (layakCobaLagi) {
        // Entri dikembalikan hanya bila murid belum mengubah soal ini lagi
        // selagi pengiriman berjalan — kalau tidak, jawaban lama menimpa yang
        // baru dan murid dinilai dari isian yang sudah ia tinggalkan (Q-02).
        kembalikan(antrean, kunci, { nilai, seq })
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
    // Jaringan/5xx dicoba sekali lagi; penolakan permanen (422/403) tidak (U-03).
    retry: retryMulai,
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
  const [sudahSetujuProteksi, setSudahSetujuProteksi] = useState(false)
  const [autoMandek, setAutoMandek] = useState(false)
  const percobaanAuto = useRef(0)

  // Antrean ber-nomor urut (Q-02). Semua pengiriman lewat satu pengirim tunggal
  // `pengirim` supaya autosave tidak berjalan bersamaan dengan "Kumpulkan".
  const antrean = useRef(buatAntrean())
  const pengirim = useRef(buatPengirim())
  const timerKirim = useRef(0)
  const timerUlang = useRef(0)
  const sedangKirimRef = useRef(false)
  const peringatanTersiar = useRef(false)
  const jalankanRef = useRef(/** @type {() => Promise<void>} */ (async () => {}))
  // U-02: kunci fokus-lock bukan sekadar visual — fokus dipindah ke dialog dan
  // dikembalikan saat kunci selesai.
  const overlayKunci = useRef(/** @type {HTMLDivElement|null} */ (null))
  const fokusSebelumKunci = useRef(/** @type {HTMLElement|null} */ (null))

  const berjalan = attempt !== undefined && attempt.status === 'berjalan'

  // Presence hemat data: ping hanya dipakai sebagai penambal celah 15 detik.
  usePresence({ attemptId: attempt?.id ?? 0, aktif: berjalan })

  // Proteksi ulangan: dipasang hanya saat attempt berjalan dan ada saklar menyala.
  const { daftarSaklar, jumlahKejadian, kabur, kunciDetik } = useExamSecurity({
    attemptId: attempt?.id ?? 0,
    proteksi: attempt?.proteksi,
    aktif: berjalan,
    kirim: kirimKejadian,
  })

  const adaProteksi = attempt !== undefined && adaProteksiAktif(attempt.proteksi)

  // U-02: layar sedang dikunci fokus-lock (dihitung sekali di sini supaya efek
  // pengelolaan fokus tidak dijalankan ulang tiap detik).
  const terkunci = kunciDetik > 0

  // Jawaban = jawaban server + sisa antrean lokal, ditimpa perubahan murid.
  const jawaban = useMemo(() => {
    if (attempt === undefined) return {}

    return perubahan ?? gabungJawaban(attempt.jawaban, ambilCadangan(attempt.id))
  }, [attempt, perubahan, ambilCadangan])

  // Q-01: offset jam server dihitung SEKALI per respons — `dataUpdatedAt` adalah
  // jam klien saat data benar-benar tiba. Menghitungnya ulang dengan Date.now()
  // yang berjalan membuat `sekarangMs` saling meniadakan dan timer membeku.
  const offsetMs = useMemo(
    () => (attempt === undefined ? 0 : offsetAttemptMs(attempt, mulainya.dataUpdatedAt)),
    [attempt, mulainya.dataUpdatedAt],
  )

  const detik = attempt === undefined ? 0 : sisaDetikAttempt(attempt, sekarang, offsetMs)

  // Detak 1 detik + peringatan sisa 5 menit (semua efek di dalam callback).
  useEffect(() => {
    if (attempt === undefined) return

    const id = window.setInterval(() => {
      const kini = Date.now()
      setSekarang(kini)

      const sisa = sisaDetikAttempt(attempt, kini, offsetMs)

      if (!peringatanTersiar.current && sisa > 0 && sisa <= AMBANG_PERINGATAN) {
        peringatanTersiar.current = true
        tampilkanToast('info', 'Sisa waktu 5 menit. Periksa jawabanmu.')
      }
    }, 1000)

    return () => window.clearInterval(id)
  }, [attempt, offsetMs])

  const jalankanAntrean = useCallback(async () => {
    if (attempt === undefined) return

    await pengirim.current(() => kirimAntrean(attempt.id, antrean.current, tandaiTerkirim))

    if (adaSisa(antrean.current) && timerUlang.current === 0) {
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
      if (attempt === undefined || sedangKirimRef.current) return { berhasil: false, permanen: false }

      sedangKirimRef.current = true
      setSedangKirim(true)

      if (timerKirim.current !== 0) {
        window.clearTimeout(timerKirim.current)
        timerKirim.current = 0
      }

      try {
        let sisa = await pengirim.current(() => kirimAntrean(attempt.id, antrean.current, tandaiTerkirim))

        // Kumpul MANUAL: beri jaringan kesempatan pulih dulu. Tanpa ini, jawaban
        // terakhir yang belum terkirim hilang diam-diam — server hanya menilai
        // jawaban yang benar-benar sudah tersimpan.
        if (!otomatis) {
          for (let percobaan = 1; percobaan < PERCOBAAN_SEBELUM_KUMPUL && sisa > 0; percobaan++) {
            await tungguMilidetik(JEDA_SEBELUM_KUMPUL)
            sisa = await pengirim.current(() => kirimAntrean(attempt.id, antrean.current, tandaiTerkirim))
          }

          if (sisa > 0) {
            tampilkanToast(
              'salah',
              'Sebagian jawaban belum tersimpan. Periksa koneksi internet, lalu tekan Kumpulkan lagi.',
            )

            return { berhasil: false, permanen: false }
          }
        }

        const kunci = kunciIdempotensi(attempt.id, kunciIdempotensiBaru)
        await kumpulkanAttempt(attempt.id, kunci)

        // Cadangan lokal hanya dihapus bila seluruh jawaban benar-benar tersimpan
        // (kumpul otomatis saat waktu habis tetap mengirim apa adanya).
        if (sisa === 0) bersihkan(attempt.id)
        setSudahKumpul(true)
        tampilkanToast('sukses', otomatis ? 'Waktu habis — jawaban terkumpul otomatis.' : 'Jawaban terkumpul.')
        navigate(ruteHasil(attempt.id), { replace: true })

        return { berhasil: true, permanen: false }
      } catch (galat) {
        tampilkanToast('salah', pesanGalatApi(galat))

        const status = statusGalat(galat)

        // 4xx = server menolak permanen (mis. attempt sudah dinilai) — mencoba
        // lagi hanya menambah beban tanpa harapan, jadi loop dihentikan (Q-04).
        return { berhasil: false, permanen: status !== undefined && status >= 400 && status < 500 }
      } finally {
        sedangKirimRef.current = false
        setSedangKirim(false)
      }
    },
    [attempt, bersihkan, kunciIdempotensi, navigate, tandaiTerkirim],
  )

  // Waktu habis → kumpulkan otomatis (server tetap penentu akhir). Kegagalan
  // diulang dengan backoff berlipat dan jumlah percobaan terbatas; penolakan
  // permanen (4xx) menghentikan loop seketika, lalu murid diminta menghubungi
  // guru — tanpa ini efek memanggil ulang tanpa henti (Q-04).
  useEffect(() => {
    if (attempt === undefined || attempt.status !== 'berjalan') return
    if (autoMandek || detik > 0 || sudahKumpul || sedangKirim) return

    const percobaan = percobaanAuto.current
    const id = window.setTimeout(() => {
      void (async () => {
        percobaanAuto.current = percobaan + 1

        const hasil = await kumpulkan(true)

        if (harusMandek({ percobaan: percobaan + 1, permanen: hasil.permanen, berhasil: hasil.berhasil })) {
          setAutoMandek(true)
        }
      })()
    }, jedaAutoMs(percobaan))

    return () => window.clearTimeout(id)
  }, [attempt, autoMandek, detik, sudahKumpul, sedangKirim, kumpulkan])

  // Bersihkan timer saat meninggalkan halaman.
  useEffect(() => {
    return () => {
      if (timerKirim.current !== 0) window.clearTimeout(timerKirim.current)
      if (timerUlang.current !== 0) window.clearTimeout(timerUlang.current)
    }
  }, [])

  // U-02: saat layar terkunci, fokus dipindah ke dialog kunci dan dikembalikan
  // setelah kunci selesai. Kontainer soal di-`inert`, jadi Tab, keyboard, dan
  // pembaca layar tidak bisa menembus ke soal di belakang overlay.
  useEffect(() => {
    if (!terkunci) return

    const aktif = document.activeElement
    fokusSebelumKunci.current = aktif instanceof HTMLElement ? aktif : null
    overlayKunci.current?.focus()

    return () => {
      fokusSebelumKunci.current?.focus()
    }
  }, [terkunci])

  /**
   * Simpan jawaban lokal + jadwalkan autosave.
   * @param {number} soalId
   * @param {unknown} nilai
   */
  function ubahJawaban(soalId, nilai) {
    if (attempt === undefined) return

    setPerubahan((lama) => ({ ...(lama ?? jawaban), [String(soalId)]: nilai }))
    catat(attempt.id, soalId, nilai)
    catatAntrean(antrean.current, soalId, nilai)

    if (timerKirim.current === 0) {
      timerKirim.current = window.setTimeout(() => {
        timerKirim.current = 0
        void jalankanRef.current()
      }, JEDA_KIRIM)
    }
  }

  if (mulainya.isLoading) {
    return (
      <p className="text-body-secondary d-flex align-items-center gap-2" aria-busy="true">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        Menyiapkan ulangan…
      </p>
    )
  }

  if (mulainya.isError) {
    // U-03: tampilkan alasan dari server (mis. "Kuis belum dimulai", "Bukan
    // untuk kelasmu", "Batas percobaan habis") dan bedakan galat sementara.
    const galatMulai = pesanMulaiGagal(mulainya.error)

    return (
      <Banner jenis="salah" judul={galatMulai.judul}>
        <p className="mb-3">{galatMulai.pesan}</p>
        <div className="d-flex flex-wrap gap-2">
          {galatMulai.cobaLagi && (
            <Tombol
              memuat={mulainya.isFetching}
              teksMemuat="Mencoba…"
              onClick={() => void mulainya.refetch()}
            >
              Coba lagi
            </Tombol>
          )}
          <TombolTaut to={RUTE.kuis} varian="tepi">
            Kembali ke daftar ulangan
          </TombolTaut>
        </div>
      </Banner>
    )
  }

  if (attempt === undefined) {
    return (
      <p className="text-body-secondary d-flex align-items-center gap-2" aria-busy="true">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        Menyiapkan ulangan…
      </p>
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
  const terjawab = hitungTerjawab(attempt.soal, jawaban)
  const tingkat = tingkatWaktu(detik)
  return (
    <div className="row justify-content-center">
      {adaProteksi && !sudahSetujuProteksi && (
        <ModalProteksi daftar={daftarSaklar} onTutup={() => setSudahSetujuProteksi(true)} />
      )}

      {kabur && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ backdropFilter: 'blur(10px)', zIndex: 1060 }}
          aria-hidden="true"
        />
      )}

      {terkunci && (
        <div
          ref={overlayKunci}
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ background: 'rgba(11, 21, 48, 0.92)', zIndex: 1090 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="judul-kunci-layar"
          tabIndex={-1}
        >
          <div className="text-center" style={{ maxWidth: '26rem' }}>
            <p className="h5 fw-bold text-white mb-2" id="judul-kunci-layar">
              Layar terkunci sementara
            </p>
            <p className="small mb-3 text-white-50">
              Kamu keluar dari jendela ulangan. Ulangan tetap berjalan, dan gurumu akan melihat catatannya.
            </p>
            <p className="display-6 fw-bold text-white mb-0" role="timer">
              {kunciDetik}
            </p>
          </div>
        </div>
      )}

      <div className="col-lg-9" inert={terkunci}>
        <div className="kartu-soal p-3 p-md-4 mb-3">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="me-auto teks-patah">
              <h1 className="h5 fw-bold mb-0 teks-patah">{attempt.judul_kuis ?? 'Ulangan'}</h1>
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
            {adaProteksi && (
              <div className="text-end">
                <span className="teks-lembut small d-block">Pengaman</span>
                <span className="badge-status lembut">
                  aktif{jumlahKejadian > 0 ? ` · ${jumlahKejadian} catatan` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {(attempt.tim ?? null) !== null && (
          <Banner jenis="info" judul={`Mengerjakan sebagai ${attempt.tim?.nama ?? 'tim'}`}>
            <p className="mb-0 teks-patah">
              Jawaban di layar ini dipakai bersama tim: apa pun yang kamu simpan langsung menjadi jawaban tim, dan
              nilainya nanti juga dibagi ke semua anggota.
              {(attempt.tim?.rekan?.length ?? 0) > 0 && (
                <>
                  {' '}
                  Rekan setimmu: {attempt.tim?.rekan?.join(', ')}.
                </>
              )}
            </p>
          </Banner>
        )}

        {waktuHabis && !autoMandek && (
          <Banner jenis="peringatan" judul="Waktu habis">
            <p className="mb-0">Jawabanmu sedang dikumpulkan otomatis.</p>
          </Banner>
        )}

        {autoMandek && (
          <Banner jenis="salah" judul="Jawaban belum terkirim">
            <p className="mb-3">
              Waktu habis, tetapi jawabanmu belum berhasil dikumpulkan setelah {BATAS_PERCOBAAN_AUTO} percobaan.
              Jangan tutup halaman ini — hubungi gurumu, lalu coba kirim lagi.
            </p>
            <Tombol
              memuat={sedangKirim}
              onClick={() => {
                percobaanAuto.current = 0
                setAutoMandek(false)
              }}
            >
              Coba kirim lagi
            </Tombol>
          </Banner>
        )}

        {/* Layar kelas (slice 10): mengikuti guru tanpa memuat ulang halaman. */}
        <PanelLayarMurid kuisId={attempt.quiz_id} />

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

              <UnggahLampiran
                attemptId={attempt.id}
                soalId={soal.id}
                nonaktif={waktuHabis}
                sisaDetik={detik}
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
          Keluar dari halaman ini tidak menghapus jawaban.{' '}
          <Link className="tautan-jari" to={RUTE.kuis}>
            Kembali ke daftar
          </Link>
        </p>
      </div>
    </div>
  )
}
