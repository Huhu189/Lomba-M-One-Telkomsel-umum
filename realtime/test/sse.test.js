/**
 * Test SSE Live Monitor (slice 07).
 *
 * Redis disuntikkan sebagai tiruan supaya test tidak butuh server Redis:
 * yang diuji adalah aturan handshake, sifat sekali pakai, fail-open, dan
 * penerusan pesan pub/sub — bukan perilaku Redis itu sendiri.
 */
import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'
import crypto from 'node:crypto'
import http from 'node:http'
import { buildApp } from '../src/server.js'

/**
 * Jalankan app di port acak lalu ambil potongan awal respons sambil menutup
 * koneksi. `app.inject()` tidak dipakai untuk kasus 200 karena SSE memang
 * tidak pernah selesai — menunggunya akan menggantung selamanya.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {string} url
 * @returns {Promise<{ status: number, headers: Headers, teks: string }>}
 */
async function ambilAliran(app, url) {
  await app.listen({ port: 0, host: '127.0.0.1' })
  const alamat = app.server.address()
  const basis = `http://127.0.0.1:${alamat.port}`

  const pengawas = new AbortController()
  const respons = await fetch(`${basis}${url}`, { signal: pengawas.signal })

  const pembaca = respons.body.getReader()
  const { value } = await pembaca.read()
  const teks = new TextDecoder().decode(value ?? new Uint8Array())

  pengawas.abort()

  return { status: respons.status, headers: respons.headers, teks }
}

/** Hash tiket seperti perhitungan Laravel. */
function hashTiket(tiket) {
  return crypto.createHash('sha256').update(tiket).digest('hex')
}

/**
 * Ambil status + header aliran SSE memakai `node:http`, bukan `fetch`, karena
 * `fetch` melarang penulisan header `Origin` — dan justru header itu yang diuji.
 *
 * @param {import('fastify').FastifyInstance} app
 * @param {string} url
 * @param {Record<string, string>} headers
 */
async function ambilHeader(app, url, headers) {
  await app.listen({ port: 0, host: '127.0.0.1' })
  const alamat = app.server.address()

  return new Promise((resolve, reject) => {
    const permintaan = http.request(
      { host: '127.0.0.1', port: alamat.port, path: url, headers },
      (respons) => {
        const hasil = { status: respons.statusCode, headers: respons.headers }
        // Aliran SSE tidak pernah berakhir sendiri; ambil header lalu putuskan.
        respons.once('data', () => {
          resolve(hasil)
          permintaan.destroy()
        })
        respons.once('end', () => resolve(hasil))
      },
    )
    permintaan.on('error', reject)
    permintaan.end()
  })
}

/**
 * Redis tiruan: cukup untuk handshake + langganan.
 *
 * @param {object} opsi
 * @param {Record<string, string>} opsi.isi
 * @param {boolean} [opsi.gagal]
 */
function redisTiruan({ isi, gagal = false }) {
  const pelanggan = []
  /** Jejak pemanggilan penutupan koneksi langganan. */
  const jejak = { quit: 0, disconnect: 0, unsubscribeGagal: 0 }
  const utama = {
    status: 'ready',
    on() {},
    disconnect() {},
    async connect() {},
    async ping() {
      return 'PONG'
    },
    async getdel(kunci) {
      if (gagal) throw new Error('redis mati')

      const nilai = isi[kunci] ?? null
      delete isi[kunci]

      return nilai
    },
    duplicate() {
      const klien = {
        status: 'ready',
        pendengar: {},
        on(jenis, tangani) {
          this.pendengar[jenis] = tangani
        },
        removeListener() {},
        disconnect() {
          jejak.disconnect += 1
          // Meniru ioredis: penutupan paksa saat antrean belum selesai.
          throw new Error('Connection is closed.')
        },
        quit() {
          jejak.quit += 1
        },
        async connect() {},
        async subscribe(...kanal) {
          pelanggan.push({ kanal, klien: this })
        },
        // Meniru perintah yang ditolak karena koneksi ditutup.
        async unsubscribe() {
          jejak.unsubscribeGagal += 1
          throw new Error('Connection is closed.')
        },
        /** Kirim pesan seolah datang dari Redis. */
        kirimPesan(pesan, kanal = 'ulangan:kuis:1:guru') {
          this.pendengar.message?.(kanal, pesan)
        },
      }
      return klien
    },
  }
  return { utama, pelanggan, jejak }
}

describe('SSE Live Monitor', () => {
  it('menolak permintaan tanpa tiket', async () => {
    const { utama } = redisTiruan({ isi: {} })
    const app = buildApp({ logger: false, redis: utama })

    const respons = await app.inject({ method: 'GET', url: '/sse/monitor' })

    assert.equal(respons.statusCode, 400)
    assert.equal(JSON.parse(respons.body).alasan, 'tiket-tidak-ada')

    await app.close()
  })

  it('menolak tiket yang tidak terdaftar di Redis', async () => {
    const { utama } = redisTiruan({ isi: {} })
    const app = buildApp({ logger: false, redis: utama })

    const respons = await app.inject({
      method: 'GET',
      url: `/sse/monitor?tiket=${'a'.repeat(64)}`,
    })

    assert.equal(respons.statusCode, 401)
    assert.equal(JSON.parse(respons.body).alasan, 'tiket-tidak-berlaku')

    await app.close()
  })

  it('back-end fail-open: Redis mati menghasilkan 503, bukan crash', async () => {
    const { utama } = redisTiruan({ isi: {}, gagal: true })
    const app = buildApp({ logger: false, redis: utama })

    const respons = await app.inject({
      method: 'GET',
      url: `/sse/monitor?tiket=${'b'.repeat(64)}`,
    })

    // Klien memakai kode ini untuk jatuh ke polling; ulangan tetap jalan.
    assert.equal(respons.statusCode, 503)
    assert.equal(JSON.parse(respons.body).alasan, 'realtime-tidak-tersedia')

    await app.close()
  })

  it('menolak origin yang tidak diizinkan', async () => {
    const tiket = 'c'.repeat(64)
    const { utama } = redisTiruan({
      isi: { [`sse:tiket:${hashTiket(tiket)}`]: JSON.stringify({ user_id: 1, quiz_id: 1 }) },
    })
    const app = buildApp({ logger: false, redis: utama })

    const respons = await app.inject({
      method: 'GET',
      url: `/sse/monitor?tiket=${tiket}`,
      headers: { origin: 'http://situs-jahat.test' },
    })

    assert.equal(respons.statusCode, 403)
    assert.equal(JSON.parse(respons.body).alasan, 'origin-tidak-diizinkan')

    await app.close()
  })

  it('handshake tiket valid: 200 event-stream, tiket hilang setelah dipakai', async () => {
    const tiket = 'd'.repeat(64)
    const isi = {
      [`sse:tiket:${hashTiket(tiket)}`]: JSON.stringify({ user_id: 7, quiz_id: 1, nama: 'Guru', peran: 'guru' }),
    }
    const tiruan = redisTiruan({ isi })
    const app = buildApp({ logger: false, redis: tiruan.utama })

    const respons = await ambilAliran(app, `/sse/monitor?tiket=${tiket}`)

    assert.equal(respons.status, 200)
    assert.match(respons.headers.get('content-type'), /text\/event-stream/)
    // Tanpa header ini nginx menahan aliran sampai koneksi ditutup.
    assert.equal(respons.headers.get('x-accel-buffering'), 'no')

    // Peristiwa pembuka menyebut kuis yang benar.
    assert.match(respons.teks, /event: siap/)
    assert.match(respons.teks, /"quiz_id":1/)

    // Hanya kanal kuis itu DAN peran guru yang dilanggan: guru tidak menerima
    // kuis lain, dan murid tidak berbagi kanal dengannya (K-03).
    assert.equal(tiruan.pelanggan.length, 1)
    assert.deepEqual(tiruan.pelanggan[0].kanal, ['ulangan:kuis:1:guru'])

    // Tiket sekali pakai: kunci Redis sudah terhapus oleh GETDEL.
    assert.equal(isi[`sse:tiket:${hashTiket(tiket)}`], undefined)

    await app.close()
  })

  it('handshake membawa Access-Control-Allow-Origin agar EventSource tidak diblokir browser', async () => {
    const tiket = 'f'.repeat(64)
    const isi = {
      [`sse:tiket:${hashTiket(tiket)}`]: JSON.stringify({ user_id: 7, quiz_id: 1, peran: 'guru' }),
    }
    const { utama } = redisTiruan({ isi })
    const app = buildApp({ logger: false, redis: utama })

    const respons = await ambilHeader(app, `/sse/monitor?tiket=${tiket}`, {
      Origin: 'http://localhost:5173',
    })

    assert.equal(respons.status, 200)
    // Regresi yang pernah terjadi: status 200 tetapi tanpa header CORS membuat
    // browser menolak aliran diam-diam, sehingga Live Monitor selalu jatuh ke
    // polling padahal SSE-nya sehat.
    assert.equal(respons.headers['access-control-allow-origin'], 'http://localhost:5173')
    assert.equal(respons.headers['vary'], 'Origin')

    await app.close()
  })

  it('respons galat JSON juga membawa header CORS untuk origin yang diizinkan', async () => {
    const { utama } = redisTiruan({ isi: {} })
    const app = buildApp({ logger: false, redis: utama })

    const respons = await app.inject({
      method: 'GET',
      url: `/sse/monitor?tiket=${'g'.repeat(64)}`,
      headers: { origin: 'http://localhost:5173' },
    })

    assert.equal(respons.statusCode, 401)
    assert.equal(respons.headers['access-control-allow-origin'], 'http://localhost:5173')

    await app.close()
  })

  it('penutupan koneksi klien tidak pernah menjatuhkan service', async () => {
    const tiket = '1'.repeat(64)
    const isi = {
      [`sse:tiket:${hashTiket(tiket)}`]: JSON.stringify({ user_id: 5, quiz_id: 1, peran: 'guru' }),
    }
    const tiruan = redisTiruan({ isi })
    const app = buildApp({ logger: false, redis: tiruan.utama })

    /** @type {unknown[]} */
    const rejection = []
    const catatRejection = (sebab) => rejection.push(sebab)
    process.on('unhandledRejection', catatRejection)

    // Membuka lalu menutup aliran memicu jalur pembersihan yang, sebelum
    // diperbaiki, mematikan proses lewat promise `unsubscribe()` tanpa penangkap.
    const respons = await ambilAliran(app, `/sse/monitor?tiket=${tiket}`)
    assert.equal(respons.status, 200)

    await new Promise((r) => setTimeout(r, 60))
    process.removeListener('unhandledRejection', catatRejection)

    assert.deepEqual(rejection, [])
    // Penutupan memakai quit() yang menyelesaikan antrean, bukan disconnect()
    // yang membuang antrean dan melempar.
    assert.equal(tiruan.jejak.unsubscribeGagal, 1)
    assert.equal(tiruan.jejak.quit, 1)
    assert.equal(tiruan.jejak.disconnect, 0)

    await app.close()
  })

  it('tiket yang sama tidak bisa dipakai dua kali', async () => {
    const tiket = 'e'.repeat(64)
    const isi = {
      [`sse:tiket:${hashTiket(tiket)}`]: JSON.stringify({ user_id: 7, quiz_id: 1, peran: 'guru' }),
    }
    const { utama } = redisTiruan({ isi })
    const app = buildApp({ logger: false, redis: utama })

    const pertama = await ambilAliran(app, `/sse/monitor?tiket=${tiket}`)
    assert.equal(pertama.status, 200)

    const kedua = await app.inject({ method: 'GET', url: `/sse/monitor?tiket=${tiket}` })
    assert.equal(kedua.statusCode, 401)
    assert.equal(JSON.parse(kedua.body).alasan, 'tiket-tidak-berlaku')

    await app.close()
  })

  it('jalur /sse/kuis melayani perangkat murid di kanal muridnya sendiri', async () => {
    // Tiket murid (slice 10) hanya sah di jalur ini, dan kanalnya terpisah dari
    // kanal guru (K-03) supaya siaran Live Monitor tidak pernah sampai ke murid.
    const tiket = '2'.repeat(64)
    const isi = {
      [`sse:tiket:${hashTiket(tiket)}`]: JSON.stringify({ user_id: 12, quiz_id: 3, peran: 'murid' }),
    }
    const tiruan = redisTiruan({ isi })
    const app = buildApp({ logger: false, redis: tiruan.utama })

    const respons = await ambilAliran(app, `/sse/kuis?tiket=${tiket}`)

    assert.equal(respons.status, 200)
    assert.match(respons.headers.get('content-type'), /text\/event-stream/)
    assert.match(respons.teks, /"quiz_id":3/)
    assert.match(respons.teks, /"peran":"murid"/)
    assert.deepEqual(tiruan.pelanggan[0].kanal, ['ulangan:kuis:3:murid'])

    // Sekali pakai tetap berlaku di jalur ini.
    assert.equal(isi[`sse:tiket:${hashTiket(tiket)}`], undefined)

    const ulang = await app.inject({ method: 'GET', url: `/sse/kuis?tiket=${tiket}` })
    assert.equal(ulang.statusCode, 401)

    await app.close()
  })

  it('tiket murid ditolak di jalur guru, dan tiket guru ditolak di jalur murid (K-03)', async () => {
    const tiketMurid = '3'.repeat(64)
    const tiketGuru = '4'.repeat(64)
    const isi = {
      [`sse:tiket:${hashTiket(tiketMurid)}`]: JSON.stringify({ user_id: 12, quiz_id: 5, peran: 'murid' }),
      [`sse:tiket:${hashTiket(tiketGuru)}`]: JSON.stringify({ user_id: 9, quiz_id: 5, peran: 'guru' }),
    }
    const tiruan = redisTiruan({ isi })
    const app = buildApp({ logger: false, redis: tiruan.utama })

    // Sebelum ini tiket murid sah-sah saja membuka /sse/monitor dan menerima
    // siaran guru berisi attempt_id kecurangan.
    const muridKeMonitor = await app.inject({ method: 'GET', url: `/sse/monitor?tiket=${tiketMurid}` })
    assert.equal(muridKeMonitor.statusCode, 403)
    assert.equal(JSON.parse(muridKeMonitor.body).alasan, 'peran-tidak-cocok')

    const guruKeMurid = await app.inject({ method: 'GET', url: `/sse/kuis?tiket=${tiketGuru}` })
    assert.equal(guruKeMurid.statusCode, 403)
    assert.equal(JSON.parse(guruKeMurid.body).alasan, 'peran-tidak-cocok')

    // Tidak ada langganan yang dibuka untuk percobaan yang ditolak.
    assert.equal(tiruan.pelanggan.length, 0)

    await app.close()
  })

  it('tiket tanpa peran yang sah ditolak, bukan dianggap murid', async () => {
    const tiket = '5'.repeat(64)
    const isi = { [`sse:tiket:${hashTiket(tiket)}`]: JSON.stringify({ user_id: 12, quiz_id: 5 }) }
    const { utama } = redisTiruan({ isi })
    const app = buildApp({ logger: false, redis: utama })

    const respons = await app.inject({ method: 'GET', url: `/sse/kuis?tiket=${tiket}` })

    assert.equal(respons.statusCode, 403)
    assert.equal(JSON.parse(respons.body).alasan, 'peran-tidak-cocok')

    await app.close()
  })

  it('tanpa tiket, jalur /sse/kuis menolak seperti /sse/monitor', async () => {
    const { utama } = redisTiruan({ isi: {} })
    const app = buildApp({ logger: false, redis: utama })

    const respons = await app.inject({ method: 'GET', url: '/sse/kuis' })
    assert.equal(respons.statusCode, 400)
    assert.equal(JSON.parse(respons.body).alasan, 'tiket-tidak-ada')

    await app.close()
  })
})

after(() => {
  // Tidak ada sumber daya global yang perlu dibereskan.
})
