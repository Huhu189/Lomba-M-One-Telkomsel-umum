/**
 * Penilai kekuatan kata sandi untuk umpan balik di form daftar / atur ulang.
 * Hanya bantuan tampilan — aturan resmi (minimal 10 karakter) tetap di Zod
 * dan server. Tidak ada kata sandi yang dikirim ke mana pun dari sini.
 */

/**
 * @typedef {{ tingkat: 0|1|2|3|4, label: string, cukup: boolean, saran: string }} HasilKekuatan
 */

/**
 * @param {string} sandi
 * @returns {HasilKekuatan}
 */
export function nilaiKekuatanSandi(sandi) {
  if (sandi.length === 0) {
    return { tingkat: 0, label: '', cukup: false, saran: 'Minimal 10 karakter.' }
  }

  const panjang = sandi.length
  const macam = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(sandi)).length
  const unik = new Set(sandi).size

  // Sandi berulang ("aaaaaaaaaaaa") tidak dianggap kuat meskipun panjang.
  if (panjang >= 10 && unik <= 3) {
    return { tingkat: 1, label: 'Lemah', cukup: true, saran: 'Pakai huruf yang lebih beragam.' }
  }

  if (panjang < 10) {
    return {
      tingkat: panjang >= 6 ? 2 : 1,
      label: 'Belum cukup',
      cukup: false,
      saran: `Kurang ${10 - panjang} karakter lagi.`,
    }
  }

  if (panjang >= 14 && macam >= 3) {
    return { tingkat: 4, label: 'Sangat kuat', cukup: true, saran: 'Mantap!' }
  }
  if (macam >= 3 || panjang >= 14) {
    return { tingkat: 3, label: 'Kuat', cukup: true, saran: 'Bagus, sudah aman.' }
  }
  return {
    tingkat: 2,
    label: 'Cukup',
    cukup: true,
    saran: 'Tambah angka atau huruf besar agar lebih kuat.',
  }
}
