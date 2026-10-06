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
 * - **cek Origin**: hanya origin yang diizinkan yang boleh menyambung.
 */
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import Fastify from 'fastify'
import Redis from 'ioredis'

/** Selang keepalive (ms). */
export const KEEPALIVE_MS = 20000

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
 * Bangun instance aplikasi Fastify (diekspor untuk test).
 *
 * @param {{ logger?: boolean, redis?: any }} [options]
 */
export function buildApp(options = {}) {
  const app = Fastify({ logger: options.logger ?? true })

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

  app.addHook('onClose', async () => {
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
   * Handshake + aliran SSE Live Monitor.
   *
   * Alur: ambil tiket dari Redis (GETDEL) → langganan kanal kuis → teruskan
   * setiap pesan → keepalive berkala. Koneksi ditutup begitu klien pergi.
   */
  app.get('/sse/monitor', async (request, reply) => {
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

    reply.raw.write(`event: siap\ndata: ${JSON.stringify({ quiz_id: kuisId })}\n\n`)

    // Hanya kanal kuis ini: satu guru tidak perlu (dan tidak boleh) menerima
    // kejadian kuis kelas lain.
    const kanal = [`ulangan:kuis:${kuisId}`]
    const pendengar = redis.duplicate()

    const teruskan = (_kanal, pesan) => {
      try {
        reply.raw.write(`data: ${pesan}\n\n`)
      } catch {
        // klien sudah pergi; penutupan ditangani di bawah
      }
    }

    // Koneksi langganan harus punya penangkap error sendiri: tanpa ini, satu
    // gangguan Redis melempar event 'error' tanpa penangkap dan mematikan proses.
    pendengar.on?.('error', (err) => {
      app.log.warn({ err: err.message }, 'koneksi langganan bermasalah (fail-open)')
    })

    try {
      if (pendengar.status === 'waiting') {
        await pendengar.connect()
      }
      await pendengar.subscribe(...kanal)
      pendengar.on('message', teruskan)
    } catch {
      // Gagal berlangganan bukan alasan memutus: klien tetap mendapat siap +
      // keepalive, lalu polling di sisi klien melengkapi datanya.
      app.log.warn({ quizId: kuisId }, 'langganan pub/sub gagal (fail-open)')
    }

    const keepalive = setInterval(() => {
      try {
        reply.raw.write(': keepalive\n\n')
      } catch {
        // diabaikan; 'close' yang membereskan
      }
    }, KEEPALIVE_MS)

    let sudahBersih = false

    /**
     * Tutup satu aliran SSE dengan sopan.
     *
     * Pelajaran dari smoke: memanggil `unsubscribe()`/`disconnect()` sambil
     * menyisakan perintah di antrean membuat ioredis menolak promise yang tidak
     * ada penangkapnya (`Connection is closed.`) dan **seluruh service mati** —
     * padahal yang terjadi hanya seorang guru menutup tab.
     * Karena itu: dijaga sekali jalan, semua promise ditangani, dan penutupan
     * memakai `quit()` yang menyelesaikan antrean lebih dulu.
     */
    const bersihkan = () => {
      if (sudahBersih) return
      sudahBersih = true

      clearInterval(keepalive)
      pendengar.removeListener?.('message', teruskan)

      Promise.resolve()
        .then(() => pendengar.unsubscribe?.(...kanal))
        .catch(() => {})
        .finally(() => {
          try {
            pendengar.quit?.()
          } catch {
            // sudah tertutup
          }
        })
    }

    request.raw.on('close', bersihkan)
    reply.raw.on('close', bersihkan)

    // Fastify tidak boleh mengirim respons sendiri setelah writeHead manual.
    return reply
  })

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
