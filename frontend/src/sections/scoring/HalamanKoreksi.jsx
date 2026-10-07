/**
 * Antrean koreksi manual guru (slice 06).
 *
 * Hanya soal yang belum pasti dinilai mesin (bertingkat: isian singkat &
 * uraian) yang muncul di sini. Nilai yang sudah dinilai mesin tetap bisa
 * dikoreksi, tetapi wajib dua langkah: minta token konfirmasi berisi alasan,
 * lalu simpan nilai baru dengan token itu. Token berlaku sekali dan singkat.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { RUTE, ruteKuisDetail } from '../../routes.js'
import { ambilAntreanKoreksi, mintaSaranAi, mintaTokenKoreksi, simpanKoreksi } from './api.js'
import { jawabanTeks, kelasStatus, ringkasKunci, saranAiTeks } from './tampilan.js'

/**
 * Form koreksi satu baris: skor, alasan, lalu token konfirmasi.
 *
 * Saran AI (slice 09-B) hanya ditawarkan di sini: angkanya bisa dipakai dengan
 * satu klik, tetapi tetap wajib disimpan lewat token konfirmasi supaya nilainya
 * bisa dipertanggungjawabkan guru.
 *
 * @param {{
 *   item: import('./api.js').DataItemKoreksi,
 *   alasanMin: number,
 *   aiAktif: boolean,
 *   onSelesai: () => void,
 * }} props
 */
function FormKoreksi({ item, alasanMin, aiAktif, onSelesai }) {
  const [skor, setSkor] = useState(String(item.skor_sekarang))
  const [alasan, setAlasan] = useState('')
  const [token, setToken] = useState('')
  const [tokenKedaluwarsa, setTokenKedaluwarsa] = useState(/** @type {string|null} */ (null))

  const mintaToken = useMutation({
    mutationFn: () => mintaTokenKoreksi(item.attempt_id, item.question_id, alasan.trim()),
    onSuccess: (hasil) => {
      setToken(hasil.token)
      setTokenKedaluwarsa(hasil.expires_at)
      tampilkanToast('sukses', `Token konfirmasi terbit (berlaku ${hasil.ttl_detik} detik).`)
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const simpan = useMutation({
    mutationFn: () =>
      simpanKoreksi(item.attempt_id, {
        question_id: item.question_id,
        skor: Number(skor),
        alasan: alasan.trim(),
        token: token.trim(),
      }),
    onSuccess: (hasil) => {
      tampilkanToast('sukses', `${hasil.message} Total skor attempt: ${hasil.total_skor}.`)
      onSelesai()
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const mintaAi = useMutation({
    mutationFn: () => mintaSaranAi(item.attempt_id),
    onSuccess: (hasil) => {
      tampilkanToast(hasil.aktif ? 'sukses' : 'info', hasil.message)
      onSelesai()
    },
    onError: (galat) => tampilkanToast('salah', pesanGalatApi(galat)),
  })

  const saranAi = saranAiTeks(item)
  const adaSaranAi = typeof item.saran_ai === 'number'
  const angkaSkor = Number(skor)
  const skorWajar = Number.isFinite(angkaSkor) && angkaSkor >= 0 && angkaSkor <= item.skor_maksimal
  const alasanCukup = alasan.trim().length >= alasanMin
  const sibuk = mintaToken.isPending || simpan.isPending

  return (
    <div className="kartu-lembut p-3">
      {saranAi !== null && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <span className="badge-status info">AI</span>
          <span className="small mb-0">{saranAi}</span>
          {adaSaranAi && (
            <button type="button" className="btn btn-sm btn-tepi" onClick={() => setSkor(String(item.saran_ai))}>
              Pakai saran AI
            </button>
          )}
          {aiAktif && (
            <button
              type="button"
              className="btn btn-sm btn-tepi ms-auto"
              disabled={mintaAi.isPending}
              onClick={() => mintaAi.mutate()}
            >
              {mintaAi.isPending ? 'Meminta saran…' : 'Minta saran AI'}
            </button>
          )}
        </div>
      )}

      {saranAi !== null && item.alasan_ai !== null && (
        <p className="teks-lembut small mb-2">
          <strong>Catatan AI:</strong> {item.alasan_ai}
        </p>
      )}

      {saranAi === null && aiAktif && (
        <div className="d-flex justify-content-end mb-2">
          <button
            type="button"
            className="btn btn-sm btn-tepi"
            disabled={mintaAi.isPending}
            onClick={() => mintaAi.mutate()}
          >
            {mintaAi.isPending ? 'Meminta saran…' : 'Minta saran AI'}
          </button>
        </div>
      )}

      <div className="row g-2 align-items-end mb-2">
        <div className="col-sm-4 col-lg-3">
          <label className="form-label fw-semibold" htmlFor={`skor-${item.attempt_id}-${item.question_id}`}>
            Skor baru (maks {item.skor_maksimal})
          </label>
          <input
            id={`skor-${item.attempt_id}-${item.question_id}`}
            className="form-control"
            type="number"
            min={0}
            max={item.skor_maksimal}
            step="0.5"
            value={skor}
            onChange={(e) => setSkor(e.target.value)}
          />
        </div>
        <div className="col-sm-8 col-lg-9">
          <label className="form-label fw-semibold" htmlFor={`alasan-${item.attempt_id}-${item.question_id}`}>
            Alasan koreksi (minimal {alasanMin} karakter)
          </label>
          <textarea
            id={`alasan-${item.attempt_id}-${item.question_id}`}
            className="form-control"
            rows={2}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="mis. jawaban benar secara konsep walau ejaannya berbeda"
          />
        </div>
      </div>

      {tokenKedaluwarsa !== null && (
        <p className="teks-lembut small mb-2">
          Token konfirmasi aktif sampai {new Date(tokenKedaluwarsa).toLocaleTimeString('id-ID')}. Token
          hangus setelah dipakai atau kedaluwarsa.
        </p>
      )}

      <div className="d-flex flex-wrap gap-2">
        <Tombol
          varian="tepi"
          memuat={mintaToken.isPending}
          teksMemuat="Menerbitkan…"
          disabled={sibuk || !alasanCukup}
          onClick={() => mintaToken.mutate()}
        >
          Minta token konfirmasi
        </Tombol>

        <Tombol
          memuat={simpan.isPending}
          teksMemuat="Menyimpan…"
          disabled={sibuk || token.trim() === '' || !skorWajar || !alasanCukup}
          onClick={() => simpan.mutate()}
        >
          Simpan koreksi
        </Tombol>
      </div>

      {!skorWajar && <p className="status-salah small mb-0 mt-2">Skor wajib antara 0 dan {item.skor_maksimal}.</p>}
      {!alasanCukup && alasan.trim() !== '' && (
        <p className="status-salah small mb-0 mt-2">Alasan minimal {alasanMin} karakter.</p>
      )}
    </div>
  )
}

export default function HalamanKoreksi() {
  const { id } = useParams()
  const nomor = Number(id)
  const klienQuery = useQueryClient()

  const antrean = useQuery({
    queryKey: ['koreksi', nomor],
    queryFn: () => ambilAntreanKoreksi(nomor),
    enabled: Number.isInteger(nomor) && nomor > 0,
  })

  const data = antrean.data

  if (antrean.isLoading) {
    return <p className="text-body-secondary">Menyusun antrean koreksi…</p>
  }

  if (antrean.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Antrean koreksi belum bisa dibuka">
        <p className="mb-0">Halaman ini khusus guru pemilik kuis.</p>
      </Banner>
    )
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-10">
        <div className="kartu-soft p-4 p-md-5">
          <Link className="btn btn-sm btn-tepi mb-3" to={ruteKuisDetail(data.kuis_id)}>
            ← Kembali ke detail kuis
          </Link>

          <h1 className="h5 fw-bold mb-1">Koreksi manual · {data.judul_kuis}</h1>
          <p className="teks-lembut small mb-3">
            {data.mapel_nama ?? '—'} · {data.kelas_nama ?? '—'} · {data.jumlah} jawaban menunggu tinjauan.
            Setiap koreksi memakai token sekali pakai dan tercatat di audit.
          </p>

          <p className="teks-lembut small mb-3">
            {data.ai_aktif
              ? 'Saran AI tersedia sebagai bahan pertimbangan. Angkanya tidak pernah menggantikan nilai Anda — simpan koreksi dulu agar tercatat.'
              : 'Penilaian AI tidak dinyalakan di server ini, jadi semua jawaban diperiksa manual.'}
          </p>

          {data.jumlah === 0 && (
            <p className="text-body-secondary">
              Tidak ada yang perlu dikoreksi. Semua jawaban sudah dinilai mesin.
            </p>
          )}

          <div className="d-flex flex-column gap-3">
            {data.item.map((item) => (
              <section
                key={`${item.attempt_id}-${item.question_id}`}
                className="kartu-soft p-3"
                aria-label={`Koreksi soal ${item.question_id}`}
              >
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span className="fw-semibold">{item.murid_nama ?? 'Murid'}</span>
                  <span className="teks-lembut small">attempt #{item.no_attempt ?? item.attempt_id}</span>
                  <span className="badge-status lembut">{item.tipe_label}</span>
                  <span className={kelasStatus(item.status)}>{item.status_label}</span>
                  {item.dinilai_manual && <span className="badge-status info">Sudah dikoreksi</span>}
                  <span className="teks-lembut small ms-auto">
                    skor {item.skor_sekarang} / {item.skor_maksimal}
                  </span>
                </div>

                <p className="mb-1">{item.teks_soal}</p>
                <p className="mb-1">
                  <strong>Jawaban murid:</strong> {jawabanTeks(item.jawaban)}
                </p>
                <p className="teks-lembut small mb-3">
                  <strong>Kunci:</strong> {ringkasKunci(item.kunci)}
                </p>

                <FormKoreksi
                  item={item}
                  alasanMin={data.alasan_min}
                  aiAktif={data.ai_aktif}
                  onSelesai={() => void klienQuery.invalidateQueries({ queryKey: ['koreksi', nomor] })}
                />
              </section>
            ))}
          </div>

          <div className="d-flex flex-wrap gap-2 mt-4">
            <Link className="btn btn-tepi" to={RUTE.kuis}>
              Daftar kuis
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
