/**
 * Lembar jawaban murid di Monitor Ulangan (15 Oktober 2026) — hitungan murni.
 *
 * Guru yang membuka satu murid ingin dua hal: **apa yang ditulis anak itu** dan
 * **mana yang masih kosong**. Keduanya dihitung dari respons server apa adanya
 * (`soal[].jawaban` + `soal[].terjawab`), bukan dari angka yang ditebak klien.
 *
 * Bentuk jawaban berbeda per tipe soal (huruf pilihan, daftar item, peta isian,
 * kalimat uraian), jadi pembacanya memakai satu mesin ringkasan yang sudah ada —
 * `ringkasNilai` di `sections/attempt/riwayatJawaban.js` — supaya monitor dan
 * riwayat milik murid tidak pernah menjelaskan jawaban yang sama dengan dua cara
 * berbeda. Yang ditambahkan di sini hanya penerjemahan **id opsi** menjadi bunyi
 * opsinya: jawaban pilihan ganda tersimpan sebagai `B`, dan `B` tanpa teks
 * opsinya tidak bisa dibaca siapa pun.
 */

import { ringkasNilai, formatWaktuRiwayat } from '../attempt/riwayatJawaban.js'

/**
 * Panjang ringkasan jawaban di lembar guru (karakter).
 *
 * Lebih panjang daripada ringkasan milik murid (80): guru menilai isi jawaban
 * uraian, jadi memotongnya di 80 karakter akan menghilangkan justru bagian yang
 * ia butuhkan. Batas ini tetap ada supaya satu jawaban panjang tidak mengambil
 * alih layar tabel.
 */
export const BATAS_RINGKAS_LEMBAR = 300

/**
 * Bunyi satu opsi ("B. 3/4") dari id yang tersimpan.
 * @param {{ id: string, teks: string }[]} opsi
 * @param {string} id
 * @returns {string|null} null bila id itu tidak ada di daftar opsi
 */
function bunyiOpsi(opsi, id) {
  const cari = opsi.find((satu) => satu.id === id)

  if (cari === undefined) return null

  return cari.teks.trim() === '' ? cari.id : `${cari.id}. ${cari.teks}`
}

/**
 * Jawaban murid dalam bahasa yang bisa dibaca guru.
 *
 * @param {import('./api.js').DataSoaLembarJawaban} soal
 * @param {number} [batas]
 * @returns {string}
 */
export function jawabanTerbaca(soal, batas = BATAS_RINGKAS_LEMBAR) {
  if (soal?.terjawab !== true) return 'belum dijawab'

  const opsi = Array.isArray(soal.opsi) ? soal.opsi : []
  const nilai = soal.jawaban

  // Pilihan tunggal: jawabannya id opsi.
  if (typeof nilai === 'string') {
    const label = bunyiOpsi(opsi, nilai.trim())

    if (label !== null) return potong(label, batas)
  }

  // Pilihan banyak (pilihan ganda kompleks, urut gambar): daftar id opsi.
  if (Array.isArray(nilai) && nilai.length > 0 && opsi.length > 0) {
    const label = nilai.map((satu) => (typeof satu === 'string' ? bunyiOpsi(opsi, satu) : null))

    if (label.every((satu) => satu !== null)) return potong(label.join(', '), batas)
  }

  return ringkasNilai(nilai, batas)
}

/**
 * Potong teks panjang (satu tempat, supaya pemotongan konsisten).
 *
 * @param {string} teks
 * @param {number} batas
 * @returns {string}
 */
function potong(teks, batas) {
  return teks.length <= batas ? teks : `${teks.slice(0, Math.max(1, batas - 1))}…`
}

/**
 * Progres lembar: berapa terjawab, dan nomor soal mana yang masih kosong.
 *
 * Dihitung dari baris yang benar-benar ditampilkan, bukan dari `attempt.terjawab`
 * di respons: kalau keduanya berbeda (mis. jawaban tersimpan tanpa baris soal),
 * angka di layar tetap cocok dengan daftar di bawahnya.
 *
 * @param {import('./api.js').DataSoaLembarJawaban[]} daftarSoal
 * @returns {{ terjawab: number, jumlah: number, belum: number, nomorKosong: number[] }}
 */
export function progresLembar(daftarSoal) {
  const nomorKosong = daftarSoal.filter((satu) => satu.terjawab !== true).map((satu) => satu.nomor)

  return {
    terjawab: daftarSoal.length - nomorKosong.length,
    jumlah: daftarSoal.length,
    belum: nomorKosong.length,
    nomorKosong,
  }
}

/**
 * Waktu jawaban terakhir diubah, dalam jam server (HH:MM:SS) — '—' bila belum
 * ada jawaban. Waktunya memakai `server_at`-nya `formatWaktuRiwayat`, yang
 * mengubah ISO server menjadi jam perangkat guru.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatWaktuJawaban(iso) {
  if (iso === null || iso === undefined || iso === '') return '—'

  return formatWaktuRiwayat(iso)
}
