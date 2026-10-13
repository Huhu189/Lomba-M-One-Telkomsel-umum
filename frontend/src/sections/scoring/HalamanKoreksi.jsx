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
import HeaderHalaman from '../../shared/ui/HeaderHalaman.jsx'
import KosongData from '../../shared/ui/KosongData.jsx'
import Langkah from '../../shared/ui/Langkah.jsx'
import Skeleton from '../../shared/ui/Skeleton.jsx'
import { Tombol, TombolTaut } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { IkonCentang } from '../../icons.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { RUTE, kunciKuisSah, ruteKuisDetail } from '../../routes.js'
import { ambilAntreanKoreksi, mintaSaranAi, mintaTokenKoreksi, simpanKoreksi } from './api.js'
import {
  jawabanTeks,
  kelasStatus,
  kunciKoreksi,
  langkahKoreksi,
  pilihItemKoreksi,
  ringkasKunci,
  saranAiTeks,
} from './tampilan.js'

/** Nama ketiga langkah koreksi — dipakai penunjuk langkah di dalam form. */
const LANGKAH_KOREKSI = ['Skor & alasan', 'Token konfirmasi', 'Tersimpan']

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
  const [tersimpan, setTersimpan] = useState(false)

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
      setTersimpan(true)
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
            <Tombol varian="tepi" onClick={() => setSkor(String(item.saran_ai))}>
              Pakai saran AI
            </Tombol>
          )}
          {aiAktif && (
            <Tombol
              varian="tepi"
              className="ms-auto"
              memuat={mintaAi.isPending}
              teksMemuat="Meminta saran…"
              onClick={() => mintaAi.mutate()}
            >
              Minta saran AI
            </Tombol>
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
          <Tombol
            varian="tepi"
            memuat={mintaAi.isPending}
            teksMemuat="Meminta saran…"
            onClick={() => mintaAi.mutate()}
          >
            Minta saran AI
          </Tombol>
        </div>
      )}

      <Langkah
        langkah={LANGKAH_KOREKSI}
        sekarang={langkahKoreksi({ tersimpan, punyaToken: token.trim() !== '' }) - 1}
      />

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
          diterbitkan server untuk tindakan ini saja dan hangus setelah dipakai atau kedaluwarsa — simpan
          koreksi sebelum waktunya habis.
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
  const { slug } = useParams()
  // `kunciKuis` = slug kuis dari alamat; `kunci` (di bawah) = baris antrean yang
  // sedang dibuka. Dua nama berbeda supaya tidak tertukar.
  const kunciKuis = kunciKuisSah(slug)
  const klienQuery = useQueryClient()
  // Baris antrean yang sedang dibuka, disimpan sebagai kunci (attempt + soal) —
  // bukan nomor urut — supaya pilihan guru tidak bergeser saat antrean menyegar
  // dan baris yang sudah dikoreksi hilang.
  const [kunci, setKunci] = useState(/** @type {string|null} */ (null))

  const antrean = useQuery({
    queryKey: ['koreksi', kunciKuis],
    queryFn: () => ambilAntreanKoreksi(kunciKuis),
    enabled: kunciKuis !== '',
  })

  const data = antrean.data

  if (antrean.isLoading) {
    return <Skeleton judul baris={4} label="Menyusun antrean koreksi…" />
  }

  if (antrean.isError || data === undefined) {
    return (
      <Banner jenis="salah" judul="Antrean koreksi belum bisa dibuka">
        <p className="mb-0">Halaman ini khusus guru pemilik kuis.</p>
      </Banner>
    )
  }

  const terpilih = pilihItemKoreksi(data.item, kunci).item

  return (
    <div className="row justify-content-center">
      <div className="col-lg-11">
        <div className="kartu-soft p-4 p-md-5">
          <HeaderHalaman
            judul={`Koreksi manual · ${data.judul_kuis}`}
            jejak={<Link to={ruteKuisDetail(kunciKuis)}>Kuis / {data.judul_kuis}</Link>}
            deskripsi={`${data.mapel_nama ?? '—'} · ${data.kelas_nama ?? '—'} · ${data.jumlah} jawaban menunggu tinjauan. Setiap koreksi memakai token sekali pakai dan tercatat di audit.`}
          />

          <p className="teks-lembut small mb-3">
            {data.ai_aktif
              ? 'Saran AI tersedia sebagai bahan pertimbangan. Angkanya tidak pernah menggantikan nilai Anda — simpan koreksi dulu agar tercatat.'
              : 'Penilaian AI tidak dinyalakan di server ini, jadi semua jawaban diperiksa manual.'}
          </p>

          {data.jumlah === 0 && (
            <KosongData
              judul="Tidak ada yang perlu dikoreksi"
              ikon={IkonCentang}
              aksi={
                <TombolTaut to={ruteKuisDetail(kunciKuis)} varian="tepi">
                  Kembali ke detail kuis
                </TombolTaut>
              }
            >
              Semua jawaban sudah dinilai mesin. Nilai per soal tetap bisa diubah kapan saja bila
              hasilnya perlu ditinjau ulang.
            </KosongData>
          )}

          {data.jumlah > 0 && (
            <div className="row g-4">
              {/* Antrean kiri: satu baris per jawaban yang menunggu tinjauan. */}
              <div className="col-12 col-lg-5 col-xl-4">
                <h2 className="h6 fw-bold mb-2">Antrean</h2>
                <ol className="list-unstyled mb-0">
                  {data.item.map((satu) => {
                    const kunciBaris = kunciKoreksi(satu)
                    const dibuka = terpilih !== null && kunciKoreksi(terpilih) === kunciBaris

                    return (
                      <li key={kunciBaris} className="mb-2">
                        <button
                          type="button"
                          className="btn btn-tepi btn-lebar text-start"
                          data-koreksi={kunciBaris}
                          aria-current={dibuka ? 'true' : undefined}
                          onClick={() => setKunci(kunciBaris)}
                        >
                          <span className="fw-semibold">{satu.murid_nama ?? 'Murid'}</span>
                          <span className="d-block small teks-lembut">
                            {satu.tipe_label} · attempt #{satu.no_attempt ?? satu.attempt_id} ·{' '}
                            skor {satu.skor_sekarang} / {satu.skor_maksimal}
                          </span>
                          <span className="d-flex flex-wrap align-items-center gap-2 mt-1">
                            <span className={kelasStatus(satu.status)}>{satu.status_label}</span>
                            {satu.dinilai_manual && <span className="badge-status info">Sudah dikoreksi</span>}
                            {dibuka && <span className="badge-status lembut">sedang dibuka</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>

              {/* Detail kanan: hanya baris yang dibuka, supaya satu form saja hidup. */}
              <div className="col-12 col-lg-7 col-xl-8">
                {terpilih === null ? (
                  <Banner jenis="info">Pilih satu jawaban di antrean untuk mulai mengoreksi.</Banner>
                ) : (
                  <section className="kartu-lembut p-3" aria-label={`Koreksi soal ${terpilih.question_id}`}>
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                      <span className="fw-semibold">{terpilih.murid_nama ?? 'Murid'}</span>
                      <span className="teks-lembut small">
                        attempt #{terpilih.no_attempt ?? terpilih.attempt_id}
                      </span>
                      <span className="badge-status lembut">{terpilih.tipe_label}</span>
                      <span className={kelasStatus(terpilih.status)}>{terpilih.status_label}</span>
                      {terpilih.dinilai_manual && <span className="badge-status info">Sudah dikoreksi</span>}
                      <span className="teks-lembut small ms-auto">
                        skor {terpilih.skor_sekarang} / {terpilih.skor_maksimal}
                      </span>
                    </div>

                    <p className="mb-1">{terpilih.teks_soal}</p>
                    <p className="mb-1">
                      <strong>Jawaban murid:</strong> {jawabanTeks(terpilih.jawaban)}
                    </p>
                    <p className="teks-lembut small mb-3">
                      <strong>Kunci:</strong> {ringkasKunci(terpilih.kunci)}
                    </p>

                    {/* `key` mengikat keadaan form ke barisnya: pindah baris = form bersih. */}
                    <FormKoreksi
                      key={kunciKoreksi(terpilih)}
                      item={terpilih}
                      alasanMin={data.alasan_min}
                      aiAktif={data.ai_aktif}
                      onSelesai={() => void klienQuery.invalidateQueries({ queryKey: ['koreksi', kunciKuis] })}
                    />
                  </section>
                )}
              </div>
            </div>
          )}

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
