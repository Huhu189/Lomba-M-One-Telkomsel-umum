/**
 * Utilitas murni alur susun kuis tiga langkah (papan 10).
 *
 * Dipisah dari HalamanKuis.jsx supaya aturan kelengkapan bisa diuji tanpa DOM.
 * Daftar di bawah adalah cermin `KuisService::galatKelengkapan()` di backend —
 * inilah yang benar-benar menahan publikasi; daftar ini hanya membuat guru tahu
 * lebih awal (server tetap otoritasnya).
 */
import { formatJadwal, keIso } from './status.js'

/** Nama langkah pada pil langkah. */
export const LANGKAH_KUIS = ['Info dan jadwal', 'Susun soal', 'Tinjau dan publikasi']

/**
 * Jadwal singkat dari isi formulir (waktu lokal) untuk ringkasan langkah ketiga.
 * @param {string} mulai
 * @param {string} selesai
 * @returns {string}
 */
export function ringkasJadwal(mulai, selesai) {
  if (mulai === '' && selesai === '') return 'Tanpa jadwal'
  return `${mulai === '' ? '—' : formatJadwal(keIso(mulai))} s.d. ${
    selesai === '' ? '—' : formatJadwal(keIso(selesai))
  }`
}

/**
 * Jadwal selesai harus setelah mulai; jadwal kosong tidak dianggap melanggar
 * (kelengkapannya dilaporkan butir terpisah).
 * @param {string} mulai
 * @param {string} selesai
 * @returns {boolean}
 */
export function jadwalWajar(mulai, selesai) {
  if (mulai === '' || selesai === '') return true
  return new Date(selesai).getTime() > new Date(mulai).getTime()
}

/**
 * @typedef {{ ok: boolean, teks: string }} ButirKelengkapan
 */

/**
 * Kelengkapan kuis sebelum diterbitkan.
 * @param {{
 *   judul: string,
 *   subject_id: string,
 *   class_id: string,
 *   durasi_menit: string|number,
 *   mulai_at: string,
 *   selesai_at: string,
 * }} nilai isi formulir langkah 1
 * @param {{ jumlahSoal: number, adaSoalNonaktif: boolean }} susunan keadaan susunan soal
 * @returns {ButirKelengkapan[]}
 */
export function kelengkapanKuis(nilai, susunan) {
  return [
    { ok: nilai.judul.trim().length >= 3, teks: 'Judul terisi (minimal 3 huruf)' },
    { ok: nilai.subject_id !== '', teks: 'Mapel dipilih' },
    { ok: nilai.class_id !== '', teks: 'Kelas dipilih' },
    { ok: Number(nilai.durasi_menit) >= 1, teks: 'Durasi lebih dari 0 menit' },
    {
      ok: nilai.mulai_at !== '' && nilai.selesai_at !== '',
      teks: 'Jadwal mulai dan selesai terisi',
    },
    { ok: jadwalWajar(nilai.mulai_at, nilai.selesai_at), teks: 'Jadwal selesai setelah jadwal mulai' },
    { ok: susunan.jumlahSoal > 0, teks: 'Minimal satu soal dipilih' },
    { ok: !susunan.adaSoalNonaktif, teks: 'Semua soal yang dipilih aktif' },
  ]
}

/**
 * Semua butir harus lengkap sebelum tombol publikasi dinyalakan.
 * @param {ButirKelengkapan[]} butir
 * @returns {boolean}
 */
export function siapTerbit(butir) {
  return butir.every((satu) => satu.ok)
}

/**
 * Total poin dari soal yang dipilih; soal yang belum ada di halaman bank soal
 * yang sedang dimuat dihitung 0 (server tetap yang menghitung nilai nanti).
 * @param {number[]} soalTerpilih
 * @param {{ id: number, skor: number }[]} katalog
 * @returns {number}
 */
export function totalPoin(soalTerpilih, katalog) {
  return soalTerpilih.reduce((jumlah, id) => {
    const soal = katalog.find((satu) => satu.id === id)
    return jumlah + (soal?.skor ?? 0)
  }, 0)
}
