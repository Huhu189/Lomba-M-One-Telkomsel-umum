/**
 * Lampiran jawaban untuk satu soal (slice 09).
 *
 * Tiga cara melampirkan, semuanya dikirim berpotongan supaya sinyal lemah tidak
 * membuang pekerjaan anak:
 *
 * 1. **Foto/gambar** — gambar dikecilkan di kanvas perangkat lebih dulu, lalu
 *    server mengencode ulang ke PNG. Berkas asli tidak pernah disajikan.
 * 2. **Rekaman diri** — tombolnya baru aktif setelah izin dicentang, kamera
 *    diminta hanya saat anak menekan tombol (bukan otomatis), dan server tetap
 *    menolak bila sekolah belum menyalakan izin rekam.
 * 3. **Berkas** — server mengklasifikasi isinya; gambar/PDF dan dokumen kantor
 *    (Word/PowerPoint/Excel) disajikan apa adanya, sedangkan arsip dan berkas
 *    tak dikenal tetap unduhan `.upload`.
 *
 * Semua tombol mati begitu waktu ulangan habis; server menolaknya juga.
 *
 * **Terlipat kecuali pada soal tugas unggah** (14 Oktober 2026, temuan M1).
 * Dulu panel ini terbuka di SETIAP soal — termasuk pilihan ganda — sehingga
 * anak melihat kotak "Lampiran jawaban", tombol rekam diri, dan permintaan izin
 * merekam di semua halaman. Anak jadi ragu ("aku harus rekam?") dan
 * perhatiannya pecah dari soalnya. Kini hanya soal tugas unggah yang membuka
 * panelnya sendiri; di soal lain cukup satu tombol kecil "Tambah lampiran" yang
 * bisa dibuka murid bila gurunya memang meminta.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Banner from '../../shared/ui/Banner.jsx'
import { Tombol } from '../../shared/ui/Tombol.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { sajianBerkas } from '../material/sajianBerkas.js'
import {
  DURASI_REKAM_MAKS,
  bolehUnggahLampiran,
  daftarLampiran,
  hapusLampiran,
  jenisLampiranUntukBerkas,
  hanyaLampiranSelesai,
  periksaBerkasLampiran,
  sisaKuotaLampiran,
  unggahLampiran,
} from './lampiran.js'

/** Sisi terpanjang gambar setelah dikecilkan di perangkat (piksel). */
const SISI_GAMBAR = 1280

/**
 * Kecilkan gambar di kanvas perangkat sebelum dikirim.
 *
 * Foto kamera ponsel bisa 4000 px dan beberapa MiB; mengecilkannya di sini
 * menghemat kuota anak, dan server tetap melakukan encode ulang penuh.
 *
 * @param {File} berkas
 * @returns {Promise<Blob>}
 */
async function kecilkanGambar(berkas) {
  try {
    const bitmap = await createImageBitmap(berkas)
    const skala = Math.min(1, SISI_GAMBAR / Math.max(bitmap.width, bitmap.height))
    const lebar = Math.max(1, Math.round(bitmap.width * skala))
    const tinggi = Math.max(1, Math.round(bitmap.height * skala))

    const kanvas = document.createElement('canvas')
    kanvas.width = lebar
    kanvas.height = tinggi

    const konteks = kanvas.getContext('2d')

    if (!konteks) return berkas

    konteks.drawImage(bitmap, 0, 0, lebar, tinggi)
    bitmap.close?.()

    const hasil = await new Promise((selesai) => kanvas.toBlob((blob) => selesai(blob), 'image/png'))

    return hasil ?? berkas
  } catch {
    // Perangkat lama tanpa createImageBitmap: kirim apa adanya, server tetap
    // yang menentukan bentuk akhirnya.
    return berkas
  }
}

/**
 * @param {{
 *   attemptId: number,
 *   soalId: number,
 *   nonaktif?: boolean,
 *   sisaDetik?: number,
 *   bukaOtomatis?: boolean,
 * }} props
 */
export default function UnggahLampiran({
  attemptId,
  soalId,
  nonaktif = false,
  sisaDetik = 1,
  bukaOtomatis = true,
}) {
  const queryClient = useQueryClient()
  const masukanBerkas = useRef(/** @type {HTMLInputElement|null} */ (null))
  const perekam = useRef(/** @type {MediaRecorder|null} */ (null))
  const serpihan = useRef(/** @type {Blob[]} */ ([]))
  // Durasi rekaman terkini + penanda batal dibaca lewat ref: `onstop` dibuat sekali saat
  // tombol ditekan, jadi state di dalamnya basi (durasi selalu salah).
  const durasiRekam = useRef(0)
  const dibatalkan = useRef(false)
  const aliranAktif = useRef(/** @type {MediaStream|null} */ (null))

  const [galat, setGalat] = useState('')
  const [progres, setProgres] = useState(0)
  const [izin, setIzin] = useState(false)
  const [sedangRekam, setSedangRekam] = useState(false)
  const [detikRekam, setDetikRekam] = useState(0)
  const [terbuka, setTerbuka] = useState(bukaOtomatis)

  const kunci = ['lampiran-jawaban', attemptId]
  const daftar = useQuery({ queryKey: kunci, queryFn: () => daftarLampiran(attemptId) })

  const semua = hanyaLampiranSelesai(daftar.data ?? [])
  const milikSoal = semua.filter((satu) => Number(satu.question_id) === Number(soalId))
  const kuota = sisaKuotaLampiran(semua, soalId)
  const mati = nonaktif || !bolehUnggahLampiran(sisaDetik) || kuota <= 0

  // Batas durasi rekaman ditegakkan juga di perangkat supaya anak tidak merekam
  // terlalu lama lalu ditolak server. Penghitung dan penghentian otomatisnya
  // dilakukan di dalam timer — bukan di badan efek — supaya tidak ada setState
  // yang berjalan langsung saat efek dipasang.
  useEffect(() => {
    if (!sedangRekam) return undefined

    let detik = 0

    const jam = window.setInterval(() => {
      detik += 1
      durasiRekam.current = detik
      setDetikRekam(detik)

      if (detik >= DURASI_REKAM_MAKS) {
        window.clearInterval(jam)
        perekam.current?.stop()
        perekam.current = null
        setSedangRekam(false)
      }
    }, 1000)

    return () => window.clearInterval(jam)
  }, [sedangRekam])

  // Keluar dari soal/halaman (pindah soal, waktu habis, kumpul) saat merekam: matikan
  // perekam + kamera/mikrofon dan JANGAN unggah rekaman yang ditinggalkan.
  useEffect(
    () => () => {
      dibatalkan.current = true
      if (perekam.current && perekam.current.state !== 'inactive') perekam.current.stop()
      aliranAktif.current?.getTracks().forEach((jalur) => jalur.stop())
      aliranAktif.current = null
      perekam.current = null
      serpihan.current = []
    },
    [],
  )

  const unggah = useMutation({
    mutationFn: (/** @type {{jenis: string, isi: Blob, nama: string, durasi?: number}} */ muatan) =>
      unggahLampiran(
        attemptId,
        {
          question_id: soalId,
          jenis: muatan.jenis,
          nama: muatan.nama,
          durasi_detik: muatan.durasi,
        },
        muatan.isi,
        { onProgres: setProgres },
      ),
    onSuccess: () => {
      setGalat('')
      setProgres(0)
      void queryClient.invalidateQueries({ queryKey: kunci })
    },
    onError: (error) => {
      setProgres(0)
      setGalat(pesanGalatApi(error))
    },
  })

  const buang = useMutation({
    mutationFn: hapusLampiran,
    onSuccess: () => {
      setGalat('')
      void queryClient.invalidateQueries({ queryKey: kunci })
    },
    onError: (error) => setGalat(pesanGalatApi(error)),
  })

  /** @param {File} berkas */
  async function pilihBerkas(berkas) {
    setGalat('')

    const pesan = periksaBerkasLampiran(berkas)

    if (pesan !== null) {
      setGalat(pesan)
      return
    }

    const jenis = jenisLampiranUntukBerkas(berkas)
    const isi = jenis === 'gambar' ? await kecilkanGambar(berkas) : berkas

    unggah.mutate({ jenis, isi, nama: berkas.name })
  }

  async function mulaiRekam() {
    setGalat('')

    if (!izin) {
      setGalat('Centang izin merekam dulu (izin sekolah/orang tua).')
      return
    }

    try {
      const aliran = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      const perekamBaru = new MediaRecorder(aliran)

      aliranAktif.current = aliran
      dibatalkan.current = false
      durasiRekam.current = 0
      serpihan.current = []
      perekamBaru.ondataavailable = (peristiwa) => {
        if (peristiwa.data.size > 0) serpihan.current.push(peristiwa.data)
      }
      perekamBaru.onstop = () => {
        aliran.getTracks().forEach((jalur) => jalur.stop())
        aliranAktif.current = null

        if (dibatalkan.current) {
          serpihan.current = []
          return
        }

        const isi = new Blob(serpihan.current, { type: perekamBaru.mimeType || 'video/webm' })
        serpihan.current = []

        if (isi.size > 0) {
          unggah.mutate({ jenis: 'rekam', isi, nama: 'rekaman-diri.webm', durasi: durasiRekam.current })
        }
      }

      perekamBaru.start()
      perekam.current = perekamBaru
      setDetikRekam(0)
      setSedangRekam(true)
    } catch {
      setGalat('Tidak bisa mengakses kamera/mikrofon. Coba lampirkan berkas saja.')
    }
  }

  function hentikanRekam() {
    perekam.current?.stop()
    perekam.current = null
    setSedangRekam(false)
  }

  /**
   * Soal biasa (bukan tugas unggah): panel penuh disembunyikan sampai murid
   * benar-benar menekan "Tambah lampiran". Kalau sudah ada lampiran, panelnya
   * tetap terbuka supaya anak bisa melihat & membuang berkasnya.
   */
  const terlipat = !terbuka && milikSoal.length === 0 && !sedangRekam

  if (terlipat) {
    return (
      <div className="panel-lampiran-lipat mt-3" data-lampiran="terlipat">
        <Tombol
          varian="tepi"
          ukuran="sedang"
          disabled={mati}
          onClick={() => setTerbuka(true)}
        >
          Tambah lampiran
        </Tombol>
        {galat !== '' && <Banner jenis="salah">{galat}</Banner>}
      </div>
    )
  }

  return (
    <div className="border rounded-3 p-2 mt-3">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="small fw-semibold">Lampiran jawaban</span>
        <span className="small teks-lembut">({milikSoal.length}/{milikSoal.length + kuota} berkas)</span>

        <input
          ref={masukanBerkas}
          type="file"
          className="visually-hidden"
          aria-label={`Pilih berkas lampiran soal ${soalId}`}
          onChange={(peristiwa) => {
            const berkas = peristiwa.target.files?.[0]
            if (berkas) void pilihBerkas(berkas)
            peristiwa.target.value = ''
          }}
        />

        <div className="ms-auto d-flex flex-wrap gap-2">
          <Tombol
            varian="tepi"
            disabled={mati || unggah.isPending}
            onClick={() => masukanBerkas.current?.click()}
          >
            Lampirkan berkas
          </Tombol>

          {sedangRekam ? (
            <Tombol varian="tepi" onClick={hentikanRekam}>
              Stop rekam ({detikRekam}s)
            </Tombol>
          ) : (
            <Tombol varian="tepi" disabled={mati || unggah.isPending} onClick={() => void mulaiRekam()}>
              Rekam diri
            </Tombol>
          )}
        </div>
      </div>

      <label className="form-check small mt-2">
        <input
          type="checkbox"
          className="form-check-input"
          checked={izin}
          disabled={sedangRekam}
          onChange={(peristiwa) => setIzin(peristiwa.target.checked)}
        />
        <span className="form-check-label">
          Saya sudah mendapat izin sekolah/orang tua untuk merekam diri
        </span>
      </label>

      {galat && <Banner jenis="salah">{galat}</Banner>}
      {unggah.isPending && <p className="small teks-lembut mb-0">Mengunggah… {progres}%</p>}
      {mati && !unggah.isPending && (
        <p className="small teks-lembut mb-0">
          {kuota <= 0 ? 'Lampiran soal ini sudah maksimal.' : 'Waktu hampir habis; lampiran dikunci.'}
        </p>
      )}

      {milikSoal.length > 0 && (
        <ul className="list-unstyled mb-0 mt-2">
          {milikSoal.map((satu) => (
            <li key={satu.kode} className="d-flex flex-wrap align-items-center gap-2 py-1 border-top">
              <span className="small flex-grow-1">
                {satu.nama_asli ?? satu.jenis_label} · {satu.ukuran_manusia}
                {satu.durasi_detik ? ` · ${satu.durasi_detik}s` : ''}
                {/* Berkas yang bukan gambar/PDF/Word tetap disajikan sebagai
                 * unduhan `.upload` — itu yang dimaksud "berkas aman". */}
                {sajianBerkas(satu) === 'unduh' ? ' · diunduh sebagai berkas aman' : ''}
              </span>
              {satu.url && (
                <a className="small" href={satu.url} target="_blank" rel="noreferrer">
                  Lihat
                </a>
              )}
              <Tombol
                varian="teks"
                ukuran="sedang"
                disabled={mati}
                memuat={buang.isPending}
                onClick={() => buang.mutate(satu.kode)}
              >
                Buang
              </Tombol>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
