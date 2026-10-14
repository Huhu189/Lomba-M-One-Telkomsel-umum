/**
 * Pemutar video murid dengan kuis sisipan.
 *
 * Bingkai mengikuti rasio terkunci dari guru, dan media dipotong/diletakkan
 * sesuai pengaturan guru (utuh / penuhi bingkai + fokus + zoom). Saat video
 * mencapai titik kuis:
 *  - mode "jeda": video berhenti sampai kuis dijawab;
 *  - mode "berjalan": video tetap main, kuis muncul di samping/bawahnya.
 *
 * Panel kuis selalu berada DI LUAR bingkai video (di bawah video, atau di
 * sampingnya saat tata "horizontal" dan layar cukup lebar). Menumpuknya di atas
 * gambar dulu membuat panel hanya setinggi bingkai — di ponsel itu jadi jendela
 * gulir kecil yang menyembunyikan soal dan tombol kumpulkan, dan gambar video
 * ikut tertutup di mode "berjalan".
 *
 * Kuis memakai attempt latihan dari server (sama dengan blok kuis biasa) dan
 * server menolak menutup video selama kuis wajib di dalamnya belum selesai,
 * jadi melompati video lewat slider tidak mem-bypass apa pun.
 */
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Banner from '../../shared/ui/Banner.jsx'
import { pesanGalatApi } from '../auth/api.js'
import { kirimJawaban, kumpulkanAttempt, kunciIdempotensiBaru } from '../attempt/api.js'
import { bukaBlok, selesaikanBlok } from './api.js'
import { gayaMedia, rasioAngka, tampilanKlip } from './editorMateri.js'
import KuisSisipan from './KuisSisipan.jsx'
import { kuisJatuhTempo, sisaWajib, sisipanUntuk } from './pemutarMateri.js'

/**
 * Penjelasan guru yang muncul SETELAH kuis selesai (opsional).
 *
 * Teks ditampilkan apa adanya (baris baru dipertahankan), media memakai aturan
 * yang sama dengan blok media: kategori yang boleh tampil langsung dirender
 * sesuai mime-nya, sisanya jadi tautan unduh. Tidak ada kunci jawaban di sini —
 * penjelasan ditulis guru dan tidak masuk penilaian.
 *
 * @param {{ penjelasan: import('./api.js').DataIsiBlok['penjelasan'] }} props
 */
export function PenjelasanKuis({ penjelasan }) {
  if (penjelasan === undefined || penjelasan === null) return null

  const teks = (penjelasan.teks ?? '').trim()
  const media = penjelasan.media ?? null

  if (teks === '' && media === null) return null

  return (
    <section className="pm-penjelasan" aria-label="Penjelasan setelah kuis">
      <h4 className="h6 fw-bold mb-2">Penjelasan</h4>

      {teks !== '' && (
        <p className="mb-2" style={{ whiteSpace: 'pre-wrap' }}>
          {teks}
        </p>
      )}

      {media !== null && media.tersedia === false && (
        <p className="small teks-lembut mb-0">Media penjelasan sudah tidak tersedia.</p>
      )}

      {media !== null && media.tersedia !== false && media.tampil_langsung === true && media.mime?.startsWith('image/') && (
        <img
          className="pm-penjelasan-media"
          src={media.url}
          alt={media.nama ?? 'Media penjelasan'}
          loading="lazy"
          decoding="async"
        />
      )}

      {media !== null && media.tersedia !== false && media.tampil_langsung === true && media.mime?.startsWith('video/') && (
        <video className="pm-penjelasan-media" src={media.url} controls playsInline preload="metadata" />
      )}

      {media !== null && media.tersedia !== false && media.tampil_langsung === true && media.mime?.startsWith('audio/') && (
        <audio className="pm-penjelasan-audio" src={media.url} controls preload="metadata" />
      )}

      {media !== null && media.tersedia !== false && media.tampil_langsung === true && media.mime === 'application/pdf' && (
        <a className="btn btn-tepi btn-sedang" href={media.url} target="_blank" rel="noreferrer">
          Buka dokumen PDF penjelasan
        </a>
      )}

      {media !== null && media.tersedia !== false && media.tampil_langsung !== true && (
        <a className="btn btn-tepi btn-sedang" href={media.url} download>
          Unduh media penjelasan ({media.kategori_label ?? 'berkas'})
        </a>
      )}
    </section>
  )
}

/**
 * @param {{
 *   blok: import('./api.js').DataIsiBlok,
 *   ringkasan: import('./api.js').DataRingkasanMateri,
 *   materiId: number,
 * }} props
 */
export default function PemutarMateri({ blok, ringkasan, materiId }) {
  const queryClient = useQueryClient()
  const videoRef = useRef(/** @type {HTMLVideoElement|null} */ (null))
  const dialogRef = useRef(/** @type {HTMLDivElement|null} */ (null))
  // block_id kuis yang sudah dijawab/dilewati. Disimpan sebagai state supaya
  // ringkasan "sisa wajib" menyegar tanpa membaca ref saat render; penjagaan
  // agar kuis yang sama tidak dipicu berulang ada di `kuisJatuhTempo`.
  const [tertutup, setTertutup] = useState(/** @type {Set<number>} */ (new Set()))
  const membukaRef = useRef(false)
  // Kuis "jeda" sedang terbuka (ref: dibaca handler `play` yang datang async).
  const menahanRef = useRef(false)

  const [aktif, setAktif] = useState(
    /** @type {import('./api.js').DataRingkasanMateri['blok'][number]|null} */ (null),
  )
  const [attempt, setAttempt] = useState(
    /** @type {import('../attempt/api.js').DataAttempt|null} */ (null),
  )
  const [jawaban, setJawaban] = useState(/** @type {Record<string, unknown>} */ ({}))
  const [hasil, setHasil] = useState(/** @type {import('../attempt/api.js').DataHasil|null} */ (null))
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [judulKuis, setJudulKuis] = useState('')

  const sisipan = sisipanUntuk(ringkasan, blok.block_id)
  const media = blok.media
  const tampilanVideo = gayaMedia({ tipe: 'media', tampilan: media?.tampilan ?? undefined })
  const tampilanKuis = aktif
    ? tampilanKlip({ tipe: 'kuis', tampilan: aktif.tampilan ?? undefined })
    : { mode: 'jeda', tata: 'vertikal' }

  // Pindahkan fokus ke panel kuis supaya pembaca layar/keyboard langsung sampai,
  // dan bawa panelnya ke layar: ia muncul di bawah video, bukan di atas gambar
  // yang sedang dilihat murid, jadi tanpa ini murid bisa tidak menyadarinya.
  // (scrollIntoView tidak ada di jsdom, karena itu dipanggil dengan `?.`.)
  useEffect(() => {
    const panel = dialogRef.current
    if (!aktif || panel === null) return
    panel.focus({ preventScroll: true })
    panel.scrollIntoView?.({ block: 'nearest' })
  }, [aktif])

  /** @param {number} detik */
  async function periksa(detik) {
    if (aktif !== null || membukaRef.current) return

    const target = kuisJatuhTempo(sisipan, detik, tertutup)
    if (target === null) return

    membukaRef.current = true
    const mode = tampilanKlip({ tipe: 'kuis', tampilan: target.tampilan ?? undefined }).mode
    const el = videoRef.current

    // Berhenti SEKARANG (sebelum menunggu server) supaya video tidak lari lewat
    // titik kuis, lalu kembalikan ke titik kuis agar konteksnya pas.
    if (mode === 'jeda' && el) {
      el.pause()
      if (Number.isFinite(detik)) el.currentTime = Math.min(el.currentTime, target.mulai_detik ?? 0)
    }

    try {
      const data = await bukaBlok(materiId, target.block_id)
      setGalat('')
      setJawaban({})
      setHasil(null)
      setAttempt(data.attempt)
      setJudulKuis(data.blok.kuis?.judul ?? '')
      menahanRef.current = mode === 'jeda'
      setAktif(target)
    } catch (error) {
      // Jangan memicu berulang-ulang; murid bisa mencoba lagi lewat daftar bagian.
      setTertutup((sebelum) => new Set(sebelum).add(target.block_id))
      setGalat(pesanGalatApi(error))
    } finally {
      membukaRef.current = false
    }
  }

  async function kumpulkan() {
    if (attempt === null) return

    setSibuk(true)
    try {
      for (const soal of attempt.soal) {
        const nilai = jawaban[String(soal.id)]
        if (nilai === undefined) continue
        await kirimJawaban(attempt.id, soal.id, nilai)
      }
      setHasil(await kumpulkanAttempt(attempt.id, kunciIdempotensiBaru()))
      setGalat('')
    } catch (error) {
      setGalat(pesanGalatApi(error))
    } finally {
      setSibuk(false)
    }
  }

  /** Tutup panel kuis; video jeda dilanjutkan. */
  function tutup() {
    menahanRef.current = false
    setAktif(null)
    setAttempt(null)
    setHasil(null)
    if (tampilanKuis.mode === 'jeda') void videoRef.current?.play()
  }

  async function lanjutkan() {
    if (aktif === null) return

    setSibuk(true)
    try {
      await selesaikanBlok(materiId, aktif.block_id)
      setTertutup((sebelum) => new Set(sebelum).add(aktif.block_id))
      void queryClient.invalidateQueries({ queryKey: ['materi-progres', materiId] })
      setGalat('')
      tutup()
    } catch (error) {
      setGalat(pesanGalatApi(error))
    } finally {
      setSibuk(false)
    }
  }

  function lewati() {
    if (aktif === null) return
    setTertutup((sebelum) => new Set(sebelum).add(aktif.block_id))
    tutup()
  }

  const sisa = sisaWajib(sisipan, tertutup)

  return (
    <div className="mb-3">
      <div
        className={
          aktif && attempt
            ? `pm-panggung pm-panggung-kuis pm-panggung-${tampilanKuis.tata}`
            : 'pm-panggung'
        }
      >
        <div
          className="pm-bingkai"
          style={/** @type {import('react').CSSProperties} */ ({ '--r': rasioAngka(ringkasan.materi.rasio) })}
        >
          <video
            ref={videoRef}
            src={media?.url}
            controls
            // Layar penuh bawaan menyembunyikan panel kuis; bingkai ini sudah cukup besar.
            controlsList="nofullscreen"
            playsInline
            className="nle-media-penuh"
            style={tampilanVideo}
            onTimeUpdate={(e) => void periksa(e.currentTarget.currentTime)}
            onEnded={() => void periksa(Number.POSITIVE_INFINITY)}
            onPlay={(e) => {
              // Kuis "jeda" sedang terbuka: video tidak boleh jalan di belakangnya.
              if (menahanRef.current) e.currentTarget.pause()
            }}
          />
        </div>

        {aktif && attempt && (
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-label={`Kuis di dalam video: ${aktif.tipe_label}`}
            className={`pm-kuis pm-kuis-${tampilanKuis.tata}`}
          >
            <KuisSisipan
              attempt={attempt}
              jawaban={jawaban}
              onUbahJawaban={(id, nilai) => setJawaban((sebelum) => ({ ...sebelum, [id]: nilai }))}
              hasil={hasil}
              galat={galat}
              sibuk={sibuk}
              onKumpulkan={() => void kumpulkan()}
              onLewati={aktif.wajib ? undefined : lewati}
              materiId={materiId}
              blockId={aktif.block_id}
              tampilan={aktif.tampilan}
              judul={judulKuis}
              catatan={
                tampilanKuis.mode === 'jeda'
                  ? 'Video berhenti sampai kuis ini selesai. Latihan tidak masuk ranking.'
                  : 'Video tetap berjalan; jawab kapan siap. Latihan tidak masuk ranking.'
              }
              penjelasan={
                // Penjelasan guru (opsional) tampil sesudah kuis selesai,
                // sebelum murid melanjutkan video.
                hasil !== null && aktif.penjelasan ? <PenjelasanKuis penjelasan={aktif.penjelasan} /> : undefined
              }
              labelLanjut={tampilanKuis.mode === 'jeda' ? 'Lanjutkan video' : 'Tutup kuis'}
              sibukLanjut={sibuk}
              onLanjut={() => void lanjutkan()}
            />
          </div>
        )}
      </div>

      {!aktif && galat && <Banner jenis="salah">{galat}</Banner>}

      {sisipan.length > 0 && (
        <p className="small teks-lembut mt-2 mb-0" aria-live="polite">
          {sisipan.length} kuis di dalam video
          {sisa > 0 ? ` · ${sisa} wajib belum selesai` : ' · semua kuis wajib selesai'}.
        </p>
      )}
    </div>
  )
}
