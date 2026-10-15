/**
 * Utilitas murni penyusunan kuis (papan 10).
 *
 * Dipisah dari HalamanKuis.jsx supaya aturan kelengkapan bisa diuji tanpa DOM.
 * Daftar di bawah adalah cermin `KuisService::galatKelengkapan()` di backend —
 * inilah yang benar-benar menahan publikasi; daftar ini hanya membuat guru tahu
 * lebih awal (server tetap otoritasnya).
 *
 * Sejak 14 Oktober 2026 penyusunan kuis **bukan lagi tiga langkah berurutan**:
 * isinya satu halaman dengan tiga bagian, dan `BAGIAN_KUIS` hanya dipakai pil
 * pelompat di atas halaman (nama bagian, bukan nama langkah yang harus dilalui).
 */
import { formatJadwal, keIso } from './status.js'

/** Nama bagian penyusunan kuis (dipakai pil pelompat). */
export const BAGIAN_KUIS = ['Info dan jadwal', 'Susun soal', 'Tinjau dan publikasi']

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
 * Apakah susunan soal sekarang berbeda dari yang tersimpan di server?
 *
 * Kenapa perlu (15 Oktober 2026): menyimpan kuis selalu mengirim susunan soal
 * ke server, padahal guru sering hanya mengubah setelannya — dan server MENOLAK
 * perubahan susunan selagi kuisnya berjalan (`KuisService::sinkronSoal` → 422
 * “Susunan soal tidak bisa diubah saat kuis sedang berjalan”). Akibatnya guru
 * yang cuma mengubah durasi atau kelas dari kuis yang sedang dipakai murid
 * mendapat galat yang sama sekali bukan perbuatannya.
 *
 * Perbandingannya **peka urutan**: memindahkan soal ke nomor lain tetap dihitung
 * berubah, karena urutan itulah yang dipakai saat pengacakan dimatikan.
 * @param {number[]} sekarang susunan di layar
 * @param {number[]} tersimpan susunan yang diketahui ada di server
 * @returns {boolean}
 */
export function susunanBerubah(sekarang, tersimpan) {
  if (sekarang.length !== tersimpan.length) return true

  return sekarang.some((id, urutan) => id !== tersimpan[urutan])
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
