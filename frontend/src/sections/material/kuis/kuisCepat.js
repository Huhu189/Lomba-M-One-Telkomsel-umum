/**
 * Logika murni "Buat kuis cepat" di editor materi: guru menulis kuis (judul +
 * beberapa soal pilihan ganda) langsung di dalam editor, tanpa lebih dulu
 * membuka menu Kuis dan Bank Soal. Muatan soalnya memakai pembangun yang sama
 * dengan editor soal (`muatanDariState`), jadi bentuknya pasti sama dengan soal
 * yang dibuat dari menu Bank Soal.
 */
import { muatanDariState, stateSoalKosong } from '../../question/tipeSoal.js'

/** Huruf pilihan jawaban (maksimal empat pilihan). */
export const HURUF_PILIHAN = ['A', 'B', 'C', 'D']

/** Batas soal yang boleh ditulis sekali jalan di editor materi. */
export const MAKS_SOAL_CEPAT = 10

/** Skor tiap soal buatan cepat (guru bisa mengubahnya di Bank Soal). */
export const SKOR_SOAL_CEPAT = '10'

/**
 * @typedef {{ teks: string, opsi: string[], benar: number }} SoalCepat
 */

/** @returns {SoalCepat} */
export function soalCepatKosong() {
  return { teks: '', opsi: ['', '', '', ''], benar: 0 }
}

/**
 * Soal yang pertanyaannya masih kosong dianggap belum ditulis dan dilewati
 * (jadi guru boleh membiarkan satu kotak kosong di ujung).
 * @param {SoalCepat} soal
 * @returns {boolean}
 */
export function soalCepatTerisi(soal) {
  return soal.teks.trim() !== ''
}

/**
 * Pesan galat satu soal ('' bila sah atau belum ditulis).
 * @param {SoalCepat} soal
 * @param {number} nomor nomor soal (mulai 1) untuk pesan
 * @returns {string}
 */
export function galatSoalCepat(soal, nomor) {
  if (!soalCepatTerisi(soal)) return ''

  const terisi = soal.opsi.filter((teks) => teks.trim() !== '')

  if (terisi.length < 2) return `Soal ${nomor}: isi minimal dua pilihan jawaban.`
  if ((soal.opsi[soal.benar] ?? '').trim() === '') {
    return `Soal ${nomor}: pilihan yang ditandai benar masih kosong.`
  }

  return ''
}

/**
 * Galat pertama dari seluruh isian kuis cepat ('' bila siap dikirim).
 * @param {{ judul: string, durasi: string, soal: SoalCepat[] }} draf
 * @returns {string}
 */
export function galatKuisCepat(draf) {
  if (draf.judul.trim() === '') return 'Judul kuis wajib diisi.'

  const durasi = Number(draf.durasi)

  if (!Number.isInteger(durasi) || durasi < 1 || durasi > 600) {
    return 'Durasi kuis harus berupa menit bulat antara 1 sampai 600.'
  }

  const nomorTerisi = draf.soal.filter(soalCepatTerisi)

  for (const [urutan, soal] of nomorTerisi.entries()) {
    const galat = galatSoalCepat(soal, urutan + 1)

    if (galat !== '') return galat
  }

  return ''
}

/**
 * Muatan siap kirim ke `POST /v1/soal`. Pilihan kosong dibuang dan sisanya diberi
 * ulang huruf berurutan (A, B, C, …) supaya tidak ada celah id; kunci jawaban
 * mengikuti pilihan yang ditandai benar.
 * @param {SoalCepat} soal
 * @param {number} mapelId
 * @returns {import('../../question/tipeSoal.js').MuatanSoal}
 */
export function muatanSoalCepat(soal, mapelId) {
  const dipakai = soal.opsi
    .map((teks, asal) => ({ teks: teks.trim(), asal }))
    .filter((satu) => satu.teks !== '')

  const opsi = dipakai.map((satu, urutan) => ({ id: HURUF_PILIHAN[urutan], teks: satu.teks }))
  const posisiBenar = dipakai.findIndex((satu) => satu.asal === soal.benar)

  return muatanDariState({
    ...stateSoalKosong(),
    subject_id: String(mapelId),
    teks: soal.teks.trim(),
    opsi,
    jawaban: HURUF_PILIHAN[Math.max(0, posisiBenar)],
    skor: SKOR_SOAL_CEPAT,
  })
}

/** Soal yang pilihannya terbaca tetapi kalimat pertanyaannya tidak ketemu. */
export const TEKS_SOAL_HILANG = '(pertanyaan belum terbaca — mohon lengkapi)'

/** Nomor soal: "1.", "1)", "(1)", "Soal 1:", "No. 1". Angka desimal ("1.5 kg") bukan nomor. */
const POLA_NOMOR = /^\s*(?:\(?\d+\s*[.)](?!\d)|(?:soal|no|nomor)\.?\s*\d+\s*[.):-]?)\s*(.+)$/i

/** Pilihan: "A.", "a)", "(A)", "*B." — E ke atas dikenali supaya bisa diabaikan, bukan dianggap pertanyaan. */
const POLA_PILIHAN = /^\s*(\*?)\s*\(?([A-Ea-e])\s*[.)]\s*(.+)$/

/** Kunci: "Jawaban: B", "Kunci: B", "Kunci Jawaban: B", "Jawab = B", "Answer: B". */
const POLA_KUNCI = /^\s*(?:kunci\s+jawaban|jawaban|jawab|kunci|answer)\s*[:=]\s*\(?([A-Ea-e])\)?(?![\p{L}\d])/iu

/**
 * Pecah baris yang berisi beberapa pilihan sekaligus ("A. Bandung B. Jakarta C. Medan")
 * menjadi satu pilihan per baris. Hanya dipecah bila huruf-hurufnya berurutan
 * (A, B, C, …) supaya kalimat biasa yang kebetulan memuat "B." tidak terbelah.
 * @param {string} baris
 * @returns {string[]}
 */
function pecahPilihanSebaris(baris) {
  const bagian = baris.split(/\s+(?=\*?\s*\(?[A-Ea-e]\s*[.)]\s+\S)/)

  if (bagian.length < 2) return [baris]

  const huruf = bagian.map((satu) => POLA_PILIHAN.exec(satu)?.[2]?.toUpperCase() ?? '')
  const berurutan = huruf.every((h, i) => h !== '' && (i === 0 || h.charCodeAt(0) === huruf[i - 1].charCodeAt(0) + 1))

  return berurutan && huruf[0] === 'A' ? bagian : [baris]
}

/**
 * Urai soal pilihan ganda dari teks tempelan (mis. dari Word/WhatsApp) supaya
 * guru tidak mengetik soal satu per satu.
 *
 * Format yang dikenali (huruf besar/kecil sama saja, `.` atau `)` sama saja):
 *
 *     1. Ibu kota Indonesia?
 *     A. Bandung
 *     *B. Jakarta        ← tanda * di depan = jawaban benar
 *     C. Medan
 *     Jawaban: B         ← atau "Kunci: B" / "Kunci Jawaban: B"
 *
 * Soal baru dimulai oleh: nomor ("1.", "1)", "Soal 1:"), baris kosong sesudah
 * pilihan, baris kunci jawaban, kalimat yang berakhir "?" / ":", atau huruf
 * pilihan yang berulang (mis. "A." muncul lagi). Dengan begitu soal tanpa nomor
 * pun tidak menimpa pilihan soal sebelumnya. Baris berhuruf kecil tanpa
 * penanda sesudah pilihan dianggap lanjutan pilihan itu (teks yang terpotong).
 * Pilihan E ke atas diabaikan. Soal tanpa tanda jawaban memakai A dan dihitung
 * di `tanpaKunci`; soal yang kalimat pertanyaannya tak ketemu diberi teks
 * pengganti dan dihitung di `tanpaTeks`, supaya guru diminta memeriksanya.
 * @param {string} teks
 * @returns {{ soal: SoalCepat[], tanpaKunci: number, tanpaTeks: number }}
 */
export function uraiSoalDariTeks(teks) {
  /** @typedef {SoalCepat & { adaKunci: boolean, hilang: boolean, lewati: boolean }} SoalUrai */
  /** @type {SoalUrai[]} */
  const hasil = []
  /** @type {SoalUrai|null} */
  let kini = null
  let adaJeda = false

  /**
   * Buat soal baru dan DIKEMBALIKAN (bukan ditugaskan ke variabel luar dari
   * dalam closure) supaya TypeScript tidak menyempitkan `kini` jadi `null`.
   * @param {string} awal
   * @returns {SoalUrai}
   */
  const mulai = (awal) => {
    const baru = {
      teks: awal.trim(),
      opsi: ['', '', '', ''],
      benar: 0,
      adaKunci: false,
      hilang: awal.trim() === '',
      lewati: false,
    }
    hasil.push(baru)
    return baru
  }

  /** @param {SoalUrai} soal */
  const posisiTerisiTerakhir = (soal) => soal.opsi.reduce((akhir, isi, i) => (isi !== '' ? i : akhir), -1)

  const baris = teks
    .replace(/\r/g, '')
    .split('\n')
    .flatMap((satu) => pecahPilihanSebaris(satu.trim()))

  for (const isi of baris) {
    if (isi.trim() === '') {
      adaJeda = true
      continue
    }

    const nomor = POLA_NOMOR.exec(isi)
    const pilihan = POLA_PILIHAN.exec(isi)
    const kunci = POLA_KUNCI.exec(isi)

    if (kunci && kini !== null) {
      const posisi = kunci[1].toUpperCase().charCodeAt(0) - 65

      if (posisi < 4) {
        kini.benar = posisi
        kini.adaKunci = true
      }
    } else if (nomor && !pilihan) {
      kini = mulai(nomor[1])
    } else if (pilihan && kini !== null) {
      const posisi = pilihan[2].toUpperCase().charCodeAt(0) - 65

      if (posisi > 3) {
        // Pilihan E ke atas diabaikan; lanjutannya pun ikut dilewati.
        kini.lewati = true
      } else {
        // Huruf yang sudah terisi / mundur = soal baru yang pertanyaannya tak terbaca,
        // bukan menimpa pilihan soal sebelumnya.
        if (kini.opsi[posisi] !== '' || posisi < posisiTerisiTerakhir(kini)) kini = mulai('')

        kini.lewati = false
        kini.opsi[posisi] = pilihan[3].trim()

        if (pilihan[1] === '*') {
          kini.benar = posisi
          kini.adaKunci = true
        }
      }
    } else if (kini === null) {
      kini = mulai(isi)
    } else if (posisiTerisiTerakhir(kini) === -1) {
      // Belum ada pilihan: lanjutan kalimat pertanyaan (kecuali sesudah baris kosong
      // yang bukan di dalam soal — itu tetap lanjutan, guru boleh memberi jeda).
      kini.teks = `${kini.teks}\n${isi.trim()}`.trim()
      kini.hilang = false
    } else {
      const selesai =
        adaJeda || kini.adaKunci || /[?:]\s*$/.test(isi) || /\.{3}|…|_{3}/.test(isi) || !/^[a-z(]/.test(isi)

      if (selesai) {
        kini = mulai(isi)
      } else if (!kini.lewati) {
        // Teks pilihan yang terpotong ke baris berikutnya.
        const akhir = posisiTerisiTerakhir(kini)
        kini.opsi[akhir] = `${kini.opsi[akhir]} ${isi.trim()}`
      }
    }

    adaJeda = false
  }

  const sah = hasil.filter((satu) => satu.teks !== '' || satu.opsi.some((o) => o !== ''))

  return {
    soal: sah.map(({ teks: isi, opsi, benar, hilang }) => ({
      teks: hilang ? TEKS_SOAL_HILANG : isi,
      opsi,
      benar,
    })),
    tanpaKunci: sah.filter((satu) => !satu.adaKunci).length,
    tanpaTeks: sah.filter((satu) => satu.hilang).length,
  }
}
