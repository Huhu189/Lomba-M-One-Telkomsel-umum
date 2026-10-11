/**
 * Service realtime — Fastify + ioredis, tanpa akses database.
 *
 * Slice 00 memasang kerangka + endpoint kesehatan. Slice 07 menambahkan SSE
 * Live Monitor dengan aturan:
 * - **ticket sekali pakai**: guru meminta tiket dari Laravel, tiket didaftarkan
 *   ke Redis, dan di sini diambil atomik (GETDEL) lalu langsung hilang;
 * - **tanpa kredensial database**: service ini hanya mengenal Redis;
 * - **fail-open**: bila Redis tidak terjangkau, handshake ditolak dengan 503
 *   (bukan crash) sehingga klien jatuh ke polling dan ulangan tetap jalan;
 * - **keepalive**: komentar SSE berkala supaya proxy tidak menutup koneksi diam;
 * - **cek Origin**: hanya origin yang diizinkan yang boleh menyambung;
 * - **kanal per peran** (K-03): tiket guru hanya sah untuk `/sse/monitor` dan
 *   tiket murid hanya sah untuk `/sse/kuis`, dan masing-masing berlangganan
 *   kanal terpisah — murid tidak bisa lagi memantau siaran guru;
 * - **satu pelanggan Redis untuk semua aliran** (K-11): dulu tiap aliran SSE
 *   membuat koneksi langganannya sendiri (`duplicate()`). Satu kelas dengan
 *   Live Monitor terbuka berarti puluhan koneksi hanya untuk mendengarkan —
 *   Redis `maxclients` (bawaan 10.000) habis dan setiap koneksi memakan
 *   memori. Sekarang semua aliran berbagi SATU koneksi langganan dengan
 *   penyebaran pesan manual;
 * - **batas aliran** (K-11): satu akun hanya boleh membuka beberapa aliran
 *   sekaligus, dan service menolak aliran baru saat kapasitas totalnya penuh;
 * - **umur aliran dibatasi** (K-11): aliran lama dipaksa tutup supaya koneksi
 *   yang tertinggal (tab mati, jaringan putus tanpa FIN) tidak menumpuk;
 * - **log tanpa rahasia**: tiket dan cookie disunting dari log Fastify.
 */
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import Fastify from 'fastify'
import Redis from 'ioredis'

/** Selang keepalive (ms). */
export const KEEPALIVE_MS = 20000

/**
 * Umur maksimum satu aliran SSE (ms). Default 30 menit.
 *
 * Aliran yang sudah ditinggalkan tanpa penutupan bersih (tab dimatikan, jaringan
 * putus mendadak, perangkat hilang sinyal) tetap memakan slot koneksi. Dengan
 * batas ini, setiap slot paling lama terpakai setengah jam; klien yang masih
 * aktif meminta tiket baru — sama seperti perilaku saat jaringan sempat putus.
 */
export const UMUR_ALIRAN_MS = 30 * 60 * 1000

/** Batas jumlah aliran SSE serentak seluruh service (K-11). */
export const MAKS_ALIRAN_GLOBAL = 300

/** Batas jumlah aliran SSE serentak per akun (K-11). */
export const MAKS_ALIRAN_PER_PENGGUNA = 3

/**
 * Jalur yang disunting dari log.
 *
 * Tiket SSE adalah kunci sekali pakai: siapa pun yang membacanya dari berkas
 * log bisa menukarnya menjadi aliran monitor kelas — jadi tiket (dan cookie /
 * token) tidak boleh pernah tercatat.
 */
export const LOG_REDACT = ['req.query.tiket', 'req.headers.cookie', 'req.headers.authorization']

/**
 * Opsi logger Fastify (diekspor untuk test).
 *
 * `logger: false` tetap berarti senyap; selain itu jalur rahasia selalu
 * ditambahkan tanpa membuang pengaturan pemanggil.
 *
 * @param {boolean|object} [logger]
 */
export function opsiLogger(logger) {
  if (logger === false) return false

  const dasar = typeof logger === 'object' && logger !== null ? logger : {}

  return { ...dasar, redact: [...LOG_REDACT, ...(dasar.redact ?? [])] }
}

/** Origin yang diizinkan menyambung (dipisah koma lewat env). */
function daftarOrigin() {
  const mentah = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
  return mentah
    .split(',')
    .map((satu) => satu.trim())
    .filter((satu) => satu !== '')
}

/** Hash ticket seperti yang disimpan Laravel. */
function hashTiket(tiket) {
  return crypto.createHash('sha256').update(tiket).digest('hex')
}

/**
 * Peran yang sah untuk tiap jalur SSE.
 *
 * Dulu kedua jalur memakai penangan dan kanal yang sama, sehingga `peran` di
 * tiket tidak pernah diperiksa: tiket murid bisa dipakai membuka
 * `/sse/monitor` dan mendengarkan siaran guru (kejadian kecurangan).
 */
export const PERAN_JALUR = { monitor: 'guru', kuis: 'murid' }

/**
 * Nama kanal per kuis + per peran — harus sama persis dengan
 * `PenyiarRealtime::kanalGuru`/`kanalMurid` di Laravel.
 *
 * @param {'guru'|'murid'} peran
 * @param {number} kuisId
 */
export function kanalKuis(peran, kuisId) {
  return `ulangan:kuis:${kuisId}:${peran}`
}

/**
 * Bangun instance aplikasi Fastify (diekspor untuk test).
 *
 * @param {{ logger?: boolean|object, redis?: any, maksAliranGlobal?: number,
 *   maksAliranPerPengguna?: number, umurAliranMs?: number }} [options]
 */
export function buildApp(options = {}) {
  const app = Fastify({ logger: opsiLogger(options.logger ?? true) })

  // Batas bisa diatur lewat opsi (test) atau env; bawaannya konstanta di atas.
  const maksAliranGlobal = Number(options.maksAliranGlobal ?? process.env.SSE_MAKS_ALIRAN_GLOBAL ?? MAKS_ALIRAN_GLOBAL)
  const maksAliranPerPengguna = Number(
    options.maksAliranPerPengguna ?? process.env.SSE_MAKS_ALIRAN_PER_PENGGUNA ?? MAKS_ALIRAN_PER_PENGGUNA,
  )
  const umurAliranMs = Number(options.umurAliranMs ?? process.env.SSE_UMUR_ALIRAN_MS ?? UMUR_ALIRAN_MS)

  // Redis bisa disuntikkan pada test; bawaannya koneksi lazy ke REDIS_URL.
  const redis =
    options.redis ??
    new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: () => null,
    })

  if (typeof redis.on === 'function') {
    redis.on('error', (err) => {
      app.log.warn({ err: err.message }, 'redis tidak terjangkau (fail-open)')
    })
  }

  // ---- Satu pelanggan Redis untuk semua aliran (K-11) ----------------------
  // Dulu setiap aliran memanggil `redis.duplicate()` sendiri sehingga jumlah
  // koneksi naik sebanding dengan jumlah penonton. Sekarang satu koneksi
  // berlangganan seluruh kanal aktif, lalu pesan disebar ke tiap aliran.
  /** @type {Map<string, Set<(pesan: string) => void>>} */
  const pelanggan = new Map()
  /** Kanal yang sudah benar-benar di-SUBSCRIBE di Redis. */
  const kanalAktif = new Set()
  /** @type {any} */
  let pendengarBersama = null

  const buatPendengar = async () => {
    if (pendengarBersama) return pendengarBersama

    const koneksi = redis.duplicate()

    // Penangkap error sendiri: tanpa ini satu gangguan Redis mematikan proses.
    koneksi.on?.('error', (err) => {
      app.log.warn({ err: err.message }, 'koneksi langganan bermasalah (fail-open)')
    })

    if (koneksi.status === 'waiting') {
      await koneksi.connect()
    }

    koneksi.on('message', (kanal, pesan) => {
      const tujuan = pelanggan.get(kanal)
      if (!tujuan) return

      for (const kirim of tujuan) {
        try {
          kirim(pesan)
        } catch {
          // Satu klien sudah pergi; aliran lain tetap dilayani.
        }
      }
    })

    pendengarBersama = koneksi

    return koneksi
  }

  /**
   * Daftarkan satu aliran ke sebuah kanal, lalu pastikan kanalnya dilanggan.
   */
  const langganan = async (kanal, kirim) => {
    const tujuan = pelanggan.get(kanal) ?? new Set()
    tujuan.add(kirim)
    pelanggan.set(kanal, tujuan)

    if (kanalAktif.has(kanal)) return

    const koneksi = await buatPendengar()
    await koneksi.subscribe(kanal)
    kanalAktif.add(kanal)
  }

  /**
   * Lepas satu aliran; kanal di-UNSUBSCRIBE hanya bila tak ada penonton lagi.
   *
   * Dipisah dari `langganan` supaya penutupan satu aliran tidak mengganggu
   * aliran lain yang memakai kanal sama (satu kelas = satu kanal guru).
   */
  const batalLangganan = (kanal, kirim) => {
    const tujuan = pelanggan.get(kanal)
    if (!tujuan) return

    tujuan.delete(kirim)

    if (tujuan.size > 0) return

    pelanggan.delete(kanal)

    if (!kanalAktif.has(kanal) || pendengarBersama === null) return

    kanalAktif.delete(kanal)
    // Semua promise ditangani: `unsubscribe()` pada koneksi yang sudah tertutup
    // menolak promise, dan rejection tanpa penangkap mematikan proses.
    Promise.resolve()
      .then(() => pendengarBersama.unsubscribe(kanal))
      .catch(() => {})
  }

  /** Jumlah aliran SSE yang sedang terbuka. */
  let aliranAktif = 0
  /** @type {Map<number, number>} */
  const aliranPerPengguna = new Map()

  app.addHook('onClose', async () => {
    try {
      pendengarBersama?.quit?.()
    } catch {
      // sudah tertutup
    }
    redis.disconnect?.()
  })

  // EventSource adalah permintaan lintas asal (vite :5173 → service :4000).
  // Tanpa Access-Control-Allow-Origin, browser memblokir aliran SSE walau
  // statusnya 200 — persis yang membuat Live Monitor diam-diam jatuh ke polling.
  // Hook ini mencakup respons JSON; handshake SSE yang memakai writeHead manual
  // menambahkan headernya sendiri di bawah.
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin
    if (typeof origin === 'string' && daftarOrigin().includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin)
      reply.header('Vary', 'Origin')
    }
  })

  app.get('/health', async () => ({
    ok: true,
    service: 'realtime',
    time: new Date().toISOString(),
  }))

  app.get('/ready', async () => {
    let statusRedis = redis.status
    if (redis.status === 'waiting') {
      try {
        await redis.connect()
        await redis.ping()
        statusRedis = 'ready'
      } catch {
        statusRedis = 'down'
      }
    }
    return {
      ok: true,
      service: 'realtime',
      redis: statusRedis,
      time: new Date().toISOString(),
    }
  })

  /**
   * Handshake + aliran SSE satu kuis.
   *
   * Alur: ambil tiket dari Redis (GETDEL) → langganan kanal kuis → teruskan
   * setiap pesan → keepalive berkala. Koneksi ditutup begitu klien pergi.
   *
   * Dua jalur memakai penangan yang sama tetapi **peran yang berbeda**: guru
   * (`/sse/monitor`, slice 07) dan murid yang mengikuti layar guru
   * (`/sse/kuis`, slice 10). `peranWajib` dibaca dari jalurnya, dan tiket yang
   * perannya tidak cocok ditolak — inilah yang menutup K-03.
   *
   * Batas sumber daya (K-11) juga ditegakkan di sini: jumlah aliran serentak
   * per akun, kapasitas total, dan umur maksimum satu aliran.
   *
   * @param {'guru'|'murid'} peranWajib
   */
  const aliranKuis = (peranWajib) => async (request, reply) => {
    const tiket = /** @type {string|undefined} */ (request.query?.tiket)

    if (typeof tiket !== 'string' || tiket.length < 20) {
      return reply.code(400).send({ ok: false, alasan: 'tiket-tidak-ada' })
    }

    const origin = request.headers.origin
    if (typeof origin === 'string' && !daftarOrigin().includes(origin)) {
      return reply.code(403).send({ ok: false, alasan: 'origin-tidak-diizinkan' })
    }

    let isi = null

    try {
      if (redis.status === 'waiting') {
        await redis.connect()
      }

      // GETDEL = sekali pakai secara atomik; ticket yang dipakai ulang hilang.
      isi = await redis.getdel(`sse:tiket:${hashTiket(tiket)}`)
    } catch {
      // Fail-open: tanpa Redis, klien memakai polling.
      return reply.code(503).send({ ok: false, alasan: 'realtime-tidak-tersedia' })
    }

    if (isi === null || isi === undefined) {
      return reply.code(401).send({ ok: false, alasan: 'tiket-tidak-berlaku' })
    }

    let pemilik = null
    try {
      pemilik = JSON.parse(isi)
    } catch {
      return reply.code(401).send({ ok: false, alasan: 'tiket-rusak' })
    }

    const kuisId = Number(pemilik?.quiz_id)
    if (!Number.isInteger(kuisId) || kuisId <= 0) {
      return reply.code(401).send({ ok: false, alasan: 'tiket-tidak-lengkap' })
    }

    // Tiket murid tidak sah untuk Live Monitor, dan sebaliknya (K-03).
    // Tiket sudah terpakai (GETDEL) — memang begitu: klien yang salah jalur
    // harus meminta tiket baru, bukan memakai ulang yang lama.
    const peran = pemilik?.peran === 'guru' || pemilik?.peran === 'murid' ? pemilik.peran : null

    if (peran !== peranWajib) {
      return reply.code(403).send({ ok: false, alasan: 'peran-tidak-cocok' })
    }

    // Batas sumber daya (K-11). Tiket sudah terpakai di titik ini — disengaja:
    // klien yang ditolak cukup meminta tiket baru saat kapasitas longgar.
    const userId = Number(pemilik?.user_id)

    if (Number.isFinite(maksAliranGlobal) && maksAliranGlobal > 0 && aliranAktif >= maksAliranGlobal) {
      return reply.code(503).send({ ok: false, alasan: 'kapasitas-penuh' })
    }

    const dipakai = Number.isInteger(userId) ? aliranPerPengguna.get(userId) ?? 0 : 0

    if (Number.isInteger(userId) && dipakai >= maksAliranPerPengguna) {
      return reply.code(429).send({ ok: false, alasan: 'terlalu-banyak-koneksi' })
    }

    // Kita menulis langsung ke socket, jadi Fastify tidak boleh ikut mengirim
    // respons JSON apa pun setelah ini.
    reply.hijack()

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Mencegah buffering di nginx: tanpa ini SSE baru sampai saat koneksi tutup.
      'X-Accel-Buffering': 'no',
      // Wajib ada supaya EventSource dari origin frontend tidak diblokir browser.
      ...(typeof origin === 'string' ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    })

    reply.raw.write(`event: siap\ndata: ${JSON.stringify({ quiz_id: kuisId, peran: peranWajib })}\n\n`)

    // Hanya kanal kuis ini DAN peran ini: guru tidak menerima kuis kelas lain,
    // dan perangkat murid tidak pernah menerima siaran guru (K-03).
    const kanal = kanalKuis(peranWajib, kuisId)

    const teruskan = (pesan) => {
      try {
        reply.raw.write(`data: ${pesan}\n\n`)
      } catch {
        // klien sudah pergi; penutupan ditangani di bawah
      }
    }

    try {
      // Satu koneksi langganan dipakai bersama seluruh aliran (K-11):
      // `langganan` hanya menyambung/melanggan sekali per kanal.
      await langganan(kanal, teruskan)
    } catch {
      // Gagal berlangganan bukan alasan memutus: klien tetap mendapat siap +
      // keepalive, lalu polling di sisi klien melengkapi datanya.
      app.log.warn({ quizId: kuisId }, 'langganan pub/sub gagal (fail-open)')
    }

    aliranAktif += 1
    if (Number.isInteger(userId)) {
      aliranPerPengguna.set(userId, dipakai + 1)
    }

    const keepalive = setInterval(() => {
      try {
        reply.raw.write(': keepalive\n\n')
      } catch {
        // diabaikan; 'close' yang membereskan
      }
    }, KEEPALIVE_MS)

    // Umur aliran dibatasi (K-11): koneksi yatim tidak boleh menumpuk selamanya.
    // Klien yang masih aktif menyambung ulang dengan tiket baru.
    const pemaksaUmur = Number.isFinite(umurAliranMs) && umurAliranMs > 0
      ? setTimeout(() => {
          try {
            reply.raw.write('event: akhir\ndata: {"alasan":"umur"}\n\n')
            reply.raw.end()
          } catch {
            // klien sudah pergi
          }
        }, umurAliranMs)
      : null

    let sudahBersih = false

    /**
     * Tutup satu aliran SSE dengan sopan.
     *
     * Pelajaran dari smoke: memanggil `unsubscribe()`/`disconnect()` sambil
     * menyisakan perintah di antrean membuat ioredis menolak promise yang tidak
     * ada penangkapnya (`Connection is closed.`) dan **seluruh service mati** —
     * padahal yang terjadi hanya seorang guru menutup tab.
     * Karena itu: dijaga sekali jalan, semua promise ditangani, dan koneksi
     * langganan bersama baru ditutup saat service berhenti.
     */
    const bersihkan = () => {
      if (sudahBersih) return
      sudahBersih = true

      clearInterval(keepalive)
      if (pemaksaUmur !== null) clearTimeout(pemaksaUmur)

      aliranAktif -= 1
      if (Number.isInteger(userId)) {
        const sisa = (aliranPerPengguna.get(userId) ?? 1) - 1
        if (sisa <= 0) {
          aliranPerPengguna.delete(userId)
        } else {
          aliranPerPengguna.set(userId, sisa)
        }
      }

      batalLangganan(kanal, teruskan)
    }

    request.raw.on('close', bersihkan)
    reply.raw.on('close', bersihkan)

    // Fastify tidak boleh mengirim respons sendiri setelah writeHead manual.
    return reply
  }

  app.get('/sse/monitor', aliranKuis(PERAN_JALUR.monitor))
  app.get('/sse/kuis', aliranKuis(PERAN_JALUR.kuis))

  return app
}

/**
 * Jalankan server (hanya saat file dieksekusi langsung).
 */
export async function start() {
  const app = buildApp()
  try {
    await app.listen({
      port: Number(process.env.PORT ?? 4000),
      host: process.env.HOST ?? '0.0.0.0',
    })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

const dieksekusiLangsung =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (dieksekusiLangsung) {
  start()
}
