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
import { Tombol, TombolTaut } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { RUTE, ruteKuisDetail } from '../../routes.js'
import { ambilKejadian, ambilMonitor, terbitkanTiketSse, tinjauKejadian } from './api.js'

/** Selang polling saat SSE tidak tersedia (ms). */
const POLLING_CEPAT = 5000
/** Selang polling saat SSE hidup — cukup sebagai jaring pengaman (ms). */
const POLLING_LAMBAT = 20000

/** Nama dasar service realtime (bisa ditimpa lewat env Vite). */
const DASAR_REALTIME = import.meta.env.VITE_REALTIME_URL ?? 'http://localhost:4000'

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

        sumber = new EventSource(`${DASAR_REALTIME}/sse/monitor?tiket=${encodeURIComponent(tiket.tiket)}`)
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
    return <p className="text-body-secondary">Memuat Live Monitor…</p>
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
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div className="me-auto">
          <h1 className="h4 fw-bold mb-0">Live Monitor</h1>
          <p className="teks-lembut small mb-0">
            {data.kuis.judul} · {data.kuis.kelas_nama ?? '—'} · {data.jumlah_online} dari {data.murid.length} murid
            sedang aktif
          </p>
        </div>
        <span className={`badge-status ${lencanaSse.kelas}`}>{lencanaSse.teks}</span>
        <TombolTaut to={ruteKuisDetail(idKuis)} varian="tepi" className="btn-sm">
          Detail kuis
        </TombolTaut>
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

      <div className="kartu-soal p-0 mb-4 table-responsive">
        <table className="table align-middle mb-0">
          <caption className="px-3 small teks-lembut">
            Progres dan kehadiran diperbarui dari aktivitas murid; tab yang disembunyikan tetap dihitung hadir.
          </caption>
          <thead>
            <tr>
              <th scope="col">Murid</th>
              <th scope="col">Kehadiran</th>
              <th scope="col">Progres</th>
              <th scope="col">Status</th>
              <th scope="col">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {data.murid.length === 0 && (
              <tr>
                <td colSpan={5} className="teks-lembut">
                  Belum ada murid yang membuka kuis ini.
                </td>
              </tr>
            )}

            {data.murid.map((baris) => (
              <tr key={baris.attempt_id}>
                <td>
                  <span className="fw-semibold">{baris.nama ?? 'Murid'}</span>
                  <span className="teks-lembut small d-block">Percobaan ke-{baris.attempt_no}</span>
                </td>
                <td>
                  <span className={`badge-status ${baris.online ? 'sukses' : 'lembut'}`}>
                    {baris.online ? 'Hadir' : 'Belum aktif'}
                  </span>
                </td>
                <td style={{ minWidth: '9rem' }}>
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
                </td>
                <td className="small">{baris.status_label}</td>
                <td>
                  {baris.kecurangan.jumlah === 0 ? (
                    <span className="teks-lembut small">—</span>
                  ) : (
                    <span className={`badge-status ${tingkatRisiko(baris.kecurangan.skor_tertinggi).kelas}`}>
                      {baris.kecurangan.jumlah} catatan
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h2 className="h6 fw-bold mb-0 me-auto">Catatan kejadian</h2>
        <label className="small teks-lembut" htmlFor="saring-status">
          Saring
        </label>
        <select
          id="saring-status"
          className="form-select form-select-sm w-auto"
          value={saring}
          onChange={(e) => setSaring(e.target.value)}
        >
          <option value="">Semua</option>
          <option value="menunggu">Menunggu tinjauan</option>
          <option value="valid">Valid</option>
          <option value="tidak_valid">Tidak valid</option>
        </select>
      </div>

      {(kejadian.data ?? []).length === 0 ? (
        <p className="teks-lembut small">
          Belum ada kejadian tercatat. Ulangan berjalan tanpa gangguan — itu kabar baik.
        </p>
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
                      className="btn-sm"
                      memuat={sedangTinjau === satu.id}
                      teksMemuat="Menyimpan…"
                      onClick={() => void tinjau(satu.id, 'tidak_valid')}
                    >
                      Tidak valid
                    </Tombol>
                    <Tombol
                      className="btn-sm"
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
