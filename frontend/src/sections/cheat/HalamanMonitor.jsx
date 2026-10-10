/**
 * Live Monitor guru (slice 07).
 *
 * Dua jalur, satu layar:
 * - **polling** selalu jalan (5 detik) — ini yang membuat monitor tidak pernah
 *   kosong walau service Node/Redis mati;
 * - **SSE** dipasang bila ada (tiket sekali pakai); saat itu polling otomatis
 *   melambat supaya tidak dobel lalu lintas.
 *
 * Panel kecurangan hanya menampilkan **catatan**, dan guru yang memutuskan
 * valid atau tidak — tidak ada hukuman otomatis di mana pun.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import HeaderHalaman from '../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../shared/ui/KosongData.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import TabelData from '../../shared/ui/TabelData.jsx'
import { Tombol, TombolTaut } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { IkonCentang, IkonPerisai } from '../../icons.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { RUTE, ruteKuisDetail } from '../../routes.js'
import { urlSse } from '../../shared/api/realtime.js'
import { ambilKejadian, ambilMonitor, terbitkanTiketSse, tinjauKejadian } from './api.js'
import { formatDetikTerakhir, ringkasMonitor } from './ringkasMonitor.js'

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
  const { id } = useParams()
  const idKuis = Number(id)

  const [statusSse, setStatusSse] = useState('mencoba')
  const [saring, setSaring] = useState('')
  const [sedangTinjau, setSedangTinjau] = useState(0)
  const sumberRef = useRef(/** @type {EventSource|null} */ (null))

  const selang = statusSse === 'hidup' ? POLLING_LAMBAT : POLLING_CEPAT

  const monitor = useQuery({
    queryKey: ['monitor', idKuis],
    queryFn: () => ambilMonitor(idKuis),
    enabled: Number.isInteger(idKuis) && idKuis > 0,
    refetchInterval: selang,
  })

  const kejadian = useQuery({
    queryKey: ['kejadian', idKuis, saring],
    queryFn: () => ambilKejadian(idKuis, saring || undefined),
    enabled: Number.isInteger(idKuis) && idKuis > 0,
    refetchInterval: selang,
  })

  // SSC: tiket sekali pakai → EventSource → pembaruan langsung.
  useEffect(() => {
    if (!Number.isInteger(idKuis) || idKuis <= 0) return undefined

    let batal = false
    /** @type {EventSource|null} */
    let sumber = null

    async function sambung() {
      try {
        const tiket = await terbitkanTiketSse(idKuis)
        if (batal) return

        sumber = new EventSource(urlSse('monitor', tiket.tiket))
        sumberRef.current = sumber

        sumber.onopen = () => setStatusSse('hidup')
        sumber.onmessage = () => {
          // Cukup minta data baru; bentuk payload tidak dipercaya klien.
          void monitor.refetch()
          void kejadian.refetch()
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
  }, [idKuis])

  const data = monitor.data

  const tertinggi = useMemo(() => {
    if (data === undefined) return []

    return [...data.murid].sort((a, b) => b.kecurangan.skor_tertinggi - a.kecurangan.skor_tertinggi).slice(0, 3)
  }, [data])

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
    return <Skeleton judul baris={5} label="Memuat Live Monitor…" />
  }

  if (monitor.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Live Monitor belum bisa dibuka">
        <p className="mb-3">Mungkin kuis ini bukan milikmu, atau sesimu sudah berakhir.</p>
        <TombolTaut to={RUTE.kuis} varian="tepi">
          Kembali ke daftar kuis
        </TombolTaut>
      </Banner>
    )
  }

  const lencanaSse =
    statusSse === 'hidup'
      ? { kelas: 'sukses', teks: 'Langsung (SSE)' }
      : statusSse === 'polling'
        ? { kelas: 'lembut', teks: 'Polling 5 detik' }
        : { kelas: 'lembut', teks: 'Menyambung…' }

  return (
    <div>
      <HeaderHalaman
        judul={`${data.kuis.judul} · Live Monitor`}
        jejak="Kuis / Live Monitor"
        deskripsi={`${data.kuis.kelas_nama ?? '—'} · ${data.jumlah_online} dari ${data.murid.length} murid sedang aktif`}
      >
        <span className={`badge-status ${lencanaSse.kelas}`}>{lencanaSse.teks}</span>
        <TombolTaut to={ruteKuisDetail(idKuis)} varian="tepi" ukuran="sedang">
          Detail kuis
        </TombolTaut>
      </HeaderHalaman>

      <div className="d-flex flex-wrap gap-3 mb-4">
        {ringkasMonitor(data.murid).map((satu) => (
          <div key={satu.label} className="kartu-soft px-3 py-2">
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
          Live Monitor akan terisi begitu murid pertama membuka kuis dan mengirim denyut kehadiran.
        </KosongData>
      ) : (
        <div className="kartu-soft p-0 mb-4">
          <TabelData
            label="Progres murid"
            caption="Progres dan kehadiran diperbarui dari aktivitas murid; tab yang disembunyikan tetap dihitung hadir."
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
            ]}
          />
        </div>
      )}

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h2 className="judul-bagian mb-0 me-auto">Catatan untuk ditinjau</h2>
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

                {satu.review_status === 'menunggu' && (
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
      <Link className="taut-sentuh mt-1" to={ruteKuisDetail(idKuis)}>
        Kembali ke detail kuis
      </Link>
    </div>
  )
}
