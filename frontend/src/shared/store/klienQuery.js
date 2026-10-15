/**
 * Satu klien TanStack Query untuk seluruh aplikasi.
 *
 * Dipisah dari `main.jsx` supaya bisa dibersihkan dari luar komponen: cache
 * query memuat data milik murid yang sedang masuk (daftar ulangan, jawaban,
 * hasil). Di komputer lab yang dipakai bergantian, jejak itu tidak boleh
 * tertinggal setelah murid menekan "Keluar" — kunci query seperti `['attempt',
 * 7]` tidak memuat identitas pengguna, jadi murid berikutnya bisa melihat data
 * murid sebelumnya dari cache.
 *
 * Bawaannya sama dengan sebelumnya: satu kali percobaan ulang per query.
 */
import { QueryClient } from '@tanstack/react-query'

export const klienQuery = new QueryClient({
  defaultOptions: {
    queries: {
      // Satu kali ulang, kecuali penolakan pasti (401/403/404): mengulangnya tidak
      // mengubah hasil dan hanya melipatgandakan permintaan.
      retry: (jumlah, galat) => {
        const status = /** @type {any} */ (galat)?.response?.status
        if (status === 401 || status === 403 || status === 404) return false
        return jumlah < 1
      },
      // Fokus jendela TIDAK memicu pengambilan ulang.
      //
      // Bawaannya (`true`) membuat SETIAP query yang aktif diambil ulang begitu
      // peramban kembali difokuskan. Guru yang berpindah antara jendela aplikasi
      // dan jendela lain di komputer yang sama menembakkan seluruh daftar
      // sekaligus — kelas, murid, kesehatan server, monitor — dalam satu detik,
      // dan log server tampak seperti dibanjiri permintaan walaupun tidak ada
      // yang berubah. Data sesudah penyuntingan sudah dijamin segar lewat
      // `invalidateQueries` pada tiap mutasi, sedangkan halaman yang memang butuh
      // pembaruan berkala (monitor, layar kelas, status SSE) memasang
      // `refetchInterval` sendiri-sendiri.
      refetchOnWindowFocus: false,
    },
  },
})
