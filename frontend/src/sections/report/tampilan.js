/**
 * Fungsi tampilan murni untuk laporan slice 05 — dipisah dari komponen supaya
 * bisa diuji tanpa DOM (Vitest environment node).
 */

/** Tingkat pemahaman yang dikenali server. */
export const TINGKAT = {
  paham: 'paham',
  mulaiPaham: 'mulai_paham',
  belumPaham: 'belum_paham',
  dataMinimum: 'data_belum_cukup',
}

/**
 * Label + kelas lencana status untuk satu tingkat pemahaman.
 * @param {string} tingkat
 * @returns {{ label: string, kelas: string }}
 */
export function tingkatTampilan(tingkat) {
  switch (tingkat) {
    case TINGKAT.paham:
      return { label: 'Paham', kelas: 'badge-status sukses' }
    case TINGKAT.mulaiPaham:
      return { label: 'Mulai paham', kelas: 'badge-status peringatan' }
    case TINGKAT.belumPaham:
      return { label: 'Belum paham', kelas: 'badge-status salah' }
    default:
      return { label: 'Data belum cukup', kelas: 'badge-status lembut' }
  }
}

/**
 * Kelas CSS lencana badge per mapel (emas / perak / perunggu / bawaan).
 * @param {{ kode: string } | undefined} lencana
 * @returns {string}
 */
export function kelasLencana(lencana) {
  switch (lencana?.kode) {
    case 'emas':
      return 'lencana lencana-emas'
    case 'perak':
      return 'lencana lencana-perak'
    case 'perunggu':
      return 'lencana lencana-perunggu'
    default:
      return 'lencana lencana-pendukung'
  }
}

/**
 * Hitung jumlah tema per tingkat (untuk ringkasan di kepala halaman).
 * @param {Array<{ tingkat: string }>} tema
 * @returns {Record<string, number>}
 */
export function ringkasTingkat(tema) {
  const ringkasan = {
    [TINGKAT.paham]: 0,
    [TINGKAT.mulaiPaham]: 0,
    [TINGKAT.belumPaham]: 0,
    [TINGKAT.dataMinimum]: 0,
  }

  for (const satu of tema ?? []) {
    if (ringkasan[satu.tingkat] === undefined) ringkasan[satu.tingkat] = 0
    ringkasan[satu.tingkat] += 1
  }

  return ringkasan
}

/**
 * Urutkan peringkat mengikuti aturan server (dipakai saat menyusun ulang dari
 * data yang sudah ada): skor menurun, waktu selesai lebih cepat, lalu nama.
 * @template {{ skor: number, dikumpulkan_at: string|null, nama: string }} T
 * @param {T[]} daftar
 * @returns {T[]}
 */
export function urutkanPeringkat(daftar) {
  const waktu = (/** @type {{ dikumpulkan_at: string|null }} */ baris) =>
    baris.dikumpulkan_at === null ? Number.POSITIVE_INFINITY : Date.parse(baris.dikumpulkan_at)

  return [...(daftar ?? [])].sort((a, b) => {
    if (b.skor !== a.skor) return b.skor - a.skor
    if (waktu(a) !== waktu(b)) return waktu(a) - waktu(b)

    return a.nama.localeCompare(b.nama, 'id')
  })
}

/**
 * Peringkat pertama milik seorang murid (atau null).
 * @param {Array<{ murid_id: number|null }>} daftar
 * @param {number} muridId
 * @returns {{ murid_id: number|null }|null}
 */
export function milikMurid(daftar, muridId) {
  return (daftar ?? []).find((baris) => baris.murid_id === muridId) ?? null
}

/**
 * Apakah satu baris peringkat milik pemohon?
 *
 * Pada mode tim yang dibandingkan adalah tim, bukan murid — jadi murid yang
 * bergantian memakai satu akun tetap melihat barisnya tersorot (slice 09-C).
 *
 * @param {import('./api.js').DataBarisPeringkat} baris
 * @param {import('./api.js').DataBarisPeringkat|null|undefined} saya
 * @param {boolean} modeTim
 * @returns {boolean}
 */
export function barisMilikSaya(baris, saya, modeTim) {
  if (saya === null || saya === undefined) return false

  if (modeTim) {
    return baris.tim_id !== null && saya.tim_id !== null && baris.tim_id === saya.tim_id
  }

  return baris.murid_id !== null && baris.murid_id === saya.murid_id
}

/**
 * Angka rapi untuk dibaca manusia: 7.00 → 7, 7.5 → 7,5 (koma ala Indonesia).
 * Dipakai di catatan bonus supaya guru tidak membaca "7.000000005".
 *
 * @param {number} angka
 * @returns {string}
 */
export function angkaRapi(angka) {
  const dibulatkan = Math.round(Number(angka) * 100) / 100

  return String(dibulatkan).replace('.', ',')
}

/**
 * Angka yang DITAMPILKAN papan untuk satu baris.
 *
 * Papan guru membawa dua kebenaran sekaligus — nilai asli (`skor`) dan nilai
 * tampilan (`skor_tampil`) — dan yang naik ke papan selalu yang tampilan. Kalau
 * baris yang sama dibaca berbeda oleh guru dan murid, seluruh aturan bonusnya
 * bocor dalam sekejap: kelas melihat Dedi 2/10 di proyektor sementara anaknya
 * melihat 7/10 di perangkatnya. Baris murid tidak punya `skor_tampil`, jadi ia
 * jatuh ke `skor` — dan di situlah nilainya sudah dipindahkan server.
 *
 * @param {import('./api.js').DataBarisPeringkat|import('./api.js').DataDetailSaya} baris
 * @returns {{ nilai: number, maksimal: number, persen: number }}
 */
export function angkaTampil(baris) {
  return {
    nilai: typeof baris?.skor_tampil === 'number' ? baris.skor_tampil : Number(baris?.skor ?? 0),
    maksimal: Number(baris?.skor_maksimal ?? 0),
    persen: typeof baris?.persen_tampil === 'number' ? baris.persen_tampil : Number(baris?.persen ?? 0),
  }
}

/**
 * Catatan satu baris papan untuk mata GURU: berapa tambahannya, berapa nilai
 * aslinya, dan peringkat aslinya. `null` untuk baris yang tidak dibantu —
 * termasuk SEMUA baris yang diterima murid, karena server mengirim jejak bonus
 * hanya kepada guru.
 *
 * @param {import('./api.js').DataBarisPeringkat} baris
 * @returns {{ teks: string, asli: string, peringkatAsli: number|null }|null}
 */
export function catatanBonusBaris(baris) {
  if (baris?.berbantuan !== true || typeof baris.bonus !== 'number') return null

  const asli = `${angkaRapi(baris.skor)} / ${angkaRapi(baris.skor_maksimal)}`
  const peringkatAsli = typeof baris.peringkat_asli === 'number' ? baris.peringkat_asli : null

  return {
    teks: `dibantu +${angkaRapi(baris.bonus)} poin · nilai asli ${asli}`,
    asli,
    peringkatAsli,
  }
}

/**
 * Ringkasan aturan papan peringkat dari payload server.
 *
 * Halaman memakainya untuk MENJELASKAN aturan yang sedang berlaku, bukan
 * menebaknya dari jumlah baris yang kebetulan terkirim. Dua penjelasan yang
 * sengaja berbeda:
 *
 * - **murid** hanya diberi tahu bahwa nomor peringkat dibuka untuk N murid
 *   teratas (dan skornya sendiri tetap terlihat). Ia tidak pernah diberi tahu
 *   ada bonus — `catatanBonus` selalu `null` untuknya.
 * - **guru** melihat seluruh papan, dan karena itu juga melihat jejaknya:
 *   berapa murid yang dibantu dan seberapa besar tambahannya.
 *
 * @param {import('./api.js').DataPeringkat} data
 * @returns {{
 *   guru: boolean,
 *   terbukaPersen: number,
 *   terbukaJumlah: number,
 *   catatanKeterbukaan: string,
 *   bonusAktif: boolean,
 *   catatanBonus: string|null,
 *   jumlahDibantu: number,
 *   bonusBawahPersen: number,
 *   bonusMaksPersen: number,
 * }}
 */
export function ringkasAturanPapan(data) {
  const guru = data?.guru === true
  // Mode tim mengganti SATU kata di beberapa kalimat: yang diperingkat adalah
  // timnya, jadi "murid teratas" akan menyesatkan anak yang membacanya.
  const modeTim = data?.mode_tim === true
  const terbukaPersen = Number(data?.terbuka_persen ?? 0)
  const terbukaJumlah = Number(data?.terbuka_jumlah ?? 0)
  const bonusAktif = data?.bonus_aktif === true
  const bonusBawahPersen = Number(data?.bonus_bawah_persen ?? 0)
  const bonusMaksPersen = Number(data?.bonus_maks_persen ?? 0)
  const baris = Array.isArray(data?.peringkat) ? data.peringkat : []
  const jumlahDibantu = guru ? baris.filter((satu) => satu?.berbantuan === true).length : 0

  return {
    guru,
    terbukaPersen,
    terbukaJumlah,
    catatanKeterbukaan: guru
      ? `Murid hanya melihat ${terbukaJumlah} baris teratas (${terbukaPersen}% peserta); di layarmu seluruh papan terbuka.`
      : modeTim
        ? `Nomor peringkat dibuka untuk ${terbukaJumlah} tim teratas. Skor timmu sendiri tetap terlihat.`
        : `Nomor peringkat dibuka untuk ${terbukaJumlah} murid teratas. Skormu sendiri tetap terlihat.`,
    bonusAktif,
    catatanBonus:
      guru && bonusAktif
        ? `Bonus penyemangat aktif: murid di bawah ${bonusBawahPersen}% ditampilkan sampai titik tengah kelas (tambahan maksimal ${bonusMaksPersen}%). ${jumlahDibantu} baris bertanda “dibantu”, nilai aslinya tidak berubah.`
        : null,
    jumlahDibantu,
    bonusBawahPersen,
    bonusMaksPersen,
  }
}
