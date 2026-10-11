/**
 * Riwayat jawaban lokal (sistem luring).
 *
 * Ini bukan pengganti cadangan jawaban (`simpananJawaban.js`), melainkan daftar
 * bukti yang bisa dibaca murid: kapan satu jawaban disimpan, di mana
 * (perangkat saja atau sudah diterima server), dan isinya secara ringkas.
 * Riwayat inilah yang membuat pekerjaan luring bisa dipertanggungjawabkan —
 * murid melihat apa yang benar-benar tersimpan lokal sebelum koneksi kembali.
 *
 * Aturan yang dijaga:
 * - hanya jawaban yang aman disimpan (bentuk JSON wajar, tidak melebihi kuota)
 *   yang masuk riwayat — sisanya ditolak, bukan ditulis setengah-setengah;
 * - NILAI jawaban tidak disimpan di sini (hanya ringkasannya); nilai mentah
 *   tetap di `simpananJawaban.js` supaya tidak ada dua sumber kebenaran;
 * - riwayat dihapus begitu hasil final diterima (submit) dan saat sesi berakhir;
 * - data dari localStorage selalu lewat Zod sebelum dipakai.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'

/** Kunci localStorage riwayat. */
export const KUNCI_SIMPANAN = 'ulangan-riwayat-jawaban-v1'

/** Jumlah baris riwayat maksimum per attempt (yang paling lama dibuang). */
export const BATAS_ENTRI = 200

/** Jumlah attempt yang riwayatnya disimpan di perangkat. */
export const BATAS_ATTEMPT = 10

/** Umur riwayat di perangkat (ms) — 7 hari. */
export const UMUR_SIMPAN_MS = 7 * 24 * 60 * 60 * 1000

/** Batas ukuran satu nilai jawaban yang boleh ditulis ke penyimpanan perangkat (karakter JSON). */
export const BATAS_PAYLOAD = 4000

/** Panjang ringkasan jawaban yang ditampilkan (karakter). */
export const BATAS_RINGKAS = 80

/** Jawaban baru ditulis ke perangkat, belum diterima server. */
export const STATUS_LOKAL = 'lokal'

/** Server sudah mengiyakan jawaban ini. */
export const STATUS_TERKIRIM = 'terkirim'

/** Satu baris riwayat (bentuknya divalidasi Zod saat dibaca dari localStorage). */
export const skemaEntri = z.object({
  soal_id: z.number(),
  nomor: z.number(),
  tipe: z.string(),
  ringkas: z.string(),
  at: z.number(),
  server_at: z.string(),
  status: z.enum([STATUS_LOKAL, STATUS_TERKIRIM]),
})

/** Isi riwayat yang tersimpan di perangkat. */
export const skemaRiwayat = z.object({
  aktif: z.boolean(),
  perAttempt: z.record(
    z.string(),
    z.object({
      entri: z.array(skemaEntri),
      disimpanAt: z.number(),
    }),
  ),
})

/**
 * @typedef {z.infer<typeof skemaEntri>} EntriRiwayat
 * @typedef {z.infer<typeof skemaRiwayat>} IsiRiwayat
 * @typedef {IsiRiwayat & {
 *   nyalakan: (aktif: boolean) => void,
 *   catat: (attemptId: number, data: { soal_id: number, nomor: number, tipe: string,
 *     jawaban: unknown, server_at: string, at?: number, status?: string }) => boolean,
 *   tandaiTerkirim: (attemptId: number, soalId: number) => void,
 *   ambil: (attemptId: number) => EntriRiwayat[],
 *   tertunda: (attemptId: number) => number,
 *   bersihkan: (attemptId: number) => void,
 *   bersihkanSemua: () => void,
 * }} StoreRiwayat
 */

/**
 * Potong teks panjang supaya ringkasan tidak mengambil alih layar.
 * @param {string} teks
 * @param {number} batas
 * @returns {string}
 */
function potong(teks, batas) {
  return teks.length <= batas ? teks : `${teks.slice(0, Math.max(1, batas - 1))}…`
}

/**
 * Ringkasan jawaban untuk ditampilkan murid.
 *
 * Bentuk jawaban berbeda per tipe soal (string isian, angka pilihan, boolean
 * benar-salah, daftar untuk mengurutkan, peta untuk menjodohkan/rumpang), jadi
 * ringkasannya dibuat manusiawi, bukan `JSON.stringify` mentah.
 *
 * @param {unknown} nilai
 * @param {number} [batas]
 * @returns {string}
 */
export function ringkasNilai(nilai, batas = BATAS_RINGKAS) {
  if (nilai === undefined || nilai === null) return 'dikosongkan'

  if (typeof nilai === 'string') {
    const teks = nilai.trim()

    return teks === '' ? 'dikosongkan' : potong(teks, batas)
  }

  if (typeof nilai === 'number') {
    return Number.isFinite(nilai) ? potong(String(nilai), batas) : 'angka tidak sah'
  }

  if (typeof nilai === 'boolean') return nilai ? 'benar' : 'salah'

  if (Array.isArray(nilai)) {
    if (nilai.length === 0) return 'dikosongkan'
    if (nilai.every((satu) => typeof satu === 'string')) return potong(nilai.join(' → '), batas)
    if (nilai.every((satu) => Array.isArray(satu))) return `${nilai.length} baris terisi`

    return `${nilai.length} pilihan tersusun`
  }

  if (typeof nilai === 'object') {
    const kunci = Object.keys(/** @type {Record<string, unknown>} */ (nilai))

    if (kunci.length === 0) return 'dikosongkan'

    const isi = /** @type {Record<string, unknown>} */ (nilai)
    const contoh = kunci
      .slice(0, 2)
      .map((satu) => (typeof isi[satu] === 'string' ? String(isi[satu]).trim() : '…'))
      .filter((satu) => satu !== '')

    return contoh.length === 0
      ? `${kunci.length} isian terisi`
      : potong(`${kunci.length} isian: ${contoh.join(', ')}`, batas)
  }

  return 'terisi'
}

/**
 * Bentuk JSON yang wajar (bisa ditulis dan dibaca kembali apa adanya).
 * @param {unknown} nilai
 * @param {number} kedalaman
 * @returns {boolean}
 */
function bentukSah(nilai, kedalaman) {
  if (kedalaman > 6) return false
  if (nilai === null) return true

  const jenis = typeof nilai

  if (jenis === 'string' || jenis === 'boolean') return true
  if (jenis === 'number') return Number.isFinite(nilai)
  if (Array.isArray(nilai)) return nilai.every((satu) => bentukSah(satu, kedalaman + 1))
  if (jenis === 'object') {
    return Object.values(/** @type {Record<string, unknown>} */ (nilai)).every((satu) =>
      bentukSah(satu, kedalaman + 1),
    )
  }

  return false
}

/**
 * Validasi sebelum menulis ke penyimpanan perangkat: bentuk wajib JSON wajar
 * (tanpa fungsi/undefined/NaN) dan tidak melebihi kuota yang kita sediakan.
 * Nilai `undefined` sah — artinya murid mengosongkan jawabannya.
 *
 * @param {unknown} nilai
 * @returns {boolean}
 */
export function amanDicatat(nilai) {
  if (nilai === undefined) return true
  if (!bentukSah(nilai, 0)) return false

  try {
    return JSON.stringify(nilai).length <= BATAS_PAYLOAD
  } catch {
    return false
  }
}

/**
 * Sisipkan satu baris riwayat: satu soal hanya punya satu baris (yang terbaru
 * menimpa yang lama), dan daftar dipangkas dari yang paling lama.
 *
 * @param {EntriRiwayat[]} daftar
 * @param {EntriRiwayat} entri
 * @param {number} [batas]
 * @returns {EntriRiwayat[]}
 */
export function sisipkanEntri(daftar, entri, batas = BATAS_ENTRI) {
  const tanpa = daftar.filter((satu) => satu.soal_id !== entri.soal_id)

  return [...tanpa, entri].slice(-batas)
}

/**
 * Buang attempt/baris yang sudah kedaluwarsa dan sisakan yang paling baru.
 *
 * @param {IsiRiwayat['perAttempt']} perAttempt
 * @param {number} sekarangMs
 * @param {{ batasAttempt?: number, umurMs?: number }} [opsi]
 * @returns {IsiRiwayat['perAttempt']}
 */
export function rapikanRiwayat(perAttempt, sekarangMs, opsi = {}) {
  const { batasAttempt = BATAS_ATTEMPT, umurMs = UMUR_SIMPAN_MS } = opsi

  const hidup = Object.entries(perAttempt)
    .filter(([, isi]) => Number.isFinite(isi.disimpanAt) && sekarangMs - isi.disimpanAt <= umurMs)
    .sort((a, b) => a[1].disimpanAt - b[1].disimpanAt)
    .slice(-batasAttempt)

  /** @type {IsiRiwayat['perAttempt']} */
  const hasil = {}

  for (const [kunci, isi] of hidup) {
    hasil[kunci] = isi
  }

  return hasil
}

/**
 * Jam:menit:detik dari perkiraan jam server — '—' bila tidak terbaca.
 *
 * Sengaja memakai `server_at` (perkiraan jam server, bukan jam mentah
 * perangkat): murid yang jam komputernya meleset tetap melihat urutan waktu
 * yang benar.
 *
 * @param {string} serverAt
 * @returns {string}
 */
export function formatWaktuRiwayat(serverAt) {
  const ms = Date.parse(serverAt)

  if (!Number.isFinite(ms)) return '—'

  const tanggal = new Date(ms)
  /** @param {number} angka */
  const dua = (angka) => String(angka).padStart(2, '0')

  return `${dua(tanggal.getHours())}:${dua(tanggal.getMinutes())}:${dua(tanggal.getSeconds())}`
}

/**
 * Store riwayat jawaban per attempt.
 * @type {import('zustand').UseBoundStore<import('zustand').StoreApi<StoreRiwayat>>}
 */
export const useRiwayatJawaban = create(
  persist(
    (set, get) => ({
      aktif: true,
      perAttempt: {},

      /** Saklar "simpan riwayat di perangkat ini" (bawaan: nyala). */
      nyalakan(aktif) {
        set({ aktif: aktif === true })
      },

      /**
       * Catat satu jawaban yang baru disimpan lokal.
       * @returns {boolean} false bila riwayat dimatikan atau nilainya tidak layak disimpan
       */
      catat(attemptId, data) {
        if (!get().aktif) return false
        if (!amanDicatat(data.jawaban)) return false

        const at = Number.isFinite(data.at) ? /** @type {number} */ (data.at) : Date.now()

        /** @type {EntriRiwayat} */
        const entri = {
          soal_id: data.soal_id,
          nomor: data.nomor,
          tipe: data.tipe,
          ringkas: ringkasNilai(data.jawaban),
          at,
          server_at: data.server_at,
          status: data.status === STATUS_TERKIRIM ? STATUS_TERKIRIM : STATUS_LOKAL,
        }

        set((state) => {
          const kunci = String(attemptId)
          const lama = state.perAttempt[kunci] ?? { entri: [], disimpanAt: at }

          return {
            perAttempt: {
              ...state.perAttempt,
              [kunci]: { entri: sisipkanEntri(lama.entri, entri), disimpanAt: at },
            },
          }
        })

        return true
      },

      /** Server sudah menerima jawaban soal ini. */
      tandaiTerkirim(attemptId, soalId) {
        set((state) => {
          const kunci = String(attemptId)
          const lama = state.perAttempt[kunci]

          if (lama === undefined) return state

          return {
            perAttempt: {
              ...state.perAttempt,
              [kunci]: {
                entri: lama.entri.map((satu) =>
                  satu.soal_id === soalId ? { ...satu, status: STATUS_TERKIRIM } : satu,
                ),
                disimpanAt: Date.now(),
              },
            },
          }
        })
      },

      /** @returns {EntriRiwayat[]} */
      ambil(attemptId) {
        return get().perAttempt[String(attemptId)]?.entri ?? []
      },

      /** Berapa jawaban yang masih hanya ada di perangkat ini. */
      tertunda(attemptId) {
        return (get().perAttempt[String(attemptId)]?.entri ?? []).filter(
          (satu) => satu.status === STATUS_LOKAL,
        ).length
      },

      /**
       * Bersihkan riwayat satu attempt — dipanggil setelah hasil final diterima
       * (submit). Riwayat adalah alat kerja luring, bukan arsip.
       */
      bersihkan(attemptId) {
        set((state) => {
          const perAttempt = { ...state.perAttempt }
          delete perAttempt[String(attemptId)]

          return { perAttempt }
        })
      },

      /** Bersihkan semua riwayat — dipakai saat keluar/sesi berakhir (S-14). */
      bersihkanSemua() {
        set({ perAttempt: {} })
      },
    }),
    {
      name: KUNCI_SIMPANAN,
      version: 1,
      /**
       * Data dari localStorage selalu lewat Zod (pagar mutu repo). Kalau isinya
       * rusak/bukan bentuk yang dikenal, riwayat dikosongkan — bukan dipakai
       * setengah-setengah.
       */
      merge: (tersimpan, sekarang) => {
        const hasil = skemaRiwayat.safeParse(tersimpan)

        if (!hasil.success) return sekarang

        return {
          ...sekarang,
          ...hasil.data,
          perAttempt: rapikanRiwayat(hasil.data.perAttempt, Date.now()),
        }
      },
    },
  ),
)
