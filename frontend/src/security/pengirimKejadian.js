/**
 * Pengirim kejadian anti-cheat (slice 07).
 *
 * Aturan dari chunk anticheat yang dijaga di sini:
 * - identitas TIDAK ikut di payload (server membacanya dari sesi);
 * - kejadian dikirim berkelompok, maksimal 50 per permintaan;
 * - kejadian yang sama dalam jendela cooldown tidak dicatat dua kali (dedupe);
 * - antrean offline disimpan lokal, maksimal 200 entri / 48 jam;
 * - diulang bila tanpa respons, 5xx, 408, atau 429; dibuang bila 4xx lain.
 *
 * Modul ini murni (tanpa React/DOM) supaya bisa diuji tanpa jaringan; semua
 * ketergantungan (jam, penyimpanan, pengirim HTTP) disuntikkan.
 */

/** Jendela dedupe untuk kejadian yang sama (ms). */
export const COOLDOWN_MS = 1200

/** Batas entri antrean offline. */
export const BATAS_ANTREAN = 200

/** Umur maksimum entri antrean (ms) — 48 jam. */
export const UMUR_ANTREAN_MS = 48 * 60 * 60 * 1000

/** Batas kejadian per permintaan. */
export const BATAS_BERKELOMPOK = 50

/**
 * Apakah kegagalan ini layak dicoba lagi?
 *
 * Tanpa respons (jaringan mati), 5xx, 408, dan 429 berarti "coba lagi nanti";
 * 4xx lain berarti permintaannya memang salah, jadi entri dibuang agar antrean
 * tidak tumbuh selamanya.
 *
 * @param {unknown} galat
 * @returns {boolean}
 */
export function harusCobaLagi(galat) {
  const status = /** @type {{ response?: { status?: number } }} */ (galat)?.response?.status

  if (status === undefined) return true
  if (status === 408 || status === 429) return true
  if (status >= 500) return true

  return false
}

/**
 * Saring entri antrean yang sudah kedaluwarsa atau melebihi batas.
 *
 * @template {{ client_at: string }} T
 * @param {T[]} entri
 * @param {number} sekarang
 * @returns {T[]}
 */
export function rapikanAntrean(entri, sekarang) {
  const hidup = entri.filter((satu) => {
    const waktu = Date.parse(satu.client_at)

    if (Number.isNaN(waktu)) return false

    return sekarang - waktu <= UMUR_ANTREAN_MS
  })

  // Sisakan yang paling baru bila melebihi batas.
  return hidup.slice(-BATAS_ANTREAN)
}

/**
 * Buat pengirim kejadian untuk satu attempt.
 *
 * @param {{ attemptId: number,
 *   kirim: (attemptId: number, kejadian: Array<Record<string, unknown>>) => Promise<unknown>,
 *   jam?: () => number,
 *   baca?: (kunci: string) => string | null,
 *   tulis?: (kunci: string, nilai: string) => void,
 *   bersihkan?: (kunci: string) => void,
 *   kunciSimpan?: string }} opsi
 *
 * @returns {{
 *   catat: (kategori: string, rincian?: Record<string, unknown>) => boolean,
 *   jumlahTertunda: () => number,
 *   kirimSekarang: () => Promise<{ terkirim: number, gagal: boolean }>,
 * }}
 */
export function buatPengirimKejadian(opsi) {
  const {
    attemptId,
    kirim,
    jam = () => Date.now(),
    baca = () => null,
    tulis = () => {},
    bersihkan = () => {},
    kunciSimpan = `kejadian-ulangan-${attemptId}`,
  } = opsi

  /** @type {Array<{ kategori: string, client_at: string, rincian?: Record<string, unknown> }>} */
  let buffer = []
  /** @type {Record<string, number>} */
  const cooldown = {}

  // Antrean dari sesi sebelumnya (mis. jaringan mati lalu halaman ditutup).
  const tersimpan = baca(kunciSimpan)
  if (tersimpan) {
    try {
      const parsed = JSON.parse(tersimpan)
      if (Array.isArray(parsed)) {
        buffer = rapikanAntrean(/** @type {typeof buffer} */ (parsed), jam())
      }
    } catch {
      // data rusak diabaikan; lebih baik kehilangan catatan daripada gagal ujian
      bersihkan(kunciSimpan)
    }
  }

  function simpan() {
    if (buffer.length === 0) {
      bersihkan(kunciSimpan)
      return
    }

    tulis(kunciSimpan, JSON.stringify(buffer))
  }

  /**
   * Catat satu kejadian. Mengembalikan false bila ditolak dedupe.
   *
   * @param {string} kategori
   * @param {Record<string, unknown>} [rincian]
   */
  function catat(kategori, rincian) {
    const sekarang = jam()
    const terakhir = cooldown[kategori]

    // Cooldown: kejadian yang sama tidak dicatat dua kali dalam jendela singkat
    // (mis. tombol tempel ditekan berulang). Kejadian PERTAMA tidak pernah
    // dianggap duplikat — kalau tidak, catatan pertama bisa hilang hanya karena
    // jam perangkat kebetulan dimulai dari angka kecil.
    if (terakhir !== undefined && sekarang - terakhir < COOLDOWN_MS) {
      return false
    }

    cooldown[kategori] = sekarang

    /** @type {{ kategori: string, client_at: string, rincian?: Record<string, unknown> }} */
    const entri = {
      kategori,
      client_at: new Date(sekarang).toISOString(),
    }

    if (rincian !== undefined) {
      entri.rincian = rincian
    }

    buffer = rapikanAntrean([...buffer, entri], sekarang)
    simpan()

    return true
  }

  function jumlahTertunda() {
    return buffer.length
  }

  /**
   * Kirim seluruh antrean dalam kelompok maksimal 50.
   */
  async function kirimSekarang() {
    if (buffer.length === 0) return { terkirim: 0, gagal: false }

    let terkirim = 0
    let gagal = false

    while (buffer.length > 0) {
      const kelompok = buffer.slice(0, BATAS_BERKELOMPOK)

      try {
        await kirim(attemptId, kelompok)
        buffer = buffer.slice(kelompok.length)
        terkirim += kelompok.length
        simpan()
      } catch (galat) {
        gagal = harusCobaLagi(galat)

        if (!gagal) {
          // Ditolak permanen: buang agar antrean tidak macet selamanya.
          buffer = buffer.slice(kelompok.length)
          simpan()
          continue
        }

        break
      }
    }

    return { terkirim, gagal }
  }

  return { catat, jumlahTertunda, kirimSekarang }
}
