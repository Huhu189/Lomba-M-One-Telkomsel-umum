/**
 * Satu tempat untuk pertanyaan "siapa yang boleh mengubah?" (14 Okt 2026).
 *
 * Peran `admin` adalah kepala sekolah: ia melihat seluruh sekolah dan mengelola
 * akun guru/murid, tetapi **tidak mengubah data akademik** — kuis, soal, materi,
 * kelas, mapel, tag, nilai, dan tinjauan kecurangan tetap milik guru yang
 * mengerjakan ulangan itu.
 *
 * Servernya yang memutuskan (`User::bolehMengubahAkademik()` + policy tiap
 * bagian); berkas ini hanya cerminnya di klien, supaya tombol yang pasti ditolak
 * tidak ditampilkan sama sekali — guru yang menekan tombol lalu mendapat 403
 * hanya akan menyangka aplikasinya rusak.
 */
import { useAuthStore } from '../sections/auth/authStore.js'

/** @typedef {import('../sections/auth/authStore.js').DataUser} DataUser */

/**
 * Apakah pengguna ini kepala sekolah (hanya melihat)?
 *
 * Tamu (`undefined`) dan murid bukan "hanya melihat" — keduanya dibatasi oleh
 * pagar masing-masing, bukan oleh peran pemantau.
 *
 * @param {DataUser|null|undefined} user
 * @returns {boolean}
 */
export function hanyaMelihat(user) {
  return user?.role === 'admin'
}

/**
 * Versi hook untuk komponen halaman: `true` untuk kepala sekolah.
 * @returns {boolean}
 */
export function useHanyaMelihat() {
  return useAuthStore((s) => hanyaMelihat(s.user))
}
