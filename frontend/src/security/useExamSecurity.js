/**
 * Orkestrator proteksi ulangan (slice 07: `useExamSecurity`).
 *
 * Prinsip yang dijaga (chunk anticheat):
 * - **fail-open**: kalau proteksi error, ulangan tetap jalan — semua pemasangan
 *   pendengar dibungkus try/catch dan tidak pernah melempar ke pohon React;
 * - **default mati**: kalau semua saklar mati, tidak ada satu pun pendengar
 *   dipasang dan tidak ada satu pun permintaan dikirim;
 * - **bukti, bukan vonis**: yang dilakukan hanya mencatat, memblokir aksi
 *   tertentu, dan memberi kabar ke murid.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { adaProteksiAktif, proteksiEfektif, SAKLAR_RINCI } from './pengaturanProteksi.js'
import { buatPengirimKejadian } from './pengirimKejadian.js'

/** Jeda kirim setelah kejadian terakhir (ms). */
const JEDA_KIRIM = 1500

/** Lama mengunci layar saat `focus_lock` menangkap keluar jendela (detik). */
const KUNCI_LAYAR_DETIK = 60

/** Lama mengaburkan layar saat deteksi ringan (detik). */
const BLUR_RINGAN_DETIK = 3

/** Selisih ukuran jendela yang dicurigai devtools (px). */
const AMBANG_DEVTOOLS_PX = 200

/** Label saklar untuk modal pemberitahuan. */
const LABEL_SAKLAR = {
  block_paste: 'Menempel jawaban dari luar diblokir dan dicatat.',
  block_right_click: 'Klik kanan dimatikan.',
  block_text_select: 'Menyeleksi teks dimatikan.',
  block_print: 'Halaman tidak bisa dicetak saat ulangan.',
  block_screenshot: 'Layar dikaburkan saat ada dugaan tangkapan layar.',
  block_devtools: 'Alat pengembang peramban dicatat.',
  detect_window_resize: 'Perubahan ukuran jendela dikaburkan sebentar.',
  block_tab_switch: 'Berpindah tab atau keluar jendela dicatat.',
  focus_lock: 'Keluar jendela mengunci layar 60 detik.',
  block_translate: 'Terjemahan otomatis diblokir.',
}

/** Saklar yang ikut tampil di pemberitahuan walau dipicu preset. */
const SAKLAR_DIBERITAHUKAN = [...SAKLAR_RINCI]

/**
 * Pasang proteksi ulangan untuk satu attempt.
 *
 * @param {{ attemptId: number, proteksi: unknown, aktif: boolean,
 *   kirim: (attemptId: number, kejadian: Array<Record<string, unknown>>) => Promise<unknown> }} opsi
 * @returns {{
 *   daftarSaklar: string[],
 *   jumlahKejadian: number,
 *   kabur: boolean,
 *   kunciDetik: number,
 *   setujui: () => void,
 * }}
 */
export default function useExamSecurity(opsi) {
  const { attemptId, proteksi, aktif, kirim } = opsi

  const efektif = useMemo(() => proteksiEfektif(proteksi), [proteksi])
  const menyala = useMemo(() => adaProteksiAktif(proteksi), [proteksi])

  const [jumlahKejadian, setJumlahKejadian] = useState(0)
  const [kabur, setKabur] = useState(false)
  const [kunciDetik, setKunciDetik] = useState(0)

  /** @type {import('react').MutableRefObject<ReturnType<typeof buatPengirimKejadian>|null>} */
  const pengirimRef = useRef(null)
  const timerKirim = useRef(0)

  /** Kirim antrean sekarang juga dan (bila gagal) biarkan tersimpan lokal. */
  const jalankanKirim = useCallback(async () => {
    if (pengirimRef.current === null) return

    await pengirimRef.current.kirimSekarang()
    setJumlahKejadian(pengirimRef.current.jumlahTertunda())
  }, [])

  useEffect(() => {
    if (!aktif || !menyala) {
      pengirimRef.current = null
      return
    }

    /** @type {(kunci: string) => string | null} */
    let baca = () => null
    /** @type {(kunci: string, nilai: string) => void} */
    let tulis = () => {}
    /** @type {(kunci: string) => void} */
    let hapus = () => {}

    try {
      baca = (kunci) => window.localStorage.getItem(kunci)
      tulis = (kunci, nilai) => window.localStorage.setItem(kunci, nilai)
      hapus = (kunci) => window.localStorage.removeItem(kunci)
    } catch {
      // penyimpanan diblokir: antrean hanya hidup selama halaman terbuka
    }

    pengirimRef.current = buatPengirimKejadian({ attemptId, kirim, baca, tulis, bersihkan: hapus })
    setJumlahKejadian(pengirimRef.current.jumlahTertunda())

    return () => {
      // Kejadian yang belum sempat terkirim tetap ada di antrean lokal.
      void pengirimRef.current?.kirimSekarang()
      pengirimRef.current = null
    }
  }, [aktif, menyala, attemptId, kirim])

  /**
   * Catat + jadwalkan pengiriman. Tidak pernah melempar: proteksi yang rusak
   * tidak boleh menghentikan ulangan.
   *
   * @param {string} kategori
   * @param {Record<string, unknown>} [rincian]
   */
  const catat = useCallback(
    /**
     * @param {string} kategori
     * @param {Record<string, unknown>} [rincian]
     */
    (kategori, rincian) => {
      const pengirim = pengirimRef.current
      if (pengirim === null) return

      let tercatat = false

      try {
        tercatat = pengirim.catat(kategori, rincian)
      } catch {
        return
      }

      if (!tercatat) return

      setJumlahKejadian(pengirim.jumlahTertunda())

      if (timerKirim.current === 0) {
        timerKirim.current = window.setTimeout(() => {
          timerKirim.current = 0
          void jalankanKirim()
        }, JEDA_KIRIM)
      }
    },
    [jalankanKirim],
  )

  /**
   * Kabur sebentar (deteksi ringan) tanpa mengirim ke backend.
   * @param {number} detik
   */
  const kaburkan = useCallback(
    /**
     * @param {number} detik
     */
    (detik) => {
      setKabur(true)
      window.setTimeout(() => setKabur(false), detik * 1000)
    },
    [],
  )

  // Pagar + sensor: hanya dipasang saat ada proteksi yang menyala.
  useEffect(() => {
    if (!aktif || !menyala) return undefined

    /** @type {Array<() => void>} */
    const bersihkan = []

    /**
     * Pasang satu pendengar dengan aman (fail-open).
     *
     * @param {EventTarget} sasaran
     * @param {string} jenis
     * @param {(e: Event) => void} tangani
     * @param {AddEventListenerOptions|boolean} [opsi]
     */
    function pasang(sasaran, jenis, tangani, opsi) {
      try {
        sasaran.addEventListener(jenis, tangani, opsi)
        bersihkan.push(() => sasaran.removeEventListener(jenis, tangani, opsi))
      } catch {
        // fail-open: pendengar yang gagal dipasang tidak menjatuhkan ulangan
      }
    }

    // --- Pagar: mencegah aksi tertentu, sekaligus mencatatnya ---

    if (efektif.block_paste === true) {
      pasang(document, 'paste', (e) => {
        e.preventDefault()
        catat('paste_attempt', { sumber: 'paste' })
      })
      pasang(document, 'drop', (e) => {
        e.preventDefault()
        catat('paste_attempt', { sumber: 'drop' })
      })
    }

    if (efektif.block_text_select === true) {
      pasang(document, 'selectstart', (e) => {
        e.preventDefault()
        catat('text_select_attempt', { sumber: 'selectstart' })
      })
      pasang(document, 'copy', (e) => {
        e.preventDefault()
        catat('text_select_attempt', { sumber: 'copy' })
      })
      pasang(document, 'cut', (e) => {
        e.preventDefault()
        catat('text_select_attempt', { sumber: 'cut' })
      })
    }

    if (efektif.block_right_click === true) {
      // Klik kanan diblokir tanpa catatan (chunk anticheat).
      pasang(document, 'contextmenu', (e) => e.preventDefault())
    }

    if (efektif.block_print === true) {
      // Cetak disembunyikan lewat CSS print (chunk anticheat) supaya soal tidak
      // bisa dibawa keluar sebagai kertas.
      try {
        const gaya = document.createElement('style')
        gaya.textContent = '@media print { body { display: none !important; } }'
        document.head.appendChild(gaya)
        bersihkan.push(() => gaya.remove())
      } catch {
        // fail-open
      }
    }

    if (efektif.block_translate === true) {
      pasang(document, 'contextmenu', (e) => e.preventDefault())
      try {
        document.documentElement.setAttribute('translate', 'no')
      } catch {
        // abaikan
      }
    }

    // --- Sensor: mencatat tanpa menghalangi ---

    if (efektif.block_devtools === true) {
      pasang(document, 'keydown', (e) => {
        const tombol = /** @type {KeyboardEvent} */ (e)
        const pintasan =
          tombol.key === 'F12' ||
          (tombol.ctrlKey && tombol.shiftKey && ['I', 'J', 'C'].includes(tombol.key.toUpperCase())) ||
          (tombol.ctrlKey && tombol.key.toUpperCase() === 'U')

        if (pintasan) {
          tombol.preventDefault()
          catat('devtools_shortcut', { tombol: tombol.key })
        }
      })

      // Selisih ukuran jendela dipakai hanya sebagai dugaan; false positive
      // mungkin, jadi catatannya jelas-jelas hanya bahan tinjauan guru.
      const periksaDevtools = () => {
        try {
          if (window.outerWidth - window.innerWidth > AMBANG_DEVTOOLS_PX) {
            catat('devtools_open', { selisih: String(window.outerWidth - window.innerWidth) })
          }
        } catch {
          // abaikan
        }
      }

      const timerDevtools = window.setInterval(periksaDevtools, 15000)
      bersihkan.push(() => window.clearInterval(timerDevtools))
      periksaDevtools()
    }

    if (efektif.detect_window_resize === true) {
      // Perubahan ukuran jendela hanya mengaburkan sebentar dan TIDAK dikirim
      // ke backend (chunk anticheat).
      pasang(window, 'resize', () => kaburkan(BLUR_RINGAN_DETIK))
    }

    if (efektif.block_screenshot === true) {
      pasang(document, 'keyup', (e) => {
        const tombol = /** @type {KeyboardEvent} */ (e)

        if (tombol.key === 'PrintScreen') {
          kaburkan(BLUR_RINGAN_DETIK)
          catat('screenshot_attempt', { tombol: 'PrintScreen' })
        }
      })
    }

    let pergiSebelumnya = 0

    if (efektif.block_tab_switch === true) {
      // Satu catatan per kepergian: kembali lalu pergi lagi = catatan baru.
      const tanganiSembunyi = () => {
        const sekarang = Date.now()
        if (document.hidden && sekarang - pergiSebelumnya > 1000) {
          pergiSebelumnya = sekarang
          catat('tab_switch', {})
        }
      }

      pasang(document, 'visibilitychange', tanganiSembunyi)

      if (efektif.focus_lock === true) {
        // Satu penghitung saja per effect: tanpa ini, keluar jendela berkali-kali
        // memasang beberapa interval yang berjalan bersamaan sehingga hitungan
        // 60 detik habis jauh lebih cepat dari yang tertulis.
        let timerKunci = 0

        const mulaiKunci = () => {
          setKunciDetik(KUNCI_LAYAR_DETIK)

          if (timerKunci !== 0) window.clearInterval(timerKunci)

          timerKunci = window.setInterval(() => {
            setKunciDetik((lama) => {
              if (lama <= 1) {
                window.clearInterval(timerKunci)
                timerKunci = 0
                return 0
              }
              return lama - 1
            })
          }, 1000)
        }

        pasang(window, 'blur', mulaiKunci)
        bersihkan.push(() => {
          if (timerKunci !== 0) window.clearInterval(timerKunci)
        })
      } else {
        pasang(window, 'blur', () => catat('window_blur', {}))
      }
    }

    // Ulangan yang ditinggalkan (tab ditutup / pindah halaman) tetap membawa
    // catatan yang belum terkirim.
    const tanganiKeluar = () => {
      void pengirimRef.current?.kirimSekarang()
    }

    pasang(window, 'pagehide', tanganiKeluar)

    return () => {
      for (const bersih of bersihkan) {
        try {
          bersih()
        } catch {
          // abaikan
        }
      }
    }
  }, [aktif, menyala, efektif, catat, kaburkan])

  // Bersihkan timer kirim saat meninggalkan halaman.
  useEffect(() => {
    return () => {
      if (timerKirim.current !== 0) window.clearTimeout(timerKirim.current)
    }
  }, [])

  const daftarSaklar = useMemo(
    () => SAKLAR_DIBERITAHUKAN.filter((saklar) => efektif[saklar] === true).map((saklar) => LABEL_SAKLAR[saklar]),
    [efektif],
  )

  return { daftarSaklar, jumlahKejadian, kabur, kunciDetik, setujui: jalankanKirim }
}
