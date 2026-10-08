/**
 * Cadangan jawaban lokal saat jaringan/rel bermasalah.
 *
 * Aturan repo: jawaban DB dulu, cache belakangan; cadangan lokal TIDAK boleh
 * memuat kunci jawaban (hanya jawaban yang diketik murid) dan disimpan di
 * localStorage lewat Zustand persist supaya muat ulang tidak menghapus isian.
 *
 * Alur: setiap perubahan langsung dicatat ke `belumTerkirim`; setelah server
 * mengiyakan, entri ditandai terkirim. Saat halaman dibuka lagi, jawaban server
 * digabung dengan sisa antrean lokal (antrean menang karena lebih baru).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** @typedef {{ question_id: number, jawaban: unknown }} JawabanServer */

/**
 * @typedef {{
 *   jawaban: Record<string, unknown>,
 *   belumTerkirim: Record<string, unknown>,
 *   kunciIdempotensi: string,
 *   disimpanAt: number,
 * }} EntriCadangan
 */

/** Entri kosong untuk attempt baru. @returns {EntriCadangan} */
export function entriKosong() {
  return { jawaban: {}, belumTerkirim: {}, kunciIdempotensi: '', disimpanAt: 0 }
}

/**
 * Bandingkan dua nilai jawaban secara dangkal-tapi-cukup: bentuk nilai di sini
 * selalu string/angka/boolean/daftar sederhana (isian singkat, pilihan ganda,
 * menjodohkan), jadi perbandingan JSON sudah menentukan.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function samaNilai(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Gabung jawaban server dengan cadangan lokal.
 *
 * Cadangan hanya dipakai untuk entri yang MASIH di `belumTerkirim` — jawaban
 * yang belum pernah diterima server. `cadangan.jawaban` adalah salinan lokal
 * semata dan bisa lebih tua dari server (mode tim: anggota lain menyimpan
 * jawaban baru), jadi menimpakannya membuat layar tidak sama dengan yang
 * dinilai (Q-05).
 *
 * @param {JawabanServer[]} dariServer
 * @param {EntriCadangan} cadangan
 * @returns {Record<string, unknown>}
 */
export function gabungJawaban(dariServer, cadangan) {
  /** @type {Record<string, unknown>} */
  const hasil = {}

  for (const baris of dariServer) {
    hasil[String(baris.question_id)] = baris.jawaban
  }

  return { ...hasil, ...cadangan.belumTerkirim }
}

/**
 * Store cadangan jawaban per attempt.
 * @type {import('zustand').UseBoundStore<import('zustand').StoreApi<{
 *   perAttempt: Record<string, EntriCadangan>,
 *   catat: (attemptId: number, questionId: number, jawaban: unknown) => void,
 *   tandaiTerkirim: (attemptId: number, questionId: number, nilaiTerkirim: unknown) => void,
 *   ambil: (attemptId: number) => EntriCadangan,
 *   kunciIdempotensi: (attemptId: number, buat: () => string) => string,
 *   bersihkan: (attemptId: number) => void,
 *   bersihkanSemua: () => void,
 * }>>}
 */
export const useSimpananJawaban = create(
  persist(
    (set, get) => ({
      perAttempt: {},

      /** Catat jawaban murid + masuk antrean kirim. */
      catat(attemptId, questionId, jawaban) {
        set((state) => {
          const entri = state.perAttempt[String(attemptId)] ?? entriKosong()

          return {
            perAttempt: {
              ...state.perAttempt,
              [String(attemptId)]: {
                ...entri,
                jawaban: { ...entri.jawaban, [String(questionId)]: jawaban },
                belumTerkirim: { ...entri.belumTerkirim, [String(questionId)]: jawaban },
                disimpanAt: Date.now(),
              },
            },
          }
        })
      },

      /** Server sudah menyimpan jawaban ini — keluarkan dari antrean. */
      tandaiTerkirim(attemptId, questionId, nilaiTerkirim) {
        set((state) => {
          const entri = state.perAttempt[String(attemptId)]

          if (entri === undefined) return state

          const kunci = String(questionId)

          // Hanya buang entri yang isinya masih PERSIS nilai yang tadi dikirim.
          // Bila murid sudah mengetik nilai baru selagi permintaan berjalan,
          // nilai baru itu belum pernah tersimpan di server dan harus tetap
          // menunggu di antrean — kalau tidak, muat ulang menghapusnya (Q-03).
          if (!(kunci in entri.belumTerkirim) || !samaNilai(entri.belumTerkirim[kunci], nilaiTerkirim)) {
            return state
          }

          const belumTerkirim = { ...entri.belumTerkirim }
          delete belumTerkirim[kunci]

          return {
            perAttempt: {
              ...state.perAttempt,
              [String(attemptId)]: { ...entri, belumTerkirim, disimpanAt: Date.now() },
            },
          }
        })
      },

      /** @returns {EntriCadangan} */
      ambil(attemptId) {
        return get().perAttempt[String(attemptId)] ?? entriKosong()
      },

      /**
       * Kunci idempotensi per attempt — dibuat sekali supaya mengumpulkan dari
       * dua tab memakai kunci yang sama.
       * @returns {string}
       */
      kunciIdempotensi(attemptId, buat) {
        const entri = get().perAttempt[String(attemptId)] ?? entriKosong()

        if (entri.kunciIdempotensi !== '') return entri.kunciIdempotensi

        const kunci = buat()
        set((state) => ({
          perAttempt: {
            ...state.perAttempt,
            [String(attemptId)]: { ...entri, kunciIdempotensi: kunci, disimpanAt: Date.now() },
          },
        }))

        return kunci
      },

      /** Bersihkan setelah hasil final diterima. */
      bersihkan(attemptId) {
        set((state) => {
          const perAttempt = { ...state.perAttempt }
          delete perAttempt[String(attemptId)]

          return { perAttempt }
        })
      },

      /**
       * Bersihkan SEMUA cadangan — dipakai saat keluar (S-14).
       *
       * Cadangan ini disimpan di localStorage dan tidak terikat akun, sedangkan
       * komputer lab dipakai bergantian: murid berikutnya bisa membuka isian
       * jawaban murid sebelumnya hanya dengan membuka halaman ulangan yang sama.
       * Menyetel `perAttempt` jadi kosong sekaligus menimpa isi localStorage
       * lewat persist, jadi tidak ada sisa jawaban yang tertinggal di perangkat.
       */
      bersihkanSemua() {
        set({ perAttempt: {} })
      },
    }),
    { name: 'ulangan-cadangan-jawaban-v1' },
  ),
)
