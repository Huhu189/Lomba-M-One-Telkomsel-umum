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
import { RUTE, kunciKuisSah, ruteKuisDetail, ruteMonitorKuis } from '../../routes.js'
import { ambilAntreanKoreksi, mintaSaranAi, mintaTokenKoreksi, simpanKoreksi } from './api.js'
import {
  catatanUntukAttempt,
  itemBerikutnya,
  jawabanTeks,
  kelasStatus,
  kunciKoreksi,
  langkahKoreksi,
  pilihItemKoreksi,
  ringkasKunci,
  saranAiTeks,
  tingkatRisiko,
} from './tampilan.js'

/** Nama ketiga langkah koreksi — dipakai penunjuk langkah di dalam form. */
const LANGKAH_KOREKSI = ['Skor & alasan', 'Token konfirmasi', 'Tersimpan']

/**
 * Alasan siap pakai (14 Oktober 2026, temuan G1).
 *
 * Alasan koreksi tetap **wajib** — itu aturan audit di `AGENT.md` (mutasi
 * sensitif = alasan + token + audit), dan laporan ini tidak melemahkannya tanpa
 * izin pemilik produk. Yang dihapus adalah keharusan MENGETIK: kelas 30 murid
 * dengan 3 soal uraian berarti 90 kali menulis alasan, dan itulah yang membuat
 * guru berhenti memakai fitur koreksi. Kalimat di bawah semuanya ≥ 10 karakter
 * sehingga tetap memenuhi ambang server, dan guru tetap bebas menulis sendiri.
 */
const ALASAN_CEPAT = [
  'Konsep benar walau ejaannya berbeda',
  'Jawaban belum lengkap, nilai dikurangi',
  'Kata kunci terlampaui walaupun kalimatnya berbeda',
  'Nilai otomatis terlalu longgar untuk jawaban ini',
]

/**
 * Waktu satu catatan — selalu waktu server (klien tidak dipercaya).
 * @param {import('./api.js').DataCatatanMurid['daftar'][number]} satu
 * @returns {string}
 */
function waktuCatatan(satu) {
  const waktu = satu.created_at === null ? null : new Date(satu.created_at)

  if (waktu === null || Number.isNaN(waktu.getTime())) return 'waktu tidak tercatat'

  return `waktu server ${waktu.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}`
}

/**
 * Catatan kecurangan murid yang sedang dinilai — tampil di halaman ini juga
 * (14 Oktober 2026).
 *
 * Pemilik produk: catatan harus terlihat "saat guru melihat hasil kerja murid".
 * Sebelumnya guru harus membuka Monitor Ulangan, mencari nama anaknya, lalu
 * kembali ke antrean — dan sering lupa melakukannya. Yang ditampilkan hanya
 * bacaan: meninjau catatan (valid/tidak valid) tetap milik Monitor Ulangan,
 * karena catatan itu append-only dan keputusannya butuh alasan.
 *
 * @param {{
 *   catatan: import('./api.js').DataCatatanMurid|null,
 *   kunciKuis: string,
 * }} props
 */
function PanelCatatan({ catatan, kunciKuis }) {
  if (catatan === null) {
    return (
      <p className="teks-lembut small mb-2" data-catatan="kosong">
        Tidak ada catatan kecurangan untuk murid ini.
      </p>
    )
  }

  const risiko = tingkatRisiko(catatan.skor_tertinggi)
  const sisa = catatan.jumlah - catatan.daftar.length

  return (
    <div className="kartu-lembut p-2 mb-2" data-catatan={catatan.jumlah}>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className={risiko.kelas}>{risiko.label}</span>
        <span className="fw-semibold small">{catatan.jumlah} catatan pada murid ini</span>
        {catatan.belum_ditinjau > 0 && (
          <span className="badge-status info">{catatan.belum_ditinjau} belum ditinjau</span>
        )}
        <Link className="taut-sentuh small ms-auto" to={ruteMonitorKuis(kunciKuis)}>
          Tinjau di Monitor Ulangan
        </Link>
      </div>

      <ul className="list-unstyled small mb-0 mt-2">
        {catatan.daftar.map((satu) => (
          <li key={satu.id} className="d-flex flex-wrap align-items-center gap-2 py-1">
            <span className="fw-semibold">{satu.kategori_label}</span>
            <span className="teks-lembut">risiko {satu.skor_risiko}</span>
            <span className="teks-lembut">{waktuCatatan(satu)}</span>
            {!satu.dari_klien && <span className="teks-lembut">dihitung server</span>}
            <span
              className={`badge-status ${satu.review_status === 'menunggu' ? 'info' : 'lembut'} ms-auto`}
            >
              {satu.review_status_label}
            </span>
          </li>
        ))}
      </ul>

      {sisa > 0 && (
        <p className="teks-lembut small mb-0 mt-1">
          … dan {sisa} catatan lain yang tidak dirinci di sini; semuanya ada di Monitor Ulangan.
        </p>
      )}

      <p className="teks-lembut small mb-0 mt-1">
        Catatan adalah bahan tanya baik-baik, bukan bukti pelanggaran — nilai tetap guru yang
        menentukan.
      </p>
    </div>
  )
}

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
 *   adaBerikutnya: boolean,
 *   onSelesai: () => void,
 * }} props
 */
function FormKoreksi({ item, alasanMin, aiAktif, adaBerikutnya, onSelesai }) {
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

  /**
   * Simpan koreksi — token dimintakan sendiri bila belum ada (temuan G1).
   *
   * Dulu guru harus menekan "Minta token konfirmasi" lalu "Simpan koreksi":
   * empat aksi per jawaban (skor, alasan, token, simpan) untuk puluhan jawaban.
   * Token tetap diterbitkan & dipakai server seperti sebelumnya (audit tidak
   * berubah), hanya saja dua langkah itu kini satu tombol. Tombol "Minta token"
   * tetap ada bagi guru yang ingin melihat tokennya lebih dulu.
   */
  const simpan = useMutation({
    mutationFn: async () => {
      let dipakai = token.trim()

      if (dipakai === '') {
        const terbit = await mintaTokenKoreksi(item.attempt_id, item.question_id, alasan.trim())
        dipakai = terbit.token
        setToken(terbit.token)
        setTokenKedaluwarsa(terbit.expires_at)
      }

      return simpanKoreksi(item.attempt_id, {
        question_id: item.question_id,
        skor: Number(skor),
        alasan: alasan.trim(),
        token: dipakai,
      })
    },
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

  /** Skor cepat yang masuk akal untuk satu jawaban (temuan G1). */
  const skorCepat = [0, item.skor_maksimal / 2, item.skor_maksimal].filter(
    (satu, indeks, daftar) => daftar.indexOf(satu) === indeks && satu > 0,
  )

  /**
   * Ctrl/Cmd+Enter menyimpan dari mana pun di dalam form (temuan G1): guru yang
   * mengoreksi puluhan jawaban tidak perlu memindahkan tangan ke tetikus.
   * @param {import('react').KeyboardEvent<HTMLElement>} peristiwa
   */
  function pintasanSimpan(peristiwa) {
    if (peristiwa.key !== 'Enter' || !(peristiwa.ctrlKey || peristiwa.metaKey)) return

    peristiwa.preventDefault()
    if (sibuk || !skorWajar || !alasanCukup) return

    simpan.mutate()
  }

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
            onKeyDown={pintasanSimpan}
          />
          {/* Tombol skor cepat: satu ketukan, tanpa mengetik angka. */}
          <div className="d-flex flex-wrap gap-1 mt-1">
            {skorCepat.map((satu) => (
              <Tombol
                key={satu}
                varian="tepi"
                ukuran="sedang"
                data-skor-cepat={satu}
                onClick={() => setSkor(String(satu))}
              >
                {satu === item.skor_maksimal ? `Penuh (${satu})` : `Setengah (${satu})`}
              </Tombol>
            ))}
          </div>
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
            onKeyDown={pintasanSimpan}
            placeholder="mis. jawaban benar secara konsep walau ejaannya berbeda"
          />
          {/* Alasan siap pakai: mengurangi mengetik, tanpa menghapus kewajiban
           * alasan (aturan audit tetap sama). */}
          <div className="d-flex flex-wrap gap-1 mt-1">
            {ALASAN_CEPAT.map((satu) => (
              <Tombol
                key={satu}
                varian="teks"
                data-alasan-cepat={satu}
                onClick={() => setAlasan(satu)}
              >
                {satu}
              </Tombol>
            ))}
          </div>
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

        {/* Satu tombol yang mengurus tokennya sendiri (temuan G1). */}
        <Tombol
          memuat={simpan.isPending}
          teksMemuat="Menyimpan…"
          disabled={sibuk || !skorWajar || !alasanCukup}
          onClick={() => simpan.mutate()}
        >
          {adaBerikutnya ? 'Simpan & berikutnya' : 'Simpan koreksi'}
        </Tombol>
      </div>

      <p className="teks-lembut small mb-0 mt-2">
        Pintasan: Ctrl/Cmd + Enter menyimpan tanpa pindah ke tetikus.
      </p>

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
  const berikutnya =
    terpilih === null ? null : itemBerikutnya(data.item, kunciKoreksi(terpilih))

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
                    const catatan = catatanUntukAttempt(data.catatan_attempt, satu.attempt_id)

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
                            {catatan !== null && (
                              <span
                                className={tingkatRisiko(catatan.skor_tertinggi).kelas}
                                data-catatan-baris={catatan.jumlah}
                              >
                                {catatan.jumlah} catatan
                              </span>
                            )}
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

                    <PanelCatatan
                      catatan={catatanUntukAttempt(data.catatan_attempt, terpilih.attempt_id)}
                      kunciKuis={kunciKuis}
                    />

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
                      adaBerikutnya={berikutnya !== null}
                      onSelesai={() => {
                        // Setelah tersimpan, baris ini hilang dari antrean; yang
                        // dibuka berikutnya adalah baris SESUDAHNYA (temuan G1),
                        // bukan baris pertama lagi.
                        setKunci(berikutnya === null ? null : kunciKoreksi(berikutnya))
                        void klienQuery.invalidateQueries({ queryKey: ['koreksi', kunciKuis] })
                      }}
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
