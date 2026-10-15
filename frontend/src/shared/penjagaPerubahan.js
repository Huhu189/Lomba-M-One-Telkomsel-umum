/**
 * Penjaga perubahan yang belum tersimpan (14 Oktober 2026, temuan K3).
 *
 * Dua editor panjang — `sections/question/editor/EditorSoal.jsx` dan
 * `sections/material/editor/EditorMateri.jsx` — dulu membuang perubahan tanpa
 * peringatan: tautan menu, tombol Batal, tombol kembali peramban, dan refresh
 * langsung menghilangkan pekerjaan guru (badge "Belum tersimpan" terlalu kecil
 * untuk diandalkan). Berkas ini menyediakan dua hal yang dipakai keduanya:
 *
 * - `usePenjagaSebelumTutup(aktif)` — memasang `beforeunload` supaya peramban
 *   meminta konfirmasi saat halaman ditutup/disegarkan;
 * - `PESAN_BELUM_TERSIMPAN` — satu kalimat yang dipakai dialog konfirmasi di
 *   dalam aplikasi (memakai `DialogKonfirmasi`), jadi sebab & akibatnya sama di
 *   mana pun guru melihatnya.
 *
 * Yang TIDAK dilakukan di sini: mencegat navigasi sisi klien (menu samping,
 * tombol Kembali). Itu wilayah router; editor memakainya lewat dialog yang
 * dipasang di tombol keluarnya sendiri. Jadi jujur: peringatan berlaku untuk
 * penutupan/penyegaran halaman dan untuk tombol keluar di layar editor.
 */
import { useEffect } from 'react'

/** Kalimat tunggal untuk dialog konfirmasi keluar dengan perubahan tertahan. */
export const PESAN_BELUM_TERSIMPAN =
  'Perubahan yang belum disimpan akan hilang kalau keluar sekarang.'

/** Judul dialog konfirmasi yang sama di kedua editor. */
export const JUDUL_BELUM_TERSIMPAN = 'Ada perubahan yang belum tersimpan'

/**
 * Pasang peringatan bawaan peramban saat halaman ditutup atau disegarkan.
 *
 * `e.preventDefault()` + `returnValue` adalah cara standar; peramban modern
 * menampilkan teksnya sendiri (teks kustom sudah tidak dipakai), tetapi tanpa
 * salah satunya peringatannya tidak muncul sama sekali.
 *
 * @param {boolean} aktif pasang hanya saat benar-benar ada perubahan tertahan
 */
export function usePenjagaSebelumTutup(aktif) {
  useEffect(() => {
    if (!aktif) return undefined

    /** @param {BeforeUnloadEvent} peristiwa */
    function tangkap(peristiwa) {
      peristiwa.preventDefault()
      peristiwa.returnValue = ''
    }

    window.addEventListener('beforeunload', tangkap)

    return () => window.removeEventListener('beforeunload', tangkap)
  }, [aktif])
}
