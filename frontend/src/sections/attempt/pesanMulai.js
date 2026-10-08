/**
 * Pesan dan kebijakan coba-lagi saat membuka ulangan (U-03).
 *
 * Dulu layar selalu menampilkan satu teks umum ("Mungkin gurumu belum
 * menerbitkan…") walau server sudah mengirim alasan jelas ("Kuis belum
 * dimulai", "Bukan untuk kelasmu", "Batas percobaan habis"), dan `retry: 1`
 * mengulang permintaan POST `mulai` yang ditolak 422 tanpa guna.
 */
import { pesanGalatApi } from '../auth/api.js'

/**
 * Status HTTP dari galat (undefined bila galat jaringan — layak dicoba lagi).
 *
 * @param {unknown} galat
 * @returns {number|undefined}
 */
export function statusGalatApi(galat) {
  const status = /** @type {{ response?: { status?: unknown } }} */ (galat)?.response?.status

  return typeof status === 'number' ? status : undefined
}

/**
 * Keterangan yang ditampilkan saat membuka ulangan gagal.
 *
 * @param {unknown} galat
 * @returns {{ judul: string, pesan: string, cobaLagi: boolean }}
 */
export function pesanMulaiGagal(galat) {
  const status = statusGalatApi(galat)

  // Galat jaringan: tidak ada respons sama sekali.
  if (status === undefined) {
    return {
      judul: 'Tidak bisa menghubungi server',
      pesan: 'Periksa koneksi internetmu, lalu coba lagi.',
      cobaLagi: true,
    }
  }

  if (status >= 500) {
    return {
      judul: 'Server sedang bermasalah',
      pesan: 'Ini bukan salahmu. Tunggu sebentar, lalu coba lagi.',
      cobaLagi: true,
    }
  }

  if (status === 403) {
    return {
      judul: 'Kamu tidak berhak membuka ulangan ini',
      pesan: pesanGalatApi(galat),
      cobaLagi: false,
    }
  }

  // 422 dan 4xx lain: aturan kuis (belum mulai, bukan kelasmu, batas percobaan).
  // Pesannya datang dari server dan bisa ditindaklanjuti murid/guru.
  return {
    judul: 'Ulangan belum bisa dibuka',
    pesan: pesanGalatApi(galat),
    cobaLagi: false,
  }
}

/**
 * Apakah permintaan membuka ulangan layak diulang otomatis.
 *
 * Jaringan dan 5xx boleh dicoba sekali lagi; 4xx bersifat permanen (mis. 422
 * "belum dimulai"), jadi mengulangnya hanya menambah beban tanpa harapan.
 *
 * @param {number} jumlahPercobaan
 * @param {unknown} galat
 * @returns {boolean}
 */
export function retryMulai(jumlahPercobaan, galat) {
  const status = statusGalatApi(galat)

  if (status !== undefined && status < 500) return false

  return jumlahPercobaan < 1
}
