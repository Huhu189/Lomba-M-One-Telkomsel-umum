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
  defaultOptions: { queries: { retry: 1 } },
})
