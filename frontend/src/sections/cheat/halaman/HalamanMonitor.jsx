/**
 * Monitor Ulangan guru (slice 07; sebelumnya "Live Monitor").
 *
 * Dua jalur, satu layar:
 * - **polling** selalu jalan (5 detik) — ini yang membuat monitor tidak pernah
 *   kosong walau service Node/Redis mati;
 * - **SSE** dipasang bila ada (tiket sekali pakai); saat itu polling otomatis
 *   melambat supaya tidak dobel lalu lintas.
 *
 * Panel kecurangan hanya menampilkan **catatan**, dan guru yang memutuskan
 * valid atau tidak — tidak ada hukuman otomatis di mana pun.
 *
 * Sejak 15 Oktober 2026 tiap baris murid punya tombol **Lihat jawaban**: panel di
 * bawah tabel menampilkan apa yang sudah ditulis anak itu per soal, dan ikut
 * disegarkan bersama monitor. Jadi guru tidak lagi harus berjalan ke meja anak
 * (atau menunggu ulangannya dikumpulkan) untuk tahu di mana ia berhenti.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useHanyaMelihat } from '../../../shared/akses.js'
import Banner from '../../../shared/ui/Banner.jsx'
import CatatanHanyaMelihat from '../../../shared/ui/CatatanHanyaMelihat.jsx'
import HeaderHalaman from '../../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../../shared/ui/KosongData.jsx'
import Skeleton from '../../../shared/ui/Skeleton.jsx'
import TabelData from '../../../shared/ui/TabelData.jsx'
import { Tombol, TombolTaut } from '../../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'
import { IkonCentang, IkonPerisai } from '../../../icons.jsx'
import { pesanGalatApi } from '../../auth/api.js'
import { RUTE, kunciKuisSah, ruteKuisDetail } from '../../../routes.js'
import { urlSse } from '../../../shared/api/realtime.js'
import {
  ambilJawabanMurid,
  ambilKejadian,
  ambilMonitor,
  terbitkanTiketSse,
  tinjauKejadian,
} from '../api.js'
import LembarJawaban from '../komponen/LembarJawaban.jsx'
import { formatDetikTerakhir, ringkasMonitor } from '../ringkasMonitor.js'

/** Selang polling saat SSE tidak tersedia (ms). */
const POLLING_CEPAT = 5000
/** Selang polling saat SSE hidup — cukup sebagai jaring pengaman (ms). */
const POLLING_LAMBAT = 20000

/**
 * Tingkat risiko → badge, supaya guru bisa memilah tanpa membaca angka.
 * @param {number} skor
 */
function tingkatRisiko(skor) {
  if (skor >= 8) return { kelas: 'salah', label: 'Perlu ditanya' }
  if (skor >= 6) return { kelas: 'peringatan', label: 'Perhatikan' }
  return { kelas: 'lembut', label: 'Catatan' }
}

export default function HalamanMonitor() {
  /**
   * Kepala sekolah membaca catatan kecurangan, tetapi meninjau (menandai valid
   * atau tidak) adalah keputusan atas bukti — itu milik guru pemilik kuis, dan
   * `KejadianKecuranganPolicy::tinjau` memang menolaknya.
   */
  const hanyaLihat = useHanyaMelihat()
  const { slug } = useParams()
  const kunci = kunciKuisSah(slug)

  const [statusSse, setStatusSse] = useState('mencoba')
  const [saring, setSaring] = useState('')
  const [sedangTinjau, setSedangTinjau] = useState(0)
  /** Attempt yang lembar jawabannya sedang dibuka (0 = tidak ada). */
  const [muridDibuka, setMuridDibuka] = useState(0)
  /** Nama dari baris yang diklik — dipakai selagi lembar jawabannya masih dimuat. */
  const [namaDibuka, setNamaDibuka] = useState('')
  const sumberRef = useRef(/** @type {EventSource|null} */ (null))
  const panelRef = useRef(/** @type {HTMLDivElement|null} */ (null))

  const selang = statusSse === 'hidup' ? POLLING_LAMBAT : POLLING_CEPAT

  const monitor = useQuery({
    queryKey: ['monitor', kunci],
    queryFn: () => ambilMonitor(kunci),
    enabled: kunci !== '',
    refetchInterval: selang,
  })

  const kejadian = useQuery({
    queryKey: ['kejadian', kunci, saring],
    queryFn: () => ambilKejadian(kunci, saring || undefined),
    enabled: kunci !== '',
    refetchInterval: selang,
  })

  /**
   * Lembar jawaban murid yang sedang dibuka.
   *
   * Hanya diminta saat ada murid yang dibuka (`muridDibuka > 0`): memuat lembar
   * seluruh kelas sekaligus berarti menambah lalu lintas untuk data yang mungkin
   * tidak pernah dibaca guru. Iramanya mengikuti monitor, jadi jawaban yang baru
   * masuk muncul di panel tanpa guru menekan apa pun.
   */
  const lembar = useQuery({
    queryKey: ['monitor-jawaban', kunci, muridDibuka],
    queryFn: () => ambilJawabanMurid(kunci, muridDibuka),
    enabled: kunci !== '' && muridDibuka > 0,
    refetchInterval: selang,
  })

  // SSC: tiket sekali pakai → EventSource → pembaruan langsung.
  useEffect(() => {
    if (kunci === '') return undefined

    let batal = false
    /** @type {EventSource|null} */
    let sumber = null

    async function sambung() {
      try {
        const tiket = await terbitkanTiketSse(kunci)
        if (batal) return

        sumber = new EventSource(urlSse('monitor', tiket.tiket))
        sumberRef.current = sumber

        sumber.onopen = () => setStatusSse('hidup')
        sumber.onmessage = () => {
          // Cukup minta data baru; bentuk payload tidak dipercaya klien.
          void monitor.refetch()
          void kejadian.refetch()
          // Lembar jawaban ikut segar — kalau panelnya sedang terbuka, jawaban
          // yang baru disimpan murid muncul tanpa menunggu putaran polling.
          void lembar.refetch()
        }
        sumber.onerror = () => {
          // Fail-open: tanpa SSE, polling sudah menutupi.
          setStatusSse('polling')
          sumber?.close()
          sumberRef.current = null
        }
      } catch {
        setStatusSse('polling')
      }
    }

    void sambung()

    return () => {
      batal = true
      sumber?.close()
      sumberRef.current = null
    }
    // `monitor`/`kejadian` sengaja tidak jadi dependensi: menyambung ulang pada
    // setiap refetch akan membuat tiket baru terus-menerus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci])

  const data = monitor.data

  // Membuka panel di bawah tabel: kalau tanpa ini, guru yang mengklik baris
  // teratas tidak melihat apa pun berubah karena panelnya tumbuh di luar layar.
  useEffect(() => {
    if (muridDibuka === 0) return

    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [muridDibuka])

  const tertinggi = useMemo(() => {
    if (data === undefined) return []

    return [...data.murid].sort((a, b) => b.kecurangan.skor_tertinggi - a.kecurangan.skor_tertinggi).slice(0, 3)
  }, [data])

  /**
   * Buka lembar jawaban satu murid; menekan tombol yang sama lagi menutupnya.
   *
   * @param {{ attempt_id: number, nama: string|null }} baris
   */
  function bukaJawaban(baris) {
    setNamaDibuka(baris.nama ?? 'Murid')
    setMuridDibuka((lama) => (lama === baris.attempt_id ? 0 : baris.attempt_id))
  }

  /**
   * @param {number} kejadianId
   * @param {'valid'|'tidak_valid'} status
   */
  async function tinjau(kejadianId, status) {
    setSedangTinjau(kejadianId)

    try {
      await tinjauKejadian(kejadianId, status)
      tampilkanToast('sukses', status === 'valid' ? 'Catatan ditandai valid.' : 'Catatan ditandai tidak valid.')
      await kejadian.refetch()
      await monitor.refetch()
    } catch (galat) {
      tampilkanToast('salah', pesanGalatApi(galat))
    } finally {
      setSedangTinjau(0)
    }
  }

  if (monitor.isLoading) {
    return <Skeleton judul baris={5} label="Memuat Monitor Ulangan…" />
  }

  if (monitor.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Monitor Ulangan belum bisa dibuka">
        <p className="mb-3">Mungkin kuis ini bukan milikmu, atau sesimu sudah berakhir.</p>
        <TombolTaut to={RUTE.kuis} varian="tepi">
          Kembali ke daftar kuis
        </TombolTaut>
      </Banner>
    )
  }

  return (
    <div>
      <HeaderHalaman
        judul={`${data.kuis.judul} · Monitor Ulangan`}
        jejak="Kuis / Monitor Ulangan"
        deskripsi={`${data.kuis.kelas_nama ?? '—'} · ${data.jumlah_online} dari ${data.murid.length} murid sedang aktif`}
      >
        <TombolTaut to={ruteKuisDetail(kunci)} varian="tepi" ukuran="sedang">
          Detail kuis
        </TombolTaut>
      </HeaderHalaman>

      <div className="d-flex flex-wrap gap-3 mb-4">
        {ringkasMonitor(data.murid).map((satu) => (
          <div key={satu.label} className="kartu-soft p-3">
            <span className="teks-lembut small d-block">{satu.label}</span>
            <strong className="h4 fw-bold mb-0">{satu.nilai}</strong>
          </div>
        ))}
      </div>

      {tertinggi.length > 0 && tertinggi[0].kecurangan.skor_tertinggi > 0 && (
        <Banner jenis="info" judul="Perlu ditanya lebih dulu">
          <p className="mb-0 small">
            {tertinggi
              .filter((baris) => baris.kecurangan.skor_tertinggi > 0)
              .map((baris) => `${baris.nama ?? 'Murid'} (${baris.kecurangan.jumlah} catatan)`)
              .join(', ')}
            . Catatan ini bahan tanya baik-baik, bukan bukti pelanggaran.
          </p>
        </Banner>
      )}

      {data.murid.length === 0 ? (
        <KosongData judul="Belum ada murid yang membuka kuis ini" ikon={IkonPerisai}>
          Monitor Ulangan akan terisi begitu murid pertama membuka kuis dan mengirim denyut kehadiran.
        </KosongData>
      ) : (
        <div className="kartu-soft p-0 mb-4">
          <TabelData
            label="Progres murid"
            caption="Progres dan kehadiran diperbarui dari aktivitas murid; tab yang disembunyikan tetap dihitung hadir. Jawaban tiap murid bisa dibuka langsung dari kolom Jawaban."
            baris={data.murid}
            kunciBaris={(baris) => baris.attempt_id}
            kolom={[
              {
                kunci: 'nama',
                judul: 'Murid',
                sel: (baris) => (
                  <>
                    <strong className="d-block">{baris.nama ?? 'Murid'}</strong>
                    <span className="teks-lembut small">Percobaan ke-{baris.attempt_no}</span>
                  </>
                ),
              },
              {
                kunci: 'online',
                judul: 'Kehadiran',
                sel: (baris) => (
                  <span className={`badge-status ${baris.online ? 'sukses' : 'lembut'}`}>
                    {baris.online ? 'Hadir' : 'Belum aktif'}
                  </span>
                ),
              },
              {
                kunci: 'persen',
                judul: 'Progres',
                kelas: 'kolom-progres',
                sel: (baris) => (
                  <>
                    <div className="progress" style={{ height: '0.6rem' }} role="presentation">
                      <div
                        className="progress-bar"
                        style={{ width: `${baris.persen}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="teks-lembut small">
                      {baris.dijawab} / {baris.jumlah_soal} soal terjawab
                    </span>
                  </>
                ),
              },
              {
                kunci: 'detik_terakhir',
                judul: 'Terakhir aktif',
                sel: (baris) => formatDetikTerakhir(baris.detik_terakhir),
              },
              { kunci: 'status_label', judul: 'Status' },
              {
                kunci: 'kecurangan',
                judul: 'Catatan',
                sel: (baris) =>
                  baris.kecurangan.jumlah === 0 ? (
                    <span className="teks-lembut">—</span>
                  ) : (
                    <span
                      className={`badge-status ${tingkatRisiko(baris.kecurangan.skor_tertinggi).kelas}`}
                    >
                      {baris.kecurangan.jumlah} catatan
                    </span>
                  ),
              },
              {
                kunci: 'jawaban',
                judul: 'Jawaban',
                sel: (baris) => (
                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    aria-expanded={muridDibuka === baris.attempt_id}
                    onClick={() => bukaJawaban(baris)}
                  >
                    {muridDibuka === baris.attempt_id ? 'Sembunyikan' : 'Lihat jawaban'}
                  </Tombol>
                ),
              },
            ]}
          />
        </div>
      )}

      {muridDibuka > 0 && (
        <div ref={panelRef}>
          <LembarJawaban
            nama={lembar.data?.attempt.nama ?? namaDibuka}
            lembar={lembar.data}
            memuat={lembar.isFetching}
            galat={lembar.isError ? lembar.error : undefined}
            onTutup={() => setMuridDibuka(0)}
            onSegarkan={() => void lembar.refetch()}
          />
        </div>
      )}

      {/* Judul dipisah dari baris pil. Saat keduanya satu baris, `me-auto`
          mendorong pil pertama ke tepi kanan begitu barisnya membungkus —
          di layar HP "Semua" jadi menggantung sendiri di kanan. */}
      <h2 className="judul-bagian mb-2">Catatan untuk ditinjau</h2>

      <div
        role="group"
        aria-label="Saring catatan kejadian"
        className="d-flex flex-wrap gap-2 mb-3"
      >
        {/** @type {Array<[''|'menunggu'|'valid'|'tidak_valid', string]>} */ ([
          ['', 'Semua'],
          ['menunggu', 'Belum ditinjau'],
          ['valid', 'Dinilai valid'],
          ['tidak_valid', 'Dinilai tidak valid'],
        ]).map(([nilai, label]) => (
          <button
            key={nilai || 'semua'}
            type="button"
            className="pil-saring"
            aria-pressed={saring === nilai}
            onClick={() => setSaring(nilai)}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="teks-lembut small">
        Catatan adalah bahan tinjauan, bukan vonis. Beberapa deteksi bisa keliru, misalnya alat
        pengembang yang terdeteksi dari ukuran jendela.
      </p>

      <CatatanHanyaMelihat>
        Catatan di bawah dibaca apa adanya. Yang memutuskan sebuah catatan valid atau tidak adalah
        guru pemilik kuis itu.
      </CatatanHanyaMelihat>

      {(kejadian.data ?? []).length === 0 ? (
        <KosongData judul="Tidak ada catatan pada saringan ini" ikon={IkonCentang}>
          Ulangan berjalan tanpa catatan yang perlu ditinjau — itu kabar baik.
        </KosongData>
      ) : (
        <div className="d-flex flex-column gap-2">
          {(kejadian.data ?? []).map((satu) => {
            const risiko = tingkatRisiko(satu.skor_risiko)

            return (
              <div key={satu.id} className="kartu-soft p-3">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <span className="fw-semibold">{satu.nama_murid ?? 'Murid'}</span>
                  <span className={`badge-status ${risiko.kelas}`}>{satu.kategori_label}</span>
                  <span className="teks-lembut small">risiko {satu.skor_risiko}</span>
                  <span className={`badge-status ${satu.review_status === 'menunggu' ? 'info' : 'lembut'} ms-auto`}>
                    {satu.review_status_label}
                  </span>
                </div>

                <p className="teks-lembut small mb-2">
                  Waktu server {satu.created_at ?? '—'}
                  {satu.client_at ? ` · waktu perangkat ${satu.client_at}` : ''}
                  {satu.dari_klien ? '' : ' · dihitung server'}
                </p>

                {satu.review_status === 'menunggu' && !hanyaLihat && (
                  <div className="d-flex gap-2">
                    <Tombol
                      varian="tepi"
                      ukuran="sedang"
                      memuat={sedangTinjau === satu.id}
                      teksMemuat="Menyimpan…"
                      onClick={() => void tinjau(satu.id, 'tidak_valid')}
                    >
                      Tidak valid
                    </Tombol>
                    <Tombol
                      ukuran="sedang"
                      memuat={sedangTinjau === satu.id}
                      teksMemuat="Menyimpan…"
                      onClick={() => void tinjau(satu.id, 'valid')}
                    >
                      Valid
                    </Tombol>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="teks-lembut small mt-3 mb-0">
        Deteksi di perangkat murid bisa diakali; karena itu semua catatan di sini hanya bahan tinjauan.
      </p>
      <Link className="taut-sentuh mt-1" to={ruteKuisDetail(kunci)}>
        Kembali ke detail kuis
      </Link>
    </div>
  )
}
