/**
 * Kode perangkat siswa tamu (T1/T2).
 *
 * Tamu tidak punya email maupun kata sandi, jadi identitasnya tidak boleh
 * diturunkan dari nama: dua anak bernama sama akan berbagi akun, dan siapa pun
 * yang mengetik nama itu bisa melanjutkan pekerjaan anak lain. Sebagai gantinya
 * peramban membuat **satu kode acak** saat pertama kali membuka formulir tamu,
 * menyimpannya, lalu mengirimkannya setiap kali masuk tamu:
 *
 * - perangkat yang sama → akun yang sama (pekerjaan tidak hilang saat jaringan
 *   putus atau halaman dimuat ulang);
 * - perangkat berbeda → akun berbeda walau namanya sama;
 * - server memakai kode ini juga sebagai kunci pembatas laju, jadi satu kelas di
 *   balik satu alamat IP sekolah tidak saling mengunci.
 *
 * Kode juga dikirim balik oleh server (untuk klien yang belum punya) lewat
 * `simpanKode`; sampai kapan pun hanya kode inilah yang dianggap identitas.
 */

/** Kunci penyimpanan perangkat. Sengaja ber-prefix aplikasi, bukan nama generik. */
export const KUNCI_PERANGKAT = 'ulangan:perangkat-tamu'

/** Kode darurat bila `crypto.randomUUID` tidak ada (peramban lama / konteks non-aman). */
function kodeAcak() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const angka = crypto.getRandomValues(new Uint32Array(4))
      return Array.from(angka, (satu) => satu.toString(16).padStart(8, '0')).join('-')
    }
  } catch {
    // jatuh ke cadangan di bawah
  }

  return `tamu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Baca kode perangkat yang tersimpan, atau buat baru bila belum ada.
 *
 * Penyimpanan yang diblokir (mode privasi ketat, kuota penuh) tidak boleh
 * menggagalkan ulangan: dalam kasus itu kode hanya hidup selama halaman terbuka.
 *
 * @returns {string}
 */
export function kodePerangkat() {
  try {
    const tersimpan = window.localStorage.getItem(KUNCI_PERANGKAT)

    if (typeof tersimpan === 'string' && tersimpan.length >= 8) {
      return tersimpan
    }
  } catch {
    // penyimpanan diblokir: pakai kode sesi ini saja
  }

  const baru = kodeAcak()
  simpanKodePerangkat(baru)

  return baru
}

/**
 * Simpan kode perangkat (termasuk kode yang dibuat server).
 *
 * @param {unknown} kode
 */
export function simpanKodePerangkat(kode) {
  if (typeof kode !== 'string' || kode.length < 8) return

  try {
    window.localStorage.setItem(KUNCI_PERANGKAT, kode)
  } catch {
    // penyimpanan diblokir: diabaikan, masuk berikutnya akan memakai kode baru
  }
}

/**
 * Buang kode perangkat dari perangkat ini.
 *
 * Dipakai saat siswa tamu **menekan Keluar** di komputer yang dipakai
 * bergantian: tamu berikutnya di perangkat itu harus mulai sebagai dirinya
 * sendiri, bukan melanjutkan pekerjaan anak sebelumnya. Sesi tamu yang berakhir
 * sendiri (mis. cookie sesi kedaluwarsa) sengaja TIDAK membuang kodenya, supaya
 * anak yang sama bisa melanjutkan ulangannya.
 */
export function lupakanKodePerangkat() {
  try {
    window.localStorage.removeItem(KUNCI_PERANGKAT)
  } catch {
    // penyimpanan diblokir: tidak ada yang perlu dibuang
  }
}
