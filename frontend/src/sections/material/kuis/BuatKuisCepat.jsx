/**
 * "Buat kuis baru di sini" — formulir kuis di dalam editor materi.
 *
 * Sebelumnya guru yang menambahkan klip kuis harus keluar ke menu Kuis, membuat
 * kuis, menulis soal di Bank Soal, lalu kembali. Kini cukup: judul, durasi, dan
 * (boleh kosong) beberapa soal pilihan ganda. Kuisnya langsung dibuat sebagai
 * draf dengan mapel & kelas materi ini, soalnya disusun ke dalamnya, dan klip
 * yang sedang dipilih langsung memakainya. Soal boleh dikosongkan dan dilengkapi
 * nanti di menu Kuis.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Banner from '../../../shared/ui/Banner.jsx'
import { Tombol } from '../../../shared/ui/Tombol.jsx'
import { tampilkanToast } from '../../../shared/ui/toast.jsx'
import { pesanGalatApi } from '../../auth/api.js'
import { buatSoal } from '../../question/api.js'
import { buatKuis, sinkronSoalKuis } from '../../quiz/api.js'
import {
  HURUF_PILIHAN,
  MAKS_SOAL_CEPAT,
  galatKuisCepat,
  muatanSoalCepat,
  soalCepatKosong,
  soalCepatTerisi,
  uraiSoalDariTeks,
} from './kuisCepat.js'

/**
 * @param {{
 *   materi: import('../api.js').DataMateri,
 *   onSelesai: (kuisId: number) => void,
 *   onBatal: () => void,
 * }} props
 */
export default function BuatKuisCepat({ materi, onSelesai, onBatal }) {
  const queryClient = useQueryClient()
  const [judul, setJudul] = useState(`Kuis ${materi.judul}`.slice(0, 120))
  const [durasi, setDurasi] = useState('10')
  const [soal, setSoal] = useState([soalCepatKosong()])
  const [galat, setGalat] = useState('')
  // Tempel banyak soal sekaligus dari teks (Word/WhatsApp).
  const [bukaTempel, setBukaTempel] = useState(false)
  const [teksTempel, setTeksTempel] = useState('')
  const [infoTempel, setInfoTempel] = useState('')
  /**
   * Nomor soal yang baru ditambahkan dan harus diberi fokus sesudah render
   * berikutnya. Disimpan di ref, bukan state: memindahkan fokus adalah urusan
   * DOM, dan menaruhnya di state memaksa render kedua tiap kali fokus berpindah
   * (`react-hooks/set-state-in-effect`).
   * @type {import('react').MutableRefObject<number|null>}
   */
  const fokusSoalBaru = useRef(null)
  const mapelId = typeof materi.subject_id === 'number' ? materi.subject_id : null

  const buat = useMutation({
    mutationFn: async () => {
      const kuis = await buatKuis({
        judul: judul.trim(),
        subject_id: mapelId,
        class_id: typeof materi.class_id === 'number' ? materi.class_id : null,
        durasi_menit: Number(durasi),
      })

      /** @type {number[]} */
      const idSoal = []
      let galatSoal = ''

      if (mapelId !== null) {
        for (const [urutan, satu] of soal.filter(soalCepatTerisi).entries()) {
          try {
            idSoal.push((await buatSoal(muatanSoalCepat(satu, mapelId))).id)
          } catch (err) {
            // Kuisnya sudah ada; soal yang sudah jadi tetap dipasang dan sisanya
            // dilaporkan, supaya kerja guru tidak hilang.
            galatSoal = `Soal ke-${urutan + 1} gagal disimpan: ${pesanGalatApi(err)}`
            break
          }
        }
      }

      const hasil = idSoal.length > 0 ? await sinkronSoalKuis(kuis.id, idSoal) : kuis

      return { kuis: hasil, galatSoal }
    },
    onSuccess: async ({ kuis, galatSoal }) => {
      queryClient.setQueryData(['kuis'], (/** @type {unknown} */ lama) => [
        kuis,
        ...(Array.isArray(lama) ? lama.filter((satu) => satu.id !== kuis.id) : []),
      ])
      void queryClient.invalidateQueries({ queryKey: ['kuis'] })
      void queryClient.invalidateQueries({ queryKey: ['soal'] })

      if (galatSoal !== '') {
        tampilkanToast('salah', `Kuis dibuat, tetapi ${galatSoal}`)
      } else {
        tampilkanToast('sukses', 'Kuis dibuat dan dipasang di klip ini.')
      }

      onSelesai(kuis.id)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['kuis'] })
      setGalat(pesanGalatApi(err))
    },
  })

  // Isian soal baru belum ada di DOM saat tombolnya ditekan, jadi fokusnya
  // dipasang sesudah soal itu benar-benar dirender.
  useEffect(() => {
    const urutan = fokusSoalBaru.current

    if (urutan === null) return

    fokusSoalBaru.current = null
    document.getElementById(`kc-tanya-${urutan}`)?.focus()
  }, [soal.length])

  function tambahSoalKosong() {
    fokusSoalBaru.current = soal.length
    setSoal((sebelum) => [...sebelum, soalCepatKosong()])
  }

  function tempel() {
    const hasil = uraiSoalDariTeks(teksTempel)

    if (hasil.soal.length === 0) {
      setInfoTempel('Belum ada soal yang terbaca. Pastikan tiap soal diberi nomor dan pilihannya A., B., C.')
      return
    }

    const sisa = Math.max(0, MAKS_SOAL_CEPAT - soal.filter(soalCepatTerisi).length)
    const baru = hasil.soal.slice(0, sisa)

    setSoal((sebelum) => [...sebelum.filter(soalCepatTerisi), ...baru])
    setTeksTempel('')
    setBukaTempel(false)
    setInfoTempel(
      `${baru.length} soal ditambahkan.` +
        (hasil.soal.length > baru.length ? ` Sisanya dilewati (maksimal ${MAKS_SOAL_CEPAT} soal sekali jalan).` : '') +
        (hasil.tanpaKunci > 0
          ? ` ${hasil.tanpaKunci} soal tidak bertanda jawaban — jawabannya diset A, mohon periksa.`
          : '') +
        (hasil.tanpaTeks > 0
          ? ` ${hasil.tanpaTeks} soal pertanyaannya tidak terbaca — lengkapi sebelum membuat kuis.`
          : ''),
    )
  }

  /**
   * Papan tombol: Enter di pilihan pindah ke pilihan berikutnya (di pilihan
   * terakhir: soal baru), Ctrl/Cmd+Enter langsung membuat kuis.
   * @param {import('react').KeyboardEvent<HTMLElement>} e
   * @param {number} urutan
   * @param {number} posisi
   */
  function tekanOpsi(e, urutan, posisi) {
    if (e.key !== 'Enter' || e.shiftKey) return

    e.preventDefault()

    if (e.ctrlKey || e.metaKey) {
      kirim()
      return
    }

    if (posisi < HURUF_PILIHAN.length - 1) {
      // Isian tujuan sudah ada di layar, jadi cukup difokuskan langsung —
      // tidak perlu menunggu render lagi.
      document.getElementById(`kc-opsi-${urutan}-${posisi + 1}`)?.focus()
    } else if (urutan < soal.length - 1) {
      document.getElementById(`kc-tanya-${urutan + 1}`)?.focus()
    } else if (soal.length < MAKS_SOAL_CEPAT) {
      tambahSoalKosong()
    }
  }

  /** @param {number} urutan @param {Partial<import('./kuisCepat.js').SoalCepat>} ubah */
  function ubahSoal(urutan, ubah) {
    setSoal((sebelum) => sebelum.map((satu, i) => (i === urutan ? { ...satu, ...ubah } : satu)))
  }

  function kirim() {
    const pesan = galatKuisCepat({ judul, durasi, soal })

    setGalat(pesan)
    if (pesan === '') buat.mutate()
  }

  return (
    <div className="nle-kuis-cepat" role="group" aria-label="Buat kuis baru">
      <p className="fw-semibold small mb-1">Buat kuis baru di sini</p>
      <p className="small teks-lembut mb-2">
        Tidak perlu membuat soal di menu lain dulu. Tulis judul dan soalnya di bawah (Enter pindah ke
        pilihan berikutnya, Ctrl+Enter membuat kuis) — soal boleh dikosongkan dan dilengkapi nanti di
        menu Kuis.
      </p>

      {galat !== '' && <Banner jenis="salah">{galat}</Banner>}

      <div className="row g-2 mb-2">
        <div className="col-12 col-lg-8">
          <label className="form-label small mb-1" htmlFor="kc-judul">
            Judul kuis
          </label>
          <input
            id="kc-judul"
            className="form-control form-control-sm"
            maxLength={120}
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
          />
        </div>
        <div className="col-12 col-lg-4">
          <label className="form-label small mb-1" htmlFor="kc-durasi">
            Durasi (menit)
          </label>
          <input
            id="kc-durasi"
            className="form-control form-control-sm"
            type="number"
            min={1}
            max={600}
            value={durasi}
            onChange={(e) => setDurasi(e.target.value)}
          />
        </div>
      </div>

      {mapelId !== null && (
        <div className="mb-2">
          {!bukaTempel ? (
            <Tombol varian="tepi" ukuran="sedang" onClick={() => setBukaTempel(true)}>
              Tempel banyak soal sekaligus
            </Tombol>
          ) : (
            <div className="nle-kc-soal">
              <label className="form-label small fw-semibold mb-1" htmlFor="kc-tempel">
                Tempel soal (satu kali untuk semua)
              </label>
              <textarea
                id="kc-tempel"
                className="form-control form-control-sm mb-1"
                rows={8}
                placeholder={'1. Ibu kota Indonesia?\nA. Bandung\n*B. Jakarta\nC. Medan\n\n2. 2 + 2 = ?\nA. 3\nB. 4\nJawaban: B'}
                value={teksTempel}
                onChange={(e) => setTeksTempel(e.target.value)}
              />
              <p className="small teks-lembut mb-2">
                Beri nomor tiap soal, pilihan A. B. C. D. Tandai jawaban benar dengan * di depan
                pilihan, atau tulis baris “Jawaban: B”.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Tombol ukuran="sedang" disabled={teksTempel.trim() === ''} onClick={tempel}>
                  Ubah jadi soal
                </Tombol>
                <Tombol varian="teks" ukuran="sedang" onClick={() => setBukaTempel(false)}>
                  Tutup
                </Tombol>
              </div>
            </div>
          )}
          {infoTempel !== '' && (
            <p className="small mb-0 mt-1" role="status">
              {infoTempel}
            </p>
          )}
        </div>
      )}

      {mapelId === null ? (
        <p className="small teks-lembut">
          Materi ini belum punya mapel, jadi soal belum bisa dibuat dari sini. Kuisnya tetap dibuat
          kosong; lengkapi soalnya di menu Kuis.
        </p>
      ) : (
        soal.map((satu, urutan) => (
          <fieldset className="nle-kc-soal" key={`kc-soal-${urutan}`}>
            <legend className="small fw-semibold mb-1">Soal {urutan + 1} · pilihan ganda</legend>
            <textarea
              id={`kc-tanya-${urutan}`}
              className="form-control form-control-sm mb-2"
              rows={2}
              aria-label={`Pertanyaan soal ${urutan + 1}`}
              placeholder="Tulis pertanyaannya…"
              value={satu.teks}
              onChange={(e) => ubahSoal(urutan, { teks: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  kirim()
                }
              }}
            />
            {HURUF_PILIHAN.map((huruf, posisi) => (
              <div className="nle-kc-opsi" key={huruf}>
                <input
                  type="radio"
                  className="form-check-input"
                  name={`kc-benar-${urutan}`}
                  id={`kc-benar-${urutan}-${huruf}`}
                  checked={satu.benar === posisi}
                  aria-label={`Jadikan ${huruf} jawaban benar soal ${urutan + 1}`}
                  onChange={() => ubahSoal(urutan, { benar: posisi })}
                />
                <span className="fw-semibold small">{huruf}.</span>
                <input
                  id={`kc-opsi-${urutan}-${posisi}`}
                  className="form-control form-control-sm"
                  aria-label={`Pilihan ${huruf} soal ${urutan + 1}`}
                  onKeyDown={(e) => tekanOpsi(e, urutan, posisi)}
                  placeholder={posisi < 2 ? `Pilihan ${huruf}` : `Pilihan ${huruf} (boleh kosong)`}
                  value={satu.opsi[posisi]}
                  onChange={(e) =>
                    ubahSoal(urutan, {
                      opsi: satu.opsi.map((teks, i) => (i === posisi ? e.target.value : teks)),
                    })
                  }
                />
              </div>
            ))}
            <p className="small teks-lembut mb-1">Bulatan di kiri menandai jawaban yang benar.</p>
            {soal.length > 1 && (
              <Tombol
                varian="teks"
                ukuran="sedang"
                onClick={() => setSoal((sebelum) => sebelum.filter((_, i) => i !== urutan))}
              >
                Buang soal {urutan + 1}
              </Tombol>
            )}
          </fieldset>
        ))
      )}

      <div className="d-flex flex-wrap gap-2 mt-2">
        {mapelId !== null && (
          <Tombol
            varian="tepi"
            ukuran="sedang"
            disabled={soal.length >= MAKS_SOAL_CEPAT}
            onClick={tambahSoalKosong}
          >
            + Tambah soal
          </Tombol>
        )}
        <Tombol ukuran="sedang" memuat={buat.isPending} teksMemuat="Membuat kuis…" onClick={kirim}>
          Buat kuis &amp; pasang di klip
        </Tombol>
        <Tombol varian="teks" ukuran="sedang" disabled={buat.isPending} onClick={onBatal}>
          Batal
        </Tombol>
      </div>
    </div>
  )
}
