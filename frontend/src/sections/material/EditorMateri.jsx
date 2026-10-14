/**
 * Editor materi gaya non-linear video editor (guru).
 *
 * Struktur mengikuti editor video sungguhan:
 *   sidebar (tools + template) → canvas pratinjau besar → kontrol playback
 *   (waktu kini, tombol play bulat, durasi total) → timeline: penggaris detik,
 *   playhead vertikal, beberapa track bertingkat, dan track audio paling bawah.
 *
 * Setiap klip boleh punya track, titik mulai, dan durasi sendiri sehingga media
 * bisa saling menimpa (track lebih tinggi menang) dan kuis bisa ditempatkan di
 * mana saja. Penempatan ini ikut disimpan server (lihat SinkronBlokRequest).
 *
 * Di layar sempit, hasil pratinjau sengaja dibuat kecil dan ruang diprioritaskan
 * untuk timeline/inspector supaya guru tetap leluasa menyusun.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Banner from '../../shared/ui/Banner.jsx'
import DialogKonfirmasi from '../../shared/ui/DialogKonfirmasi.jsx'
import TabelData from '../../shared/ui/TabelData.jsx'
import { IkonPanahKiri } from '../../icons.jsx'
import {
  JUDUL_BELUM_TERSIMPAN,
  PESAN_BELUM_TERSIMPAN,
  usePenjagaSebelumTutup,
} from '../../shared/penjagaPerubahan.js'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../shared/ui/toast.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { RUTE } from '../../routes.js'
import { ambilKuis } from '../quiz/api.js'
import {
  ambilMateriDetail,
  ambilTemaMateri,
  hapusUnggahan,
  laporanMateri,
  publikasiMateri,
  sinkronBlok,
  unggahBerkas,
} from './api.js'
import PetaPerjalanan from './PetaPerjalanan.jsx'
import { labelDokumen, namaBerkas, sajianBerkas } from './sajianBerkas.js'
import { jenisTautan, labelTautan, namaTautan, pesanGalatTautan } from './tautanMedia.js'
import { faseKe, petaLokal, tanpaPeta, terapkanTema } from './perjalanan.js'
import {
  DURASI_BAWAAN,
  DURASI_MINIMUM,
  MAKS_PENJELASAN,
  TIPE_BLOK,
  blokBaru,
  ciriKlip,
  dariServer,
  detikDariX,
  durasiTotal,
  formatWaktu,
  gayaMedia,
  klipDasarPada,
  kuisJeda,
  kuisPadaWaktu,
  lepasBerkas,
  muatanBlok,
  offsetMedia,
  pangkasKanan,
  pangkasKiri,
  pemakaiBerkas,
  penjelasanTerisi,
  rencanaLepasBerkas,
  setDurasi,
  setMulai,
  sisipBlok,
  susunTrack,
  tampilanKlip,
  ubahTampilan,
} from './editorMateri.js'

/** Langkah detik saat penempatan klip digeser lewat tombol di inspector. */
const LANGKAH_WAKTU = 0.5

/** Langkah tipis untuk memendekkan/memanjangkan durasi satu klip. */
const LANGKAH_TIPIS = 0.1

/** Dua sisi gagang pangkas `|` pada klip yang sedang dipilih. */
const SISI_PANGKAS = /** @type {const} */ (['kiri', 'kanan'])

/**
 * Ujung kanan sebuah klip (detik). Dipakai gagang kanan, "Mulai + Durasi", dan
 * dipakai guru saat membayangkan panjang klip.
 * @param {import('./editorMateri.js').BarisBlok|undefined} baris
 * @returns {number}
 */
function ujungKlip(baris) {
  if (baris === undefined) return 0

  return Math.round((baris.mulai_detik + baris.durasi_detik) * 10) / 10
}

/**
 * Kalimat hasil pembuangan berkas pustaka, menyebut rujukan yang ikut
 * dibersihkan server supaya guru tahu bagian mana dari materinya yang berubah.
 *
 * @param {import('./api.js').DataHasilBuangBerkas} hasil
 * @returns {string}
 */
function ringkasanBuangBerkas(hasil) {
  /** @type {string[]} */
  const ikut = []

  if (hasil.klip > 0) ikut.push(`${hasil.klip} klip media dibuang`)
  if (hasil.penjelasan > 0) ikut.push(`${hasil.penjelasan} media penjelasan dilepas`)
  if (hasil.tema > 0) ikut.push('latar tema kembali ke animasi bawaan')

  return ikut.length === 0
    ? 'Berkas dibuang dari pustaka materi.'
    : `Berkas dibuang · ${ikut.join(' · ')}.`
}

/**
 * Durasi asli sebuah berkas media (detik) dibaca dari metadatanya sendiri.
 *
 * Dipakai saat berkas baru disisipkan supaya klip media otomatis sepanjang
 * videonya (bukan 10 detik bawaan lagi). Elemen `<video>` dipakai untuk semua
 * jenis media — berkas audio pun bisa membacakan `duration` lewat elemen ini.
 * Berkas yang bukan media (PDF, PPTX) menghasilkan `null`: durasinya tetap
 * bawaan dan guru bisa mengaturnya sendiri.
 *
 * @param {string} url
 * @returns {Promise<number|null>}
 */
function bacaDurasiMedia(url) {
  return new Promise((selesai) => {
    const el = document.createElement('video')
    el.preload = 'metadata'

    let sudah = false
    const batas = window.setTimeout(() => tutup(null), 5000)

    /** @param {number|null} durasi */
    function tutup(durasi) {
      if (sudah) return
      sudah = true
      window.clearTimeout(batas)
      el.onloadedmetadata = null
      el.ondurationchange = null
      el.removeAttribute('src')
      el.load()
      selesai(durasi)
    }

    const lapor = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) tutup(el.duration)
    }

    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        tutup(el.duration)
        return
      }

      // Sebagian berkas (webm/mkv hasil rekaman) baru melaporkan durasinya
      // setelah digeser jauh ke depan. Tanpa ini klipnya jatuh ke durasi bawaan
      // walau panjang videonya jelas.
      el.ondurationchange = lapor
      el.currentTime = 1e101
    }

    el.ondurationchange = lapor
    el.onerror = () => tutup(null)
    el.src = url
  })
}

/**
 * Durasi klip media dari berkas lokal yang baru diunggah (belum punya URL
 * publik), dibaca dari objek berkasnya; `null` bila metadatanya tak terbaca.
 * @param {File} berkas
 * @returns {Promise<number|null>}
 */
async function bacaDurasiBerkas(berkas) {
  const url = URL.createObjectURL(berkas)

  try {
    return await bacaDurasiMedia(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Posisi aman: tidak pernah negatif dan tidak melewati durasi media (bila sudah
 * diketahui). Metadata media baru siap setelah `loadedmetadata`; sebelum itu
 * `duration` bernilai NaN dan target dipakai apa adanya.
 * @param {HTMLMediaElement} el
 * @param {number} target
 */
function posisiTujuan(el, target) {
  const batas = Number.isFinite(el.duration) ? el.duration : target
  return Math.max(0, Math.min(target, batas))
}

/**
 * Media klip yang ikut jam timeline editor.
 *
 * Memakai elemen media NATIVE (`<video>`/`<audio>`) supaya kontrol, subtitle,
 * dan aksesibilitas bawaan browser tetap utuh. Yang ditambahkan hanya sinkron
 * waktu: saat timeline diputar, media mulai dari offset klip; saat timeline
 * dijeda atau digeser, posisi media mengikuti playhead.
 *
 * @param {{
 *   berkas: import('./api.js').DataUnggahan,
 *   klip: import('./editorMateri.js').BarisBlok,
 *   bermain: boolean,
 *   detik: number,
 * }} props
 */
function MediaTersinkron({ berkas, klip, bermain, detik }) {
  const elemen = useRef(/** @type {HTMLMediaElement|null} */ (null))
  // Offset berjalan dibaca lewat ref supaya efek putar/jeda tidak ikut jalan
  // setiap detik (itu akan menghentikan-ulang pemutaran tiap detak).
  const offsetRef = useRef(0)

  /** @param {HTMLMediaElement} el @param {number} target */
  const geser = (el, target) => {
    try {
      el.currentTime = posisiTujuan(el, target)
    } catch {
      // Metadata belum siap; `onLoadedMetadata` akan menyejajarkan lagi.
    }
  }

  // Selaraskan offset sebelum efek putar/scrub di bawah (efek berjalan berurutan).
  useEffect(() => {
    offsetRef.current = offsetMedia(detik, klip.mulai_detik, klip.durasi_detik)
  }, [detik, klip.mulai_detik, klip.durasi_detik])

  // Putar/jeda mengikuti timeline. Hanya bergantung `bermain` agar pemutaran
  // media tidak di-restitusi tiap playhead bergerak.
  useEffect(() => {
    const el = elemen.current
    if (!el) return

    if (bermain) {
      geser(el, offsetRef.current)
      const janji = el.play?.()
      if (janji && typeof janji.catch === 'function') janji.catch(() => {})
    } else {
      el.pause?.()
    }
  }, [bermain])

  // Scrub saat timeline dijeda: playhead memindahkan posisi media.
  useEffect(() => {
    const el = elemen.current
    if (!el || bermain) return
    geser(el, offsetRef.current)
  }, [detik, bermain])

  /** @type {Record<string, unknown>} */
  const properti = {
    ref: elemen,
    src: berkas.url ?? undefined,
    // Pratinjau dikendalikan tombol play timeline; kontrol native ikut ter-zoom
    // dan terpotong saat media diatur "penuhi bingkai", jadi dimatikan di sini.
    controls: false,
    playsInline: true,
    preload: 'metadata',
    className: 'nle-media-penuh',
    style: gayaMedia(klip),
    onLoadedMetadata: (/** @type {import('react').SyntheticEvent<HTMLMediaElement>} */ e) => {
      geser(e.currentTarget, offsetRef.current)
    },
  }

  if (berkas.mime?.startsWith('audio/')) return <audio {...properti} />

  return <video {...properti} />
}

/**
 * Pratinjau isi satu klip seperti yang dilihat murid.
 * @param {{
 *   satu: import('./editorMateri.js').BarisBlok,
 *   cariUnggahan: (kode: string) => import('./api.js').DataUnggahan | undefined,
 *   daftarKuis: import('../quiz/api.js').DataKuis[],
 *   bermain: boolean,
 *   detik: number,
 * }} props
 */
function IsiKlip({ satu, cariUnggahan, daftarKuis, bermain, detik }) {
  if (satu.tipe === 'teks') {
    return satu.teks === '' ? (
      <p className="teks-lembut mb-0">(Teks klip ini belum ditulis.)</p>
    ) : (
      <p className="mb-0 fs-5" style={{ whiteSpace: 'pre-wrap' }}>
        {satu.teks}
      </p>
    )
  }

  if (satu.tipe === 'media') {
    const berkas = satu.unggahan_kode === '' ? undefined : cariUnggahan(satu.unggahan_kode)

    // Klip bersumber TAUTAN: beritahu jenisnya, bukan "belum ada berkas".
    if (!berkas && satu.tautan.trim() !== '') {
      return (
        <p className="mb-0">
          <strong>{labelTautan(jenisTautan(satu.tautan))}</strong> · {namaTautan(satu.tautan)}
        </p>
      )
    }

    if (!berkas) {
      return <p className="teks-lembut mb-0">(Belum ada berkas terunggah untuk klip ini.)</p>
    }

    const cara = sajianBerkas(berkas)

    return (
      <div className="nle-media-wrap">
        {cara === 'semat' && berkas.mime?.startsWith('image/') && (
          <img
            src={berkas.url ?? undefined}
            alt={satu.keterangan || berkas.nama_asli}
            className="nle-media-penuh"
            style={gayaMedia(satu)}
          />
        )}
        {cara === 'semat' &&
          (berkas.mime?.startsWith('video/') || berkas.mime?.startsWith('audio/')) && (
            <MediaTersinkron
              key={berkas.kode}
              berkas={berkas}
              klip={satu}
              bermain={bermain}
              detik={detik}
            />
          )}
        {cara === 'semat' && berkas.mime === 'application/pdf' && (
          <a href={berkas.url ?? undefined} target="_blank" rel="noreferrer">
            Buka dokumen PDF
          </a>
        )}
        {cara === 'dokumen' && (
          <div>
            <p className="mb-1">
              <strong>Dokumen {labelDokumen(berkas)}</strong> · {namaBerkas(berkas)}
            </p>
            <a href={berkas.url ?? undefined} target="_blank" rel="noreferrer" className="btn btn-tepi">
              Buka dokumen
            </a>
            <p className="small teks-lembut mb-0 mt-1">
              Murid membuka dokumen ini di aplikasi dokumennya — bukan diunduh sebagai berkas
              samar bernama .upload.
            </p>
          </div>
        )}
        {cara === 'unduh' && (
          <a href={berkas.url ?? undefined} className="btn btn-tepi" download>
            Unduh berkas ({berkas.kategori_label})
          </a>
        )}
        {satu.keterangan !== '' && <p className="nle-keterangan small mb-0">{satu.keterangan}</p>}
      </div>
    )
  }

  const kuis = daftarKuis.find((satuKuis) => String(satuKuis.id) === String(satu.quiz_id))

  return (
    <div className="border rounded-3 p-3 text-center">
      <p className="small teks-lembut mb-1">Kuis sisipan · latihan tidak masuk ranking</p>
      <p className="fw-semibold mb-0">
        {kuis ? `${kuis.judul} (${kuis.jumlah_soal ?? 0} soal)` : 'Kuis belum dipilih.'}
      </p>
    </div>
  )
}

/** Saklar layar sesudah kuis (bawaan mati; tampil di panel klip kuis). */
const SAKLAR_PANEL = [
  {
    kunci: 'ringkasan',
    judul: 'Ringkasan soal',
    bantuan: 'Daftar soal, benar/salahnya, jawaban yang tepat, dan pembahasan per soal.',
  },
  {
    kunci: 'kartu',
    judul: 'Kartu ingat (flashcard)',
    bantuan: 'Kartu balik dari soal tadi — yang salah muncul lebih dulu. Tertaut ke ringkasan.',
  },
  {
    kunci: 'papan',
    judul: 'Papan peringkat latihan',
    bantuan: 'Sepuluh besar kelas untuk kuis ini. Terpisah dari ranking ulangan resmi.',
  },
]

/**
 * Pemilih kuis untuk klip sisipan: pencarian + baris ringkas (jumlah soal,
 * mapel, kelas, status) supaya guru tidak menebak dari judul saja, dan kuis
 * tanpa soal langsung terlihat sebelum dipakai.
 *
 * @param {{
 *   daftarKuis: import('../quiz/api.js').DataKuis[],
 *   terpilih: number|string,
 *   onPilih: (id: number) => void,
 * }} props
 */
function PemilihKuis({ daftarKuis, terpilih, onPilih }) {
  const [kata, setKata] = useState('')
  const kunci = kata.trim().toLowerCase()
  const hasil =
    kunci === ''
      ? daftarKuis
      : daftarKuis.filter((satu) =>
          [satu.judul, satu.mapel_nama ?? '', satu.kelas_nama ?? '', satu.status].some((teks) =>
            String(teks).toLowerCase().includes(kunci),
          ),
        )

  return (
    <div className="nle-pemilih-kuis">
      <label className="form-label small mb-1" htmlFor="nle-cari-kuis">
        Kuis untuk klip ini
      </label>
      <input
        id="nle-cari-kuis"
        type="search"
        className="form-control form-control-sm mb-2"
        value={kata}
        onChange={(e) => setKata(e.target.value)}
        placeholder="Cari kuis (judul, mapel, atau kelas)…"
      />

      {daftarKuis.length === 0 && (
        <p className="small teks-lembut mb-0">
          Belum ada kuis. Buat kuis dulu di menu Kuis, lalu kembali ke editor ini.
        </p>
      )}

      {daftarKuis.length > 0 && hasil.length === 0 && (
        <p className="small teks-lembut mb-0">Tidak ada kuis yang cocok dengan “{kata}”.</p>
      )}

      <ul className="list-unstyled mb-0 nle-pemilih-daftar">
        {hasil.map((satu) => {
          const dipilih = String(satu.id) === String(terpilih)
          const kosong = (satu.jumlah_soal ?? 0) === 0

          return (
            <li key={satu.id}>
              <button
                type="button"
                className={`nle-pemilih-baris${dipilih ? ' aktif' : ''}`}
                aria-pressed={dipilih}
                onClick={() => onPilih(satu.id)}
              >
                <span className="fw-semibold small d-block">{satu.judul}</span>
                <span className="small teks-lembut d-block">
                  {satu.jumlah_soal ?? 0} soal · {satu.mapel_nama ?? '—'} · {satu.kelas_nama ?? '—'} ·{' '}
                  {satu.status_label ?? satu.status}
                </span>
                {kosong && <span className="small nle-pemilih-peringatan d-block">Belum ada soal.</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Lapisan kuis sisipan di atas bingkai (pratinjau). Soal sungguhan dirender
 * di sisi murid; di editor guru cukup melihat tata letak dan perilakunya.
 *
 * @param {{
 *   klip: import('./editorMateri.js').BarisBlok,
 *   kuis: import('../quiz/api.js').DataKuis|undefined,
 *   tertahan: boolean,
 *   onLanjut: () => void,
 * }} props
 */
function LapisanKuis({ klip, kuis, tertahan, onLanjut }) {
  const tampilan = tampilanKlip(klip)

  return (
    <div
      className={`nle-kuis nle-kuis-${tampilan.tata}`}
      role="dialog"
      aria-label="Pratinjau kuis sisipan"
    >
      <p className="nle-kuis-judul">
        {kuis ? `${kuis.judul} (${kuis.jumlah_soal ?? 0} soal)` : 'Kuis belum dipilih'}
      </p>
      <p className="nle-kuis-mode">
        {tampilan.mode === 'jeda' ? '⏸ Video berhenti sampai kuis dijawab' : '▶ Video tetap berjalan'}
      </p>
      <div className="nle-kuis-opsi" aria-hidden="true">
        {['A', 'B', 'C', 'D'].map((huruf) => (
          <span key={huruf} className="nle-kuis-pilihan">
            Pilihan {huruf}
          </span>
        ))}
      </div>
      {tertahan && (
        <Tombol ukuran="sedang" onClick={onLanjut}>
          Lanjutkan video (pratinjau)
        </Tombol>
      )}
    </div>
  )
}

export default function EditorMateri() {
  const { id } = useParams()
  const materiId = Number(id)
  const queryClient = useQueryClient()

  const detail = useQuery({
    queryKey: ['materi', materiId],
    queryFn: () => ambilMateriDetail(materiId),
    enabled: Number.isInteger(materiId) && materiId > 0,
  })
  const kuis = useQuery({ queryKey: ['kuis'], queryFn: ambilKuis })

  const materi = detail.data

  return (
    <div className="container-fluid py-3 px-2 px-lg-4">
      {detail.isLoading && <p className="teks-lembut">Memuat editor materi…</p>}

      {detail.isError && (
        <Banner jenis="salah" judul="Materi belum bisa dibuka">
          <p className="mb-0">Pastikan kamu guru pemilik materi ini.</p>
        </Banner>
      )}

      {materi && (
        <PanelEditor
          key={materi.id}
          materi={materi}
          daftarKuis={kuis.data ?? []}
          onTersimpan={() => void queryClient.invalidateQueries({ queryKey: ['materi'] })}
        />
      )}
    </div>
  )
}

/**
 * @param {{
 *   materi: import('./api.js').DataMateri,
 *   daftarKuis: import('../quiz/api.js').DataKuis[],
 *   onTersimpan: () => void,
 * }} props
 */
function PanelEditor({ materi, daftarKuis, onTersimpan }) {
  const navigasi = useNavigate()
  // Dialog konfirmasi ketika guru keluar dengan perubahan yang belum disimpan.
  const [dialogKeluar, setDialogKeluar] = useState(false)
  const [blok, setBlok] = useState(() => dariServer(materi.blok))
  const [progresUnggah, setProgresUnggah] = useState(0)
  // Tautan media (14 Okt 2026): kotak di sidebar untuk menyelipkan klip baru,
  // dan kotak di panel klip untuk mengganti sumber klip terpilih.
  const [tautanBaru, setTautanBaru] = useState('')
  const [galatTautanBaru, setGalatTautanBaru] = useState('')
  const [tautanKlip, setTautanKlip] = useState('')
  const [galatTautanKlip, setGalatTautanKlip] = useState('')
  // Berkas sedang diseret di atas panel editor (cuma penanda visual).
  const [seretBerkas, setSeretBerkas] = useState(false)
  const [galat, setGalat] = useState('')
  const [terpilih, setTerpilih] = useState(0)
  const [detik, setDetik] = useState(0)
  const [bermain, setBermain] = useState(false)
  const [trackEkstra, setTrackEkstra] = useState(0)
  const [menuTambah, setMenuTambah] = useState(false)
  // Berkas pustaka yang sedang dimintakan konfirmasi pembuangan (null = tutup).
  const [berkasDibuang, setBerkasDibuang] = useState(
    /** @type {import('./api.js').DataUnggahan|null} */ (null),
  )
  // Tema perjalanan: pilihan guru, disimpan bersama susunan klip.
  const [temaKode, setTemaKode] = useState(materi.tema?.kode ?? materi.perjalanan?.kode ?? '')
  const [temaNama, setTemaNama] = useState(materi.tema?.nama ?? materi.perjalanan?.nama ?? '')
  const [videoKode, setVideoKode] = useState(materi.tema?.video_kode ?? '')
  // Indeks kuis "jeda" yang sedang menahan pemutaran pratinjau (null = tidak ada).
  const [kuisTertahan, setKuisTertahan] = useState(/** @type {number|null} */ (null))
  const inputBerkas = useRef(/** @type {HTMLInputElement|null} */ (null))
  const detikRef = useRef(0)
  const blokRef = useRef(blok)
  // Kuis jeda yang sudah dilanjutkan; dikosongkan tiap playhead dipindah manual.
  const dilewatiRef = useRef(/** @type {Set<number>} */ (new Set()))
  const penggarisRef = useRef(/** @type {HTMLDivElement|null} */ (null))
  const sedangGeserRef = useRef(false)
  // Gagang pangkas `|`: rel timeline dipakai untuk menerjemahkan geseran ke detik,
  // dan `total` dibekukan selama seret supaya penggaris tidak "mengejar" tangan.
  const relRef = useRef(/** @type {HTMLDivElement|null} */ (null))
  const pangkasRef = useRef(/** @type {'kiri'|'kanan'|null} */ (null))
  const pangkasTotalRef = useRef(0)

  const laporan = useQuery({
    queryKey: ['materi-laporan', materi.id],
    queryFn: () => laporanMateri(materi.id),
    enabled: materi.status === 'publikasi',
  })

  // Katalog template tema: jarang berubah, sekali ambil cukup.
  const katalog = useQuery({
    queryKey: ['materi-tema'],
    queryFn: ambilTemaMateri,
    staleTime: Infinity,
  })

  const simpanBlok = useMutation({
    mutationFn: async () =>
      sinkronBlok(materi.id, muatanBlok(blok), {
        kode: temaKode,
        nama: temaNama,
        video_kode: videoKode === '' ? null : videoKode,
      }),
    onSuccess: (data) => {
      setGalat('')
      // Server boleh menormalkan pilihan kita (nama kosong → nama bawaan tema,
      // video asing → animasi bawaan), jadi tampilkan yang benar-benar tersimpan.
      setTemaKode(data.tema?.kode ?? '')
      setTemaNama(data.perjalanan?.nama ?? '')
      setVideoKode(data.tema?.video_kode ?? '')
      tampilkanToast('sukses', 'Susunan materi tersimpan.')
      onTersimpan()
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  const terbitkan = useMutation({
    mutationFn: async () => publikasiMateri(materi.id),
    onSuccess: () => {
      setGalat('')
      tampilkanToast('sukses', 'Materi terbit untuk murid kelas ini.')
      onTersimpan()
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  const unggah = useMutation({
    mutationFn: async (/** @type {{ indeks: number, berkas: File }} */ variabel) =>
      unggahBerkas(materi.id, variabel.berkas, { onProgres: setProgresUnggah }),      onSuccess: (berkasJadi, variabel) => {
      setProgresUnggah(0)
      // Sebelumnya pesan ini menyebut semua berkas non-gambar sebagai "berisiko
      // (.upload)" — padahal PDF/Word/PowerPoint justru bahan ajar yang lazim
      // (14 Oktober 2026). Sekarang pesannya mengikuti cara sajiannya.
      setBlok((sebelum) =>
        sebelum.map((satu, urutan) =>
          urutan === variabel.indeks ? { ...satu, unggahan_kode: berkasJadi.kode } : satu,
        ),
      )
      onTersimpan()
      tampilkanToast(
        'sukses',
        berkasJadi.sajian === 'dokumen'
          ? `Dokumen ${labelDokumen(berkasJadi)} siap dibuka murid.`
          : berkasJadi.tampil_langsung
            ? 'Berkas siap ditampilkan.'
            : 'Berkas berisiko: murid akan mengunduhnya (.upload).',
      )
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  /**
   * Buang satu berkas dari pustaka materi — berkas nyatanya, bukan cuma klipnya.
   *
   * Sesudah server membuang berkas + seluruh rujukannya, susunan yang belum
   * tersimpan di layar ikut dibersihkan (`lepasBerkas`) supaya yang dilihat guru
   * sama dengan yang akan tersimpan: klip media yang menunjuk berkas hilang akan
   * membuat Simpan ditolak server, jadi membiarkannya di layar justru menipu.
   */
  const buangBerkas = useMutation({
    mutationFn: (/** @type {string} */ kode) => hapusUnggahan(kode),
    onSuccess: (hasil, kode) => {
      // Susunan terbaru dibaca dari ref (bukan dari closure render) supaya
      // penghapusan tetap benar meski guru menggeser klip selagi menunggu.
      const sesudah = lepasBerkas(blokRef.current, kode)

      setGalat('')
      setBlok(sesudah.blok)
      setTerpilih((sebelum) => Math.max(0, Math.min(sebelum, Math.max(sesudah.blok.length - 1, 0))))
      // Video latar tema yang berkasnya dibuang tidak bisa dipakai lagi.
      setVideoKode((sebelum) => (sebelum === kode ? '' : sebelum))
      setBerkasDibuang(null)
      tampilkanToast('sukses', ringkasanBuangBerkas(hasil))
      onTersimpan()
    },
    onError: (error) => {
      setBerkasDibuang(null)
      setGalat(pesanGalatApi(error))
    },
  })

  const total = durasiTotal(blok)

  // Jaga ref waktu tetap sinkron agar interval tidak membaca state basi.
  useEffect(() => {
    detikRef.current = detik
  }, [detik])

  useEffect(() => {
    blokRef.current = blok
  }, [blok])

  // Playback: maju 0,25 detik tiap 250 ms, lalu berhenti di ujung timeline.
  // Penghentian terjadi di dalam callback interval (bukan badan efek) supaya
  // tidak memicu render berantai.
  useEffect(() => {
    if (!bermain) return undefined

    const id = window.setInterval(() => {
      const dari = detikRef.current
      const lanjut = Math.min(total, Math.round((dari + 0.25) * 100) / 100)

      // Kuis bermode "jeda": video berhenti tepat di titik kuis sampai dilanjutkan.
      const henti = kuisJeda(blokRef.current, dari, lanjut, dilewatiRef.current)

      if (henti) {
        window.clearInterval(id)
        detikRef.current = henti.baris.mulai_detik
        setDetik(henti.baris.mulai_detik)
        setKuisTertahan(henti.indeks)
        setBermain(false)
        return
      }

      detikRef.current = lanjut
      setDetik(lanjut)

      if (lanjut >= total) {
        window.clearInterval(id)
        setBermain(false)
      }
    }, 250)

    return () => window.clearInterval(id)
  }, [bermain, total])

  /**
   * Pindahkan jarum merah (playhead) ke detik tertentu.
   * @param {number} nilai
   */
  function cari(nilai) {
    const aman = Math.min(total, Math.max(0, Math.round(nilai * 100) / 100))
    dilewatiRef.current.clear()
    setKuisTertahan(null)
    detikRef.current = aman
    setDetik(aman)
  }

  function lanjutkanKuis() {
    if (kuisTertahan !== null) dilewatiRef.current.add(kuisTertahan)
    setKuisTertahan(null)
    setBermain(true)
  }

  /** @param {import('react').PointerEvent<HTMLElement>} e */
  function geserJarum(e) {
    const kotak = penggarisRef.current?.getBoundingClientRect()
    if (kotak) cari(detikDariX(e.clientX, kotak, total))
  }

  // Dipakai penggaris dan kepala jarum: tekan lalu seret untuk memilih detik.
  const gagangJarum = {
    onPointerDown: (/** @type {import('react').PointerEvent<HTMLElement>} */ e) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      sedangGeserRef.current = true
      geserJarum(e)
    },
    onPointerMove: (/** @type {import('react').PointerEvent<HTMLElement>} */ e) => {
      if (sedangGeserRef.current) geserJarum(e)
    },
    onPointerUp: (/** @type {import('react').PointerEvent<HTMLElement>} */ e) => {
      sedangGeserRef.current = false
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    },
    onPointerCancel: () => {
      sedangGeserRef.current = false
    },
  }

  /**
   * Geseran gagang pangkas → titik mulai/ujung klip yang sedang dipilih.
   * @param {number} klienX
   */
  function geserPangkas(klienX) {
    const sisi = pangkasRef.current
    const kotak = relRef.current?.getBoundingClientRect()
    if (sisi === null || !kotak) return

    const detikBaru = detikDariX(klienX, kotak, pangkasTotalRef.current)
    setBlok((sebelum) =>
      sisi === 'kiri'
        ? pangkasKiri(sebelum, aktif, detikBaru)
        : pangkasKanan(sebelum, aktif, detikBaru),
    )
  }

  /**
   * Properti seret gagang pangkas (mirip `gagangJarum`, tetapi hanya sisi yang
   * sedang dipegang yang bergerak). Panjang timeline dibekukan saat mulai seret
   * supaya pangkas tidak berubah-ubah karena penggaris ikut memanjang.
   * @param {'kiri'|'kanan'} sisi
   */
  function seretPangkas(sisi) {
    return {
      onPointerDown: (/** @type {import('react').PointerEvent<HTMLElement>} */ e) => {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        pangkasRef.current = sisi
        pangkasTotalRef.current = total
        geserPangkas(e.clientX)
      },
      onPointerMove: (/** @type {import('react').PointerEvent<HTMLElement>} */ e) => {
        if (pangkasRef.current === null) return
        e.preventDefault()
        geserPangkas(e.clientX)
      },
      onPointerUp: (/** @type {import('react').PointerEvent<HTMLElement>} */ e) => {
        if (pangkasRef.current === null) return
        pangkasRef.current = null
        e.currentTarget.releasePointerCapture?.(e.pointerId)
      },
      onPointerCancel: () => {
        pangkasRef.current = null
      },
      // Gagang ada di dalam lane yang detaknya bisa dipakai menyeret klip.
      onClick: (/** @type {import('react').MouseEvent<HTMLElement>} */ e) => e.stopPropagation(),
    }
  }

  /**
   * Pangkas lewat papan tombol (gagang juga harus bisa dipakai tanpa tetikus).
   * @param {'kiri'|'kanan'} sisi
   * @param {import('react').KeyboardEvent<HTMLElement>} e
   */
  function tekanPangkas(sisi, e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

    e.preventDefault()
    const baris = blok[aktif]
    if (baris === undefined) return

    const arah = e.key === 'ArrowLeft' ? -LANGKAH_TIPIS : LANGKAH_TIPIS
    setBlok((sebelum) =>
      sisi === 'kiri'
        ? pangkasKiri(sebelum, aktif, baris.mulai_detik + arah)
        : pangkasKanan(sebelum, aktif, baris.mulai_detik + baris.durasi_detik + arah),
    )
  }

  /** @param {number} indeks @param {Partial<import('./editorMateri.js').BarisBlok>} ubah */
  function ubahBaris(indeks, ubah) {
    setBlok((sebelum) =>
      sebelum.map((satu, urutan) => (urutan === indeks ? { ...satu, ...ubah } : satu)),
    )
  }

  /**
   * Sisipkan satu klip baru, pilih baris itu, dan kembalikan indeksnya.
   * @param {import('./editorMateri.js').TipeBlok} tipe
   * @param {Partial<import('./editorMateri.js').BarisBlok>} [isi]
   * @returns {number}
   */
  function tambahBlok(tipe, isi) {
    const dasar = tipe === 'kuis' ? { track: 1 } : {}
    const hasil = sisipBlok(blok, blokBaru(tipe, { mulai_detik: detik, ...dasar, ...isi }))
    setBlok(hasil.blok)
    setTerpilih(hasil.indeks)
    setMenuTambah(false)

    return hasil.indeks
  }

  /**
   * Unggah berkas ke satu klip media. Setelah terkirim, panjang klip mengikuti
   * berkasnya sendiri (video/audio) — bukan 10 detik bawaan — supaya penggaris
   * timeline dan tombol play sesuai isi sungguhan. Durasi yang sudah diatur guru
   * (bukan bawaan) tidak ditimpa.
   * @param {number} indeks
   * @param {File} berkas
   */
  function unggahKeKlip(indeks, berkas) {
    // Satu klip satu sumber: berkas baru menggantikan tautan yang mungkin masih
    // menempel di klip itu.
    setBlok((sebelum) =>
      sebelum.map((satu, urutan) => (urutan === indeks && satu.tautan !== '' ? { ...satu, tautan: '' } : satu)),
    )
    unggah.mutate({ indeks, berkas })

    void bacaDurasiBerkas(berkas).then((durasi) => {
      if (durasi === null) return

      setBlok((sebelum) => {
        const baris = sebelum[indeks]

        return baris !== undefined && baris.tipe === 'media' && baris.durasi_detik === DURASI_BAWAAN
          ? setDurasi(sebelum, indeks, durasi)
          : sebelum
      })
    })
  }

  /** Impor media: sisipkan klip media lalu unggah berkas ke klip itu. @param {File} berkas */
  function imporMedia(berkas) {
    unggahKeKlip(tambahBlok('media'), berkas)
  }

  /**
   * Sisipkan klip media dari **tautan** (tanpa unggahan). Aturannya satu sumber
   * di `tautanMedia.js` (cermin aturan server); server tetap yang memutuskan.
   * @param {string} tautan
   * @returns {number|null} indeks klip baru, atau `null` bila tautannya belum sah
   */
  function imporMediaTautan(tautan) {
    const pesan = pesanGalatTautan(tautan)
    setGalatTautanBaru(pesan)

    if (pesan !== '') return null

    const indeks = tambahBlok('media', { tautan: tautan.trim() })
    setTautanBaru('')

    return indeks
  }

  /**
   * Pakai tautan untuk klip terpilih. Klip media hanya punya SATU sumber: tautan
   * menggantikan berkas unggahan (dan sebaliknya) supaya tidak ada dua alamat
   * yang saling bertentangan di satu klip.
   * @param {number} indeks
   * @param {string} tautan
   */
  function pakaiTautan(indeks, tautan) {
    const pesan = pesanGalatTautan(tautan)
    setGalatTautanKlip(pesan)

    if (pesan !== '') return

    ubahBaris(indeks, { tautan: tautan.trim(), unggahan_kode: '' })
    setTautanKlip('')
  }

  /**
   * Apakah seretan ini membawa berkas (bukan klip timeline)?
   * @param {import('react').DragEvent} e
   * @returns {boolean}
   */
  function adaBerkasSeret(e) {
    return Array.from(e.dataTransfer?.types ?? []).includes('Files')
  }

  /**
   * Berkas dijatuhkan di panel editor: klip yang dijatuhi ditukar berkasnya,
   * selain itu dibuat klip media baru. Aturan keputusannya murni di
   * `rencanaLepasBerkas` (editorMateri.js) supaya bisa diuji tanpa DOM.
   * @param {import('react').DragEvent<HTMLDivElement>} e
   */
  function lepasBerkasKeEditor(e) {
    if (!adaBerkasSeret(e)) return

    e.preventDefault()
    setSeretBerkas(false)

    const berkas = Array.from(e.dataTransfer?.files ?? [])
    const klip = /** @type {HTMLElement} */ (e.target).closest?.('.nle-klip')
    const indeksKlip = klip instanceof HTMLElement ? Number(klip.dataset.indeks) : Number.NaN
    const rencana = rencanaLepasBerkas(
      Number.isInteger(indeksKlip) && indeksKlip >= 0 && indeksKlip < blok.length ? indeksKlip : null,
      berkas.length,
    )

    if (rencana.aksi === 'tolak') {
      tampilkanToast('peringatan', rencana.pesan)
      return
    }

    if (rencana.aksi === 'tukar') {
      unggahKeKlip(/** @type {number} */ (rencana.indeks), berkas[0])
      return
    }

    imporMedia(berkas[0])
  }

  /**
   * Sisipkan berkas pustaka sebagai klip media baru. Durasinya dibaca dari
   * berkasnya sendiri supaya klip langsung sepanjang videonya.
   * @param {import('./api.js').DataUnggahan} satu
   */
  function sisipkanMedia(satu) {
    const indeks = tambahBlok('media', { unggahan_kode: satu.kode })

    if (satu.url === null) return

    void bacaDurasiMedia(satu.url).then((durasi) => {
      if (durasi !== null) setBlok((sebelum) => setDurasi(sebelum, indeks, durasi))
    })
  }

  const berkasSiap = (materi.unggahan ?? []).filter((satu) => satu.status === 'selesai')

  const cariUnggahan = (/** @type {string} */ kode) =>
    berkasSiap.find((satu) => satu.kode === kode)

  // Dampak yang akan terjadi bila berkas di dialog konfirmasi benar-benar
  // dibuang — dihitung dari susunan di layar, jadi angkanya sama dengan yang
  // dibaca guru di pustaka media.
  const pemakaiBerkasDibuang =
    berkasDibuang === null ? { klip: 0, penjelasan: 0 } : pemakaiBerkas(blok, berkasDibuang.kode)

  const daftarTema = katalog.data?.tema ?? []
  const videoTema = berkasSiap.find((satu) => satu.kode === videoKode)
  // Tema yang sedang dipakai: pilihan lokal dulu (belum tentu tersimpan), lalu
  // konfigurasi dari server untuk materi yang sudah punya tema.
  const temaAktif = daftarTema.find((satu) => satu.kode === temaKode) ?? materi.perjalanan

  // Pratinjau peta dihitung dari klip yang BELUM disimpan, jadi guru langsung
  // melihat hasil penamaan pos tanpa menekan Simpan dulu. Hitungannya murah
  // (hanya menyusun nama pos), jadi tidak perlu memo manual.
  const petaPratinjau = petaLokal(blok, temaAktif, {
    nama: temaNama,
    videoUrl: videoTema?.tampil_langsung ? videoTema.url : null,
  })

  /**
   * Pasang satu template tema: nama tema + nama bawaan setiap pos.
   * @param {import('./perjalanan.js').DataTemaKatalog} satu
   */
  function pakaiTema(satu) {
    setTemaKode(satu.kode)
    setTemaNama(satu.nama)
    setBlok((sebelum) => terapkanTema(sebelum, satu))
  }

  const aktif = Math.min(terpilih, Math.max(blok.length - 1, 0))
  const klipAktif = blok[aktif]

  /**
   * Hapus klip ke-`indeks` lalu jaga pilihannya tetap masuk akal: klip di
   * belakang yang terpilih ikut bergeser satu, dan bila yang dihapus klip
   * terakhir pilihannya mundur. Satu perilaku dipakai dua jalan — tombol ✕ di
   * timeline dan tombol "Hapus klip" di inspector.
   *
   * @param {number} indeks
   */
  function hapusKlip(indeks) {
    setBlok((sebelum) => sebelum.filter((_, urutan) => urutan !== indeks))
    setTerpilih((sebelum) => {
      const bergeser = sebelum > indeks ? sebelum - 1 : sebelum

      return Math.max(0, Math.min(bergeser, Math.max(blok.length - 2, 0)))
    })
  }

  /**
   * Papan tombol di dalam editor: **Delete/Backspace** membuang klip yang sedang
   * dipilih — jalan yang sama dengan tombol ✕ di timeline dan "Hapus klip" di
   * inspector, supaya guru yang bekerja dengan papan tombol (mis. setelah
   * menyeret klip) tidak perlu memindahkan tangan ke tetikus.
   *
   * Dipasang di akar editor, bukan di `window`: tombolnya hanya berlaku saat
   * fokus memang berada di dalam editor. Saat fokus ada di kolom isian (teks,
   * angka, pemilih) tombol dibiarkan apa adanya — di sana Delete untuk menghapus
   * karakter, bukan untuk membuang klip.
   *
   * @param {import('react').KeyboardEvent<HTMLDivElement>} e
   */
  function tekanPapanTombol(e) {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (blok.length === 0) return

    // Dialog konfirmasi yang sedang terbuka memegang papan tombol: Delete di sana
    // milik dialognya, bukan milik timeline yang ada di belakangnya.
    if (e.currentTarget.querySelector('dialog[open]') !== null) return

    const sasaran = e.target

    if (sasaran instanceof HTMLElement) {
      const tag = sasaran.tagName

      if (sasaran.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }
    }

    e.preventDefault()
    hapusKlip(aktif)
  }

  const track = useMemo(() => susunTrack(blok), [blok])
  const trackTampil = useMemo(() => [...track].reverse(), [track])
  const klipTampil = klipDasarPada(blok, detik)

  // Lapisan kuis: yang sedang menahan video, atau kuis "berjalan" di jendelanya.
  // Kuis "jeda" juga dipratinjau saat klipnya dipilih dan pemutaran dijeda.
  const kuisLapisan = (() => {
    if (kuisTertahan !== null && blok[kuisTertahan]) {
      return { baris: blok[kuisTertahan], indeks: kuisTertahan }
    }

    const dalam = kuisPadaWaktu(blok, detik).filter(
      ({ baris, indeks }) =>
        tampilanKlip(baris).mode === 'berjalan' || (!bermain && indeks === aktif),
    )

    return dalam.length === 0 ? null : dalam[dalam.length - 1]
  })()

  const belumTersimpan =
    JSON.stringify(muatanBlok(blok)) !== JSON.stringify(muatanBlok(dariServer(materi.blok))) ||
    temaKode !== (materi.tema?.kode ?? materi.perjalanan?.kode ?? '') ||
    temaNama !== (materi.tema?.nama ?? materi.perjalanan?.nama ?? '') ||
    videoKode !== (materi.tema?.video_kode ?? '')

  // Penjaga "belum tersimpan" (temuan K3): editor materi tidak punya autosave,
  // jadi menutup/ menyegarkan halaman dengan perubahan tertahan wajib ditanya
  // dulu. Keluar lewat tombol "Daftar materi" memakai dialog yang sama.
  usePenjagaSebelumTutup(belumTersimpan && !simpanBlok.isPending && !terbitkan.isPending)

  /** Keluar ke daftar materi — dengan konfirmasi bila ada perubahan tertahan. */
  function cobaKeluar() {
    if (belumTersimpan) {
      setDialogKeluar(true)
      return
    }

    void navigasi(RUTE.materi)
  }

  const tandaDetik = useMemo(() => {
    const langkah = total <= 120 ? 5 : total <= 300 ? 10 : 30
    /** @type {number[]} */
    const daftar = []

    for (let t = 0; t <= total; t += langkah) daftar.push(t)

    return daftar
  }, [total])

  const posisiPersen = (/** @type {number} */ nilai) => `${(nilai / total) * 100}%`

  /**
   * Lepas klip di lane lain: pindah track + mulai sesuai posisi X.
   * @param {import('react').DragEvent<HTMLDivElement>} e
   * @param {number} trackTujuan
   */
  function lepasKlip(e, trackTujuan) {
    e.preventDefault()
    const indeks = Number(e.dataTransfer?.getData('text/klip') ?? '')

    if (!Number.isInteger(indeks) || indeks < 0 || indeks >= blok.length) return

    const kotak = /** @type {HTMLElement} */ (e.currentTarget).getBoundingClientRect()
    const rasio = kotak.width === 0 ? 0 : (e.clientX - kotak.left) / kotak.width
    const mulai = Math.max(0, Math.round(rasio * total * 10) / 10)

    setBlok((sebelum) =>
      setMulai(
        sebelum.map((satu, urutan) =>
          urutan === indeks ? { ...satu, track: trackTujuan } : satu,
        ),
        indeks,
        mulai,
      ),
    )
    setTerpilih(indeks)
  }

  // Lane tampil = track berisi klip + track kosong yang sengaja ditambahkan.
  const jumlahTrackTampil = trackTampil.length + trackEkstra

  return (
    <div
      className={`nle${seretBerkas ? ' nle-sedang-seret' : ''}`}
      onKeyDown={tekanPapanTombol}
      // Berkas boleh dijatuhkan DI SELURUH panel editor (14 Okt 2026). Seretan
      // klip di timeline tetap ditangani lane-nya sendiri (`lepasKlip`), karena
      // seretan itu membawa `text/klip` — bukan berkas.
      onDragOver={(e) => {
        if (!adaBerkasSeret(e)) return
        e.preventDefault()
        setSeretBerkas(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setSeretBerkas(false)
      }}
      onDrop={lepasBerkasKeEditor}
    >
      {/* Bar aksi lengket (14 Oktober 2026, temuan K2): Simpan & Terbitkan dulu
        * terkubur di dasar sidebar — di bawah "Tambah elemen", "Selipkan dari
        * tautan", "Template tema", "Nama tema", dan "Latar tema" — sehingga di
        * layar sempit guru harus menggulir jauh untuk menyimpan. Kini keduanya
        * ada di bilah atas yang selalu terlihat, bersama status "Belum
        * tersimpan" yang tidak lagi kecil terlewat. */}
      <div className="bar-susun nle-bar">
        <Tombol varian="tepi" ukuran="sedang" ikon={IkonPanahKiri} onClick={cobaKeluar}>
          Daftar materi
        </Tombol>
        <span className="fw-semibold teks-patah">{materi.judul}</span>
        <span className="badge-status lembut">{materi.status_label ?? materi.status}</span>
        {belumTersimpan && (
          <span className="badge-status peringatan" data-belum-tersimpan="1">
            Belum tersimpan
          </span>
        )}
        <div className="d-flex flex-wrap gap-2 ms-md-auto">
          <Tombol
            ukuran="sedang"
            memuat={simpanBlok.isPending}
            onClick={() => simpanBlok.mutate()}
          >
            Simpan
          </Tombol>
          <Tombol
            varian="tepi"
            ukuran="sedang"
            memuat={terbitkan.isPending}
            disabled={blok.length === 0}
            onClick={() => terbitkan.mutate()}
          >
            Terbitkan
          </Tombol>
        </div>
      </div>

      {/* ===== Sidebar: tools + template ===== */}
      <aside className="nle-sidebar">
        <div className="mb-3">
          <h2 className="nle-judul mb-0">Materi ini</h2>
          <p className="small teks-lembut mb-0">
            {materi.mapel_nama ?? '—'} · {materi.kelas_nama ?? '—'}
          </p>
        </div>

        <h2 className="nle-judul">Tambah elemen</h2>
        <div className="d-grid gap-2 mb-3">
          <button type="button" className="nle-tool" onClick={() => inputBerkas.current?.click()}>
            ▶ <span>Impor media</span>
          </button>
          <input
            ref={inputBerkas}
            className="d-none"
            type="file"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const berkas = e.target.files?.[0]
              if (berkas) imporMedia(berkas)
              e.target.value = ''
            }}
          />
          {TIPE_BLOK.filter((satu) => satu.nilai !== 'media').map((satu) => (
            <button
              key={satu.nilai}
              type="button"
              className="nle-tool"
              onClick={() => tambahBlok(satu.nilai)}
            >
              {satu.ikon} <span>{satu.label}</span>
            </button>
          ))}
        </div>

        {/* Sumber kedua klip media: tautan, tanpa mengunggah berkas apa pun. */}
        <h2 className="nle-judul">Selipkan dari tautan</h2>
        <div className="mb-3">
          <label className="form-label small mb-1" htmlFor="nle-tautan-baru">
            Tempelkan alamat YouTube, Google Drive, atau berkas media
          </label>
          <input
            id="nle-tautan-baru"
            className="form-control form-control-sm"
            inputMode="url"
            value={tautanBaru}
            onChange={(e) => setTautanBaru(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
          <Tombol
            varian="tepi"
            ukuran="sedang"
            className="mt-2"
            disabled={pesanGalatTautan(tautanBaru) !== ''}
            onClick={() => imporMediaTautan(tautanBaru)}
          >
            Selipkan klip tautan
          </Tombol>
          {galatTautanBaru !== '' && <p className="small text-danger mb-0 mt-1">{galatTautanBaru}</p>}
          <p className="small teks-lembut mb-0 mt-1">
            Bingkai YouTube/Google Drive dipasang di alamat resminya oleh server. Berkas yang
            tersimpan di Drive harus dibagikan “siapa saja yang punya tautan”.
          </p>
        </div>

        <h2 className="nle-judul">Template tema</h2>
        <p className="small teks-lembut mb-2">
          Opsional — pilih template bila materi ingin tampil sebagai perjalanan berpeta, atau pilih
          “Tanpa tema” untuk daftar bagian biasa.
        </p>
        {katalog.isLoading && <p className="small teks-lembut">Memuat template…</p>}
        {katalog.isError && (
          <Banner jenis="salah">Gagal memuat template tema. Muat ulang halaman.</Banner>
        )}
        <div className="d-grid gap-2 mb-3">
          {daftarTema.map((satu) => (
            <button
              key={satu.kode}
              type="button"
              className={`nle-template${temaKode === satu.kode ? ' aktif' : ''}`}
              aria-pressed={temaKode === satu.kode}
              onClick={() => pakaiTema(satu)}
            >
              <span className="fw-semibold small d-block">{satu.nama}</span>
              <span className="small teks-lembut d-block">{satu.deskripsi}</span>
              <span className="small teks-lembut d-block">
                {satu.fase.length === 0
                  ? 'Daftar bagian biasa'
                  : `${satu.fase.length} fase · ${satu.tingkat.length} tingkat`}
              </span>
            </button>
          ))}
        </div>

        <label className="form-label small mb-1" htmlFor="nle-tema-nama">
          Nama tema (boleh diganti)
        </label>
        <input
          id="nle-tema-nama"
          className="form-control form-control-sm"
          value={temaNama}
          maxLength={60}
          disabled={tanpaPeta(petaPratinjau)}
          onChange={(e) => setTemaNama(e.target.value)}
        />

        <label className="form-label small mb-1 mt-2" htmlFor="nle-tema-video">
          Latar tema
        </label>
        <select
          id="nle-tema-video"
          className="form-select form-select-sm"
          value={videoKode}
          disabled={tanpaPeta(petaPratinjau)}
          onChange={(e) => setVideoKode(e.target.value)}
        >
          <option value="">Animasi bawaan (tanpa video)</option>
          {berkasSiap
            .filter((satu) => (satu.mime ?? '').startsWith('video/'))
            .map((satu) => (
              <option key={satu.kode} value={satu.kode}>
                {satu.nama_asli} · {satu.ukuran_manusia}
              </option>
            ))}
        </select>
        {tanpaPeta(petaPratinjau) && (
          <p className="small teks-lembut mb-0 mt-1">
            Materi ini berjalan sebagai daftar bagian biasa: tidak ada peta, pos, atau tingkat. Nama
            tema dan latar tidak dipakai.
          </p>
        )}
        {!tanpaPeta(petaPratinjau) && videoKode !== '' && !videoTema?.tampil_langsung && (
          <p className="small teks-lembut mb-0 mt-1">
            Video itu belum selesai diunggah, jadi animasi bawaan yang dipakai.
          </p>
        )}

        <p className="small teks-lembut mt-3 mb-0">
          Simpan &amp; Terbitkan ada di bilah atas supaya selalu terjangkau, bahkan di layar sempit.
        </p>
      </aside>

      {/* Penjaga "belum tersimpan" (temuan K3) untuk tombol keluar di layar. */}
      <DialogKonfirmasi
        buka={dialogKeluar}
        judul={JUDUL_BELUM_TERSIMPAN}
        labelYa="Buang perubahan"
        bahaya
        onYa={() => {
          setDialogKeluar(false)
          void navigasi(RUTE.materi)
        }}
        onBatal={() => setDialogKeluar(false)}
      >
        <p className="mb-0">{PESAN_BELUM_TERSIMPAN}</p>
      </DialogKonfirmasi>

      {/* ===== Area kerja: canvas → playback → timeline ===== */}
      <div className="nle-kerja">
        {galat && <Banner jenis="salah">{galat}</Banner>}

        <PetaPerjalanan
          perjalanan={petaPratinjau}
          judul={tanpaPeta(petaPratinjau) ? undefined : temaNama}
        />

        <div className="nle-canvas" aria-label="Pratinjau hasil">
          <div className="nle-bingkai">
            <div className="nle-canvas-isi">
              {klipTampil ? (
                <IsiKlip
                  satu={klipTampil}
                  cariUnggahan={cariUnggahan}
                  daftarKuis={daftarKuis}
                  bermain={bermain}
                  detik={detik}
                />
              ) : (
                <p className="teks-lembut mb-0 text-center">
                  Tidak ada klip pada detik {formatWaktu(detik)}. Geser jarum merah atau tambah elemen.
                </p>
              )}
            </div>
            {kuisLapisan && (
              <LapisanKuis
                klip={kuisLapisan.baris}
                kuis={daftarKuis.find((k) => String(k.id) === String(kuisLapisan.baris.quiz_id))}
                tertahan={kuisTertahan !== null}
                onLanjut={lanjutkanKuis}
              />
            )}
          </div>
          <div className="nle-canvas-catatan small teks-lembut">
            {klipTampil ? `Klip aktif · track ${klipTampil.track}` : 'Layar kosong'} · bingkai 16:9
          </div>
        </div>

        <div className="nle-playback">
          <span className="nle-waktu" aria-label="Waktu saat ini">
            {formatWaktu(detik)}
          </span>
          <button
            type="button"
            className="nle-play"
            aria-label={bermain ? 'Jeda' : 'Putar'}
            onClick={() => {
              if (kuisTertahan !== null) {
                lanjutkanKuis()
                return
              }
              if (!bermain && detik >= total) cari(0)
              setBermain((satu) => !satu)
            }}
          >
            {bermain ? '❚❚' : '▶'}
          </button>
          <span className="nle-waktu" aria-label="Durasi total">
            {formatWaktu(total)}
          </span>
          <input
            className="nle-scrub"
            type="range"
            min={0}
            max={total}
            step={0.1}
            value={detik}
            aria-label="Geser waktu"
            onChange={(e) => cari(Number(e.target.value))}
          />
          <button
            type="button"
            className="nle-tool-kecil"
            aria-label="Mundur 0,1 detik"
            onClick={() => cari(detik - 0.1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="nle-tool-kecil"
            aria-label="Maju 0,1 detik"
            onClick={() => cari(detik + 0.1)}
          >
            ›
          </button>
          <button
            type="button"
            className="nle-tool-kecil nle-tool-kuis"
            onClick={() => tambahBlok('kuis')}
          >
            ? Kuis di {detik.toFixed(1)} dtk
          </button>
        </div>

        <div className="nle-timeline" aria-label="Timeline materi">
          <div className="nle-ruler" ref={penggarisRef} {...gagangJarum}>
            {tandaDetik.map((t) => (
              <span
                key={t}
                className={`nle-tanda${t % (tandaDetik.length > 12 ? 30 : 10) === 0 ? ' nle-tanda-kuat' : ''}`}
                style={{ left: posisiPersen(t) }}
              >
                {formatWaktu(t)}
              </span>
            ))}
          </div>

          <div className="nle-lane-wrap" ref={relRef}>
            <div className="nle-playhead" style={{ left: posisiPersen(detik) }}>
              <span
                className="nle-playhead-kepala"
                role="slider"
                tabIndex={0}
                aria-label="Jarum waktu: seret atau tekan panah kiri/kanan"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={detik}
                aria-valuetext={`${detik.toFixed(1)} detik`}
                {...gagangJarum}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault()
                    cari(detik - 0.1)
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault()
                    cari(detik + 0.1)
                  }
                }}
              />
            </div>

            {trackTampil.map((satu) => (
              <div
                key={`track-${satu.track}`}
                className="nle-lane"
                data-track={satu.track}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => lepasKlip(e, satu.track)}
              >
                <span className="nle-lane-label">V{satu.track + 1}</span>
                {satu.klip.map(({ baris, indeks }) => {
                  const ciri = ciriKlip(baris.tipe)

                  return (
                    <button
                      type="button"
                      key={`klip-${indeks}`}
                      // `data-indeks` dipakai saat BERKAS dijatuhkan di atas klip
                      // (tukar berkas), sedangkan `text/klip` mengangkut nomor
                      // klip saat klipnya sendiri yang diseret.
                      data-indeks={indeks}
                      className={`nle-klip nle-klip-${baris.tipe}${indeks === aktif ? ' nle-klip-aktif' : ''}`}
                      style={{
                        left: posisiPersen(baris.mulai_detik),
                        width: posisiPersen(baris.durasi_detik),
                      }}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/klip', String(indeks))}
                      onClick={() => setTerpilih(indeks)}
                      title="Pilih klip ini, lalu tombol Delete di papan tombol membuangnya"
                      aria-label={`Klip ${indeks + 1}: ${ciri.label} mulai detik ${baris.mulai_detik}, durasi ${baris.durasi_detik} detik`}
                    >
                      <span className="nle-klip-judul" aria-hidden="true">
                        {ciri.ikon} {ciri.label}
                        {baris.tipe === 'kuis' && tampilanKlip(baris).mode === 'jeda' ? ' ⏸' : ''}
                      </span>
                    </button>
                  )
                })}
                {/*
                  Tombol hapus klip terpilih, langsung di timeline (tidak perlu
                  mencari inspector dulu). Diletakkan di lane, DI LUAR kotak klip:
                  klipnya sendiri sebuah <button>, jadi kontrol bersarang di
                  dalamnya tidak sah dan kliknya tidak sampai. Jaraknya diberi
                  celah dari tepi klip supaya tidak tertukar dengan tanda pangkas
                  `|` yang duduk tepat di tepi klip.
                */}
                {klipAktif && satu.track === klipAktif.track && (
                  <button
                    type="button"
                    className="nle-klip-hapus"
                    style={{ left: posisiPersen(klipAktif.mulai_detik + klipAktif.durasi_detik) }}
                    title="Hapus klip yang sedang dipilih (bisa juga dengan tombol Delete)"
                    aria-label={`Hapus klip ${aktif + 1}: ${ciriKlip(klipAktif.tipe).label}`}
                    onClick={() => hapusKlip(aktif)}
                  >
                    ✕
                  </button>
                )}
                {/*
                  Gagang pangkas `|` di kedua sisi klip yang sedang dipilih.
                  Sengaja diletakkan di lane (bukan di dalam tombol klip) supaya
                  tidak ada kontrol interaktif bersarang di dalam tombol — dan
                  supaya seretannya tidak bertabrakan dengan seret-klip native.
                */}
                {klipAktif && satu.track === klipAktif.track && (
                  <span
                    className="nle-pangkas-grup"
                    style={{
                      left: posisiPersen(klipAktif.mulai_detik),
                      width: posisiPersen(klipAktif.durasi_detik),
                    }}
                  >
                    {SISI_PANGKAS.map((sisi) => (
                      <span
                        key={sisi}
                        className={`nle-pangkas nle-pangkas-${sisi}`}
                        role="slider"
                        tabIndex={0}
                        title="Seret tanda | untuk mengubah awal/akhir klip"
                        aria-label={`${sisi === 'kiri' ? 'Titik mulai' : 'Titik akhir'} klip ${aktif + 1}`}
                        aria-valuemin={0}
                        aria-valuemax={total}
                        aria-valuenow={sisi === 'kiri' ? klipAktif.mulai_detik : ujungKlip(klipAktif)}
                        aria-valuetext={
                          sisi === 'kiri'
                            ? `${klipAktif.mulai_detik} detik`
                            : `${ujungKlip(klipAktif)} detik`
                        }
                        {...seretPangkas(sisi)}
                        onKeyDown={(e) => tekanPangkas(sisi, e)}
                      />
                    ))}
                  </span>
                )}

                {satu.klip.length === 0 && <span className="nle-lane-kosong">kosong</span>}
              </div>
            ))}

            {Array.from({ length: trackEkstra }).map((_, nomor) => {
              const nomorTrack = trackTampil.length + nomor

              return (
                <div
                  key={`track-extra-${nomorTrack}`}
                  className="nle-lane nle-lane-baru"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => lepasKlip(e, nomorTrack)}
                >
                  <span className="nle-lane-label">V{nomorTrack + 1}</span>
                  <span className="nle-lane-kosong">track baru</span>
                </div>
              )
            })}

            {/* Track audio selalu paling bawah. */}
            <div className="nle-lane nle-lane-audio" aria-label="Track audio">
              <span className="nle-lane-label">A1</span>
              <span className="nle-lane-kosong">audio (belum ada klip)</span>
            </div>

            <button
              type="button"
              className="nle-plus"
              aria-label="Tambah elemen atau track"
              aria-expanded={menuTambah}
              onClick={() => setMenuTambah((satu) => !satu)}
            >
              +
            </button>

            {menuTambah && (
              <div className="nle-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => inputBerkas.current?.click()}>
                  Impor media
                </button>
                {TIPE_BLOK.filter((satu) => satu.nilai !== 'media').map((satu) => (
                  <button
                    key={satu.nilai}
                    type="button"
                    role="menuitem"
                    onClick={() => tambahBlok(satu.nilai)}
                  >
                    {satu.label}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setTrackEkstra((satu) => satu + 1)
                    setMenuTambah(false)
                  }}
                >
                  Track baru
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ===== Inspector klip terpilih ===== */}
        {klipAktif && (
          <div className="nle-inspector">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <strong className="small">Klip {aktif + 1}</strong>
              <span className="badge-status lembut">{klipAktif.tipe}</span>
              {/* Pola .form-check seperti di halaman lain: labelnya ikut menghitung
               * sasaran sentuh 44 px, sedangkan kotak centangnya sendiri cuma 23 px. */}
              <div className="form-check form-check-inline ms-auto mb-0">
                <input
                  id="nle-wajib"
                  className="form-check-input"
                  type="checkbox"
                  checked={klipAktif.wajib}
                  onChange={(e) => ubahBaris(aktif, { wajib: e.target.checked })}
                />
                <label className="form-check-label small" htmlFor="nle-wajib">
                  wajib
                </label>
              </div>
              <Tombol
                varian="teks"
                ukuran="sedang"
                title="Bisa juga dengan tombol Delete saat klipnya terpilih"
                onClick={() => hapusKlip(aktif)}
              >
                Hapus klip
              </Tombol>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-6 col-lg-3">
                <label className="form-label small mb-1" htmlFor="nle-mulai">
                  Mulai (detik)
                </label>
                <input
                  id="nle-mulai"
                  className="form-control form-control-sm"
                  type="number"
                  min={0}
                  step={LANGKAH_WAKTU}
                  value={klipAktif.mulai_detik}
                  onChange={(e) => setBlok(setMulai(blok, aktif, Number(e.target.value)))}
                />
              </div>
              <div className="col-6 col-lg-3">
                <label className="form-label small mb-1" htmlFor="nle-durasi">
                  Durasi (detik)
                </label>
                <input
                  id="nle-durasi"
                  className="form-control form-control-sm"
                  type="number"
                  min={DURASI_MINIMUM}
                  step={LANGKAH_TIPIS}
                  value={klipAktif.durasi_detik}
                  onChange={(e) => setBlok(setDurasi(blok, aktif, Number(e.target.value)))}
                />
                {/* Klip bisa dipangkas tipis (0,1 detik) tanpa menghitung sendiri. */}
                <div className="d-flex gap-1 mt-1">
                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    onClick={() =>
                      setBlok(setDurasi(blok, aktif, klipAktif.durasi_detik - LANGKAH_TIPIS))
                    }
                  >
                    −0,1
                  </Tombol>
                  <Tombol
                    varian="tepi"
                    ukuran="sedang"
                    onClick={() =>
                      setBlok(setDurasi(blok, aktif, klipAktif.durasi_detik + LANGKAH_TIPIS))
                    }
                  >
                    +0,1
                  </Tombol>
                </div>
              </div>
              <div className="col-6 col-lg-3">
                <label className="form-label small mb-1" htmlFor="nle-track">
                  Track
                </label>
                <select
                  id="nle-track"
                  className="form-select form-select-sm"
                  value={klipAktif.track}
                  onChange={(e) => ubahBaris(aktif, { track: Number(e.target.value) })}
                >
                  {Array.from({ length: Math.max(jumlahTrackTampil, klipAktif.track + 1) }).map(
                    (_, nomor) => (
                      <option key={nomor} value={nomor}>
                        V{nomor + 1}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="col-6 col-lg-3 d-flex align-items-end gap-1">
                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  onClick={() => setBlok(setMulai(blok, aktif, klipAktif.mulai_detik - LANGKAH_WAKTU))}
                >
                  ⟵ maju
                </Tombol>
                <Tombol
                  varian="tepi"
                  ukuran="sedang"
                  onClick={() => setBlok(setMulai(blok, aktif, klipAktif.mulai_detik + LANGKAH_WAKTU))}
                >
                  mundur ⟶
                </Tombol>
              </div>
            </div>

            <div className="row g-2 mb-2 ">
              <div className="col-12 col-lg-6">
                <label className="form-label small mb-1" htmlFor="nle-fase">
                  {tanpaPeta(petaPratinjau) ? 'Nama bagian' : 'Nama pos perjalanan'}
                </label>
                <input
                  id="nle-fase"
                  className="form-control form-control-sm"
                  value={klipAktif.fase}
                  maxLength={40}
                  placeholder={faseKe(temaAktif, aktif, '').nama}
                  onChange={(e) => ubahBaris(aktif, { fase: e.target.value })}
                />
              </div>
              <div className="col-12 col-lg-6 d-flex align-items-end">
                <p className="small teks-lembut mb-0">
                  Urutan {tanpaPeta(petaPratinjau) ? 'bagian' : 'pos'} mengikuti timeline. Kosongkan
                  untuk memakai nama “{faseKe(temaAktif, aktif, '').bawaan}”.
                </p>
              </div>
            </div>

            {klipAktif.tipe === 'teks' && (
              <textarea
                className="form-control"
                rows={3}
                value={klipAktif.teks}
                onChange={(e) => ubahBaris(aktif, { teks: e.target.value })}
                placeholder="Tulis penjelasan singkat untuk murid…"
              />
            )}

            {klipAktif.tipe === 'media' && (
              <div className="row g-2">
                <div className="col-12 col-lg-6">
                  <input
                    className="form-control form-control-sm"
                    type="file"
                    aria-label={`Unggah berkas klip ${aktif + 1}`}
                    onChange={(e) => {
                      const berkas = e.target.files?.[0]
                      if (berkas) unggahKeKlip(aktif, berkas)
                    }}
                  />
                  {/* Daftar jenis yang diterima ditulis apa adanya: sebelumnya
                   * guru mengira materi hanya untuk video/gambar (14 Oktober 2026). */}
                  <p className="small teks-lembut mb-0 mt-1">
                    Boleh gambar, video, suara, PDF, Word (.docx), PowerPoint (.pptx), atau Excel
                    (.xlsx). Word/PowerPoint/Excel dibuka murid di aplikasi dokumennya; berkas yang
                    tidak dikenal tetap diunduh sebagai .upload.
                  </p>
                  {unggah.isPending && (
                    <p className="small teks-lembut mb-0">Mengunggah… {progresUnggah}%</p>
                  )}
                  {/* Nama berkasnya dipakai apa adanya; kode unggahan sengaja tidak
                   * ditampilkan lagi — yang perlu dikenali guru adalah berkasnya. */}
                  {klipAktif.unggahan_kode !== '' && (
                    <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
                      <span className="small mb-0">
                        Berkas: {cariUnggahan(klipAktif.unggahan_kode)?.nama_asli ?? 'sudah tidak ada di pustaka'}
                      </span>
                      {cariUnggahan(klipAktif.unggahan_kode) !== undefined && (
                        <Tombol
                          varian="teks"
                          ukuran="sedang"
                          className="ms-auto"
                          onClick={() => setBerkasDibuang(cariUnggahan(klipAktif.unggahan_kode) ?? null)}
                        >
                          Hapus berkas ini
                        </Tombol>
                      )}
                    </div>
                  )}
                </div>
                <div className="col-12 col-lg-6">
                  <input
                    className="form-control form-control-sm"
                    value={klipAktif.keterangan}
                    onChange={(e) => ubahBaris(aktif, { keterangan: e.target.value })}
                    placeholder="Keterangan berkas (opsional)"
                  />
                </div>

                {/* Sumber kedua klip media: tautan. Satu klip satu sumber —
                 * memakai tautan mengosongkan berkas unggahannya, dan mengunggah
                 * berkas mengosongkan tautannya (lihat `unggahKeKlip`). */}
                <div className="col-12">
                  <label className="form-label small fw-semibold mb-1" htmlFor={`nle-tautan-klip-${aktif}`}>
                    Atau pakai tautan (YouTube, Google Drive, berkas media)
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      id={`nle-tautan-klip-${aktif}`}
                      className="form-control form-control-sm"
                      inputMode="url"
                      value={tautanKlip}
                      onChange={(e) => setTautanKlip(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=…"
                    />
                    <Tombol
                      varian="tepi"
                      ukuran="sedang"
                      disabled={pesanGalatTautan(tautanKlip) !== ''}
                      onClick={() => pakaiTautan(aktif, tautanKlip)}
                    >
                      Pakai tautan
                    </Tombol>
                  </div>
                  {galatTautanKlip !== '' && <p className="small text-danger mb-0 mt-1">{galatTautanKlip}</p>}
                  {klipAktif.tautan !== '' && (
                    <p className="small mb-0 mt-1">
                      Sumber klip: <strong>{labelTautan(jenisTautan(klipAktif.tautan))}</strong> ·{' '}
                      {namaTautan(klipAktif.tautan)}{' '}
                      <Tombol varian="teks" ukuran="sedang" onClick={() => ubahBaris(aktif, { tautan: '' })}>
                        Lepas tautan
                      </Tombol>
                    </p>
                  )}
                  {klipAktif.tautan !== '' && (
                    <p className="small teks-lembut mb-0">
                      Kuis di dalam klip tautan tidak bisa dipicu otomatis oleh waktu putar — murid
                      membukanya lewat tombol di bawah pemutar.
                    </p>
                  )}
                </div>
              </div>
            )}

            {klipAktif.tipe === 'media' && (
              <div className="nle-atur mt-2">
                <strong className="small d-block mb-1">Penyesuaian di bingkai 16:9</strong>
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-lg-4">
                    <label className="form-label small mb-1" htmlFor="nle-fit">
                      Bila media tidak pas dengan bingkai
                    </label>
                    <select
                      id="nle-fit"
                      className="form-select form-select-sm"
                      value={tampilanKlip(klipAktif).fit}
                      onChange={(e) => setBlok(ubahTampilan(blok, aktif, { fit: e.target.value }))}
                    >
                      <option value="contain">Tampil utuh (ada pinggiran kosong)</option>
                      <option value="cover">Penuhi bingkai (bagian luar terpotong)</option>
                    </select>
                  </div>
                  {[
                    ['zoom', 'Zoom', 1, 3, 0.05],
                    ['fokus_x', 'Geser kiri–kanan', 0, 100, 1],
                    ['fokus_y', 'Geser atas–bawah', 0, 100, 1],
                  ].map(([kunci, label, min, maks, langkah]) => (
                    <div className="col-6 col-lg-2" key={String(kunci)}>
                      <label className="form-label small mb-1" htmlFor={`nle-${kunci}`}>
                        {label}
                      </label>
                      <input
                        id={`nle-${kunci}`}
                        className="form-range"
                        type="range"
                        min={Number(min)}
                        max={Number(maks)}
                        step={Number(langkah)}
                        value={Number(tampilanKlip(klipAktif)[String(kunci)])}
                        onChange={(e) =>
                          setBlok(ubahTampilan(blok, aktif, { [String(kunci)]: Number(e.target.value) }))
                        }
                      />
                    </div>
                  ))}
                  <div className="col-12 col-lg-2">
                    <Tombol
                      varian="tepi"
                      ukuran="sedang"
                      onClick={() =>
                        setBlok(ubahTampilan(blok, aktif, { fit: 'contain', fokus_x: 50, fokus_y: 50, zoom: 1 }))
                      }
                    >
                      Atur ulang
                    </Tombol>
                  </div>
                </div>
              </div>
            )}

            {klipAktif.tipe === 'kuis' && (
              <div className="nle-kuis-atur mt-2">
                <PemilihKuis
                  daftarKuis={daftarKuis}
                  terpilih={klipAktif.quiz_id}
                  onPilih={(id) => ubahBaris(aktif, { quiz_id: id })}
                />

                <div className="row g-2 mt-2 align-items-end">
                  <div className="col-12 col-lg-4">
                    <label className="form-label small mb-1" htmlFor="nle-mode">
                      Saat kuis muncul
                    </label>
                    <select
                      id="nle-mode"
                      className="form-select form-select-sm"
                      value={tampilanKlip(klipAktif).mode}
                      onChange={(e) => setBlok(ubahTampilan(blok, aktif, { mode: e.target.value }))}
                    >
                      <option value="jeda">Video berhenti dulu</option>
                      <option value="berjalan">Video tetap berjalan</option>
                    </select>
                  </div>
                  <div className="col-12 col-lg-4">
                    <label className="form-label small mb-1" htmlFor="nle-tata">
                      Tata letak kuis
                    </label>
                    <select
                      id="nle-tata"
                      className="form-select form-select-sm"
                      value={tampilanKlip(klipAktif).tata}
                      onChange={(e) => setBlok(ubahTampilan(blok, aktif, { tata: e.target.value }))}
                    >
                      <option value="vertikal">Vertikal (panel di bawah)</option>
                      <option value="horizontal">Horizontal (panel di samping)</option>
                    </select>
                  </div>
                  <div className="col-12 col-lg-4">
                    <Tombol
                      varian="tepi"
                      ukuran="sedang"
                      onClick={() => setBlok(setMulai(blok, aktif, detik))}
                    >
                      Taruh di jarum merah ({detik.toFixed(1)} dtk)
                    </Tombol>
                  </div>
                </div>

                <fieldset className="nle-sesudah mt-3">
                  <legend className="small fw-semibold mb-1">
                    Setelah murid selesai kuis <span className="teks-lembut fw-normal">(bisa dinyalakan satu-satu)</span>
                  </legend>
                  {SAKLAR_PANEL.map((saklar) => (
                    <div className="form-check form-switch nle-sesudah-baris" key={saklar.kunci}>
                      <input
                        id={`nle-saklar-${saklar.kunci}`}
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={tampilanKlip(klipAktif)[saklar.kunci] === 1}
                        onChange={(e) =>
                          setBlok(ubahTampilan(blok, aktif, { [saklar.kunci]: e.target.checked ? 1 : 0 }))
                        }
                      />
                      <label className="form-check-label" htmlFor={`nle-saklar-${saklar.kunci}`}>
                        <span className="fw-semibold">{saklar.judul}</span>
                        <span className="d-block small teks-lembut">{saklar.bantuan}</span>
                      </label>
                    </div>
                  ))}
                  {(tampilanKlip(klipAktif).ringkasan === 1 || tampilanKlip(klipAktif).kartu === 1) && (
                    <p className="small status-peringatan mb-0 mt-1">
                      Murid akan melihat jawaban benar setelah mengumpulkan latihan. Jangan pakai kuis yang
                      sama sebagai ulangan resmi yang belum berlangsung.
                    </p>
                  )}
                </fieldset>

                <fieldset className="nle-penjelasan mt-3">
                  <legend className="small fw-semibold mb-1">
                    Penjelasan setelah kuis <span className="teks-lembut fw-normal">(opsional)</span>
                  </legend>
                  <p className="small teks-lembut mb-2">
                    Tampil untuk seluruh kelas tepat setelah murid menyelesaikan kuis ini — mis. kenapa
                    jawabannya begitu. Boleh teks, media, atau keduanya.
                  </p>
                  <textarea
                    className="form-control form-control-sm"
                    rows={4}
                    maxLength={MAKS_PENJELASAN}
                    aria-label={`Teks penjelasan setelah kuis untuk klip ${aktif + 1}`}
                    placeholder="Tulis penjelasan lengkap di sini…"
                    value={klipAktif.penjelasan_teks}
                    onChange={(e) => ubahBaris(aktif, { penjelasan_teks: e.target.value })}
                  />
                  <div className="row g-2 mt-1 align-items-end">
                    <div className="col-12 col-lg-8">
                      <label className="form-label small mb-1" htmlFor="nle-penjelasan-media">
                        Media penjelasan
                      </label>
                      <select
                        id="nle-penjelasan-media"
                        className="form-select form-select-sm"
                        value={klipAktif.penjelasan_kode}
                        onChange={(e) => ubahBaris(aktif, { penjelasan_kode: e.target.value })}
                      >
                        <option value="">Tanpa media</option>
                        {berkasSiap.map((satu) => (
                          <option key={satu.kode} value={satu.kode}>
                            {satu.nama_asli} · {satu.ukuran_manusia} · {satu.kategori_label}
                      {sajianBerkas(satu) === 'dokumen' ? ' · dibuka di aplikasi dokumen' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-lg-4">
                      <Tombol
                        varian="tepi"
                        ukuran="sedang"
                        disabled={!penjelasanTerisi(klipAktif)}
                        onClick={() => ubahBaris(aktif, { penjelasan_teks: '', penjelasan_kode: '' })}
                      >
                        Kosongkan penjelasan
                      </Tombol>
                    </div>
                  </div>
                  {berkasSiap.length === 0 && (
                    <p className="small teks-lembut mb-0 mt-1">
                      Belum ada berkas di materi ini. Unggah lewat area klip media untuk menyisipkan media
                      penjelasan.
                    </p>
                  )}
                </fieldset>
              </div>
            )}
          </div>
        )}

        {berkasSiap.length > 0 && (
          <div className="pustaka-media mt-3">
            <h2 className="h6 fw-bold mb-2">Pustaka media</h2>
            <p className="small teks-lembut mb-2">
              Sisipkan berkas lagi sebagai klip baru tanpa mengunggah ulang.
            </p>
            <ul className="list-unstyled mb-0">
              {berkasSiap.map((satu) => {
                const dipakai = pemakaiBerkas(blok, satu.kode)

                return (
                  <li key={satu.kode} className="d-flex flex-wrap align-items-center gap-2 py-1">
                    <span className="small">
                      {satu.nama_asli} · {satu.ukuran_manusia} · {satu.kategori_label}
                      {sajianBerkas(satu) === 'dokumen' ? ' · dibuka di aplikasi dokumen' : ''}
                      {dipakai.klip > 0 && (
                        <span className="teks-lembut"> · dipakai {dipakai.klip} klip</span>
                      )}
                    </span>
                    <Tombol
                      varian="teks"
                      ukuran="sedang"
                      className="ms-auto"
                      onClick={() => sisipkanMedia(satu)}
                    >
                      Sisipkan
                    </Tombol>
                    <Tombol varian="teks" ukuran="sedang" onClick={() => setBerkasDibuang(satu)}>
                      Hapus berkas
                    </Tombol>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {laporan.data && (
          <div className="mt-4">
            <h2 className="h6 fw-bold">Hasil murid</h2>
            <p className="small teks-lembut">
              {laporan.data.perjalanan.tanpa
                ? 'Tanpa peta perjalanan'
                : `Tema perjalanan “${laporan.data.perjalanan.nama}”`}{' '}
              · skor latihan masuk laporan tema materi ini dan tidak menghitung ranking.
            </p>
            <TabelData
              label="Hasil murid pada materi ini"
              baris={laporan.data.murid}
              kunciBaris={(satu) => satu.murid_id}
              kolom={[
                { kunci: 'nama', judul: 'Murid', sel: (satu) => satu.nama ?? 'Tanpa nama' },
                {
                  kunci: 'blok_selesai',
                  judul: 'Blok selesai',
                  sel: (satu) => `${satu.blok_selesai}/${satu.jumlah_blok}`,
                },
                {
                  kunci: 'skor_latihan',
                  judul: 'Skor latihan',
                  sel: (satu) => `${satu.skor_latihan}/${satu.skor_latihan_maksimal}`,
                },
                {
                  kunci: 'perjalanan',
                  judul: 'Perjalanan',
                  sel: (satu) =>
                    `${satu.perjalanan.langkah_aktif ?? '—'} (${satu.perjalanan.posisi}/${satu.perjalanan.total})`,
                },
                {
                  kunci: 'tingkat',
                  judul: 'Tingkat',
                  // Materi tanpa peta tidak punya tingkat: cukup persentasenya.
                  sel: (satu) =>
                    `${satu.perjalanan.tingkat_nama ? `${satu.perjalanan.tingkat_nama} · ` : ''}${satu.perjalanan.persen}%`,
                },
                {
                  kunci: 'tema',
                  judul: 'Tema terlemah',
                  sel: (satu) =>
                    satu.tema.length === 0
                      ? '—'
                      : `${satu.tema[0].tag_nama} (${satu.tema[0].persen}%)`,
                },
              ]}
            />
          </div>
        )}
      </div>

      {/* Pembuangan berkas mempengaruhi bagian materi yang lain (klip, media
       * penjelasan, latar tema) dan tidak bisa dikembalikan, jadi selalu lewat
       * konfirmasi yang menyebut angka dampaknya lebih dulu. */}
      <DialogKonfirmasi
        buka={berkasDibuang !== null}
        judul={`Buang berkas ${berkasDibuang?.nama_asli ?? ''}?`}
        labelYa="Buang berkas"
        bahaya
        memuat={buangBerkas.isPending}
        onYa={() => {
          if (berkasDibuang !== null) buangBerkas.mutate(berkasDibuang.kode)
        }}
        onBatal={() => setBerkasDibuang(null)}
      >
        <p className="mb-2">
          Berkasnya dihapus dari pustaka materi ini dan tidak bisa dikembalikan — kalau masih
          dibutuhkan, unggah ulang berkasnya.
        </p>
        {pemakaiBerkasDibuang.klip > 0 && (
          <p className="status-peringatan mb-2">
            {pemakaiBerkasDibuang.klip} klip media yang memakai berkas ini ikut dibuang dari susunan.
          </p>
        )}
        {pemakaiBerkasDibuang.penjelasan > 0 && (
          <p className="mb-2">
            {pemakaiBerkasDibuang.penjelasan} penjelasan setelah kuis kehilangan medianya; teksnya
            tetap ada.
          </p>
        )}
        {videoKode !== '' && videoKode === berkasDibuang?.kode && (
          <p className="mb-0">Latar tema kembali ke animasi bawaan.</p>
        )}
      </DialogKonfirmasi>
    </div>
  )
}
