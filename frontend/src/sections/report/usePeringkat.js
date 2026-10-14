/**
 * Satu jalur data papan peringkat (slice 05), dua pemakai: halaman peringkat
 * dan panel "Papan peringkat" di perangkat murid (layar kelas, 14 Oktober 2026).
 *
 * Sengaja satu hook: papan di HP murid harus **sama persis** dengan papan di
 * halaman peringkatnya sendiri. Kalau komponen lain menyusun permintaannya
 * sendiri, cepat atau lambat keduanya berbeda — dan yang melihat perbedaannya
 * justru anak yang membandingkan HP-nya dengan papan di depan kelas. Aturan
 * "nomor hanya untuk N% teratas" dan penyembunyian jejak bonus tetap ditentukan
 * SERVER dari sesi pemanggilnya, jadi papan murid tidak punya jalan pintas.
 *
 * `top` ikut masuk kunci kueri supaya papan guru (50 baris) dan papan murid
 * (20 baris) tidak pernah berbagi simpanan yang sama.
 */
import { useQuery } from '@tanstack/react-query'
import { ambilPeringkat } from './api.js'

/** Papan guru ditarik lebih panjang: layar kelas menampung seisi kelas. */
export const TOP_GURU = 50

/**
 * Papan murid cukup seisi kelas yang benar-benar masuk; angka ini dipakai
 * halaman peringkat murid DAN panel layar kelas supaya keduanya identik.
 */
export const TOP_MURID = 20

/**
 * @param {string|number} kunci slug kuis (angka lama masih diterima server)
 * @param {{ sebagaiGuru?: boolean, top?: number, aktif?: boolean, selangMs?: number }} [opsi]
 *   `selangMs` > 0 = papan menyegarkan dirinya sendiri (dipakai panel layar
 *   kelas selama ditampilkan); halaman peringkat tidak perlu itu.
 */
export default function usePeringkat(kunci, opsi = {}) {
  const sebagaiGuru = opsi.sebagaiGuru === true
  const top = opsi.top ?? (sebagaiGuru ? TOP_GURU : TOP_MURID)
  const aktif = opsi.aktif ?? true
  const selangMs = opsi.selangMs ?? 0

  return useQuery({
    queryKey: ['peringkat', kunci, sebagaiGuru, top],
    queryFn: () => ambilPeringkat(kunci, top),
    enabled: aktif && kunci !== '' && kunci !== null && kunci !== undefined,
    refetchInterval: selangMs > 0 ? selangMs : false,
  })
}
