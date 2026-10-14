// Smoke alur akun murid (slice 01) lewat browser sungguhan (CDP).
//
// Ini satu-satunya jalur besar yang belum pernah dibuka di peramban: `/daftar`,
// `/perlu-verifikasi`, `/verifikasi-email`, `/lupa-sandi`, dan
// `/atur-ulang-sandi` hanya punya uji backend (`AuthTest`) dan uji store di
// Vitest — tidak ada yang pernah menekan tombolnya.
//
// Dua hal yang membuat harness ini berbeda dari yang lain:
//
// 1. **Tautan emailnya benar-benar dibuka.** Harness membaca
//    `backend/storage/logs/laravel.log` untuk mengambil tautan verifikasi &
//    reset yang baru saja "dikirim", lalu membukanya di peramban. Itu hanya
//    bekerja kalau backend-nya memakai mailer `log` — dan itulah yang dilakukan
//    `docs/jalankan-smoke-ui.sh auth` (mailer `log`, bukan SMTP Gmail, supaya
//    tiap jalan smoke tidak mengirim email asli ke kotak masuk orang).
//    Kalau harness dijalankan di atas backend yang sudah hidup dengan mailer
//    lain, langkah bertanda (email) dilaporkan **DILEWATI** — tercetak jelas,
//    bukan diam-diam lulus.
// 2. **Akun uji dibuat lalu DIHAPUS**, dan penghapusannya diverifikasi dengan
//    mencoba masuk lagi.
//
// Yang diperiksa:
//
// - Validasi formulir yang benar-benar menghalangi pengiriman (nama, email,
//   sandi < 10, sandi tidak sama) di /daftar, /lupa-sandi, dan /atur-ulang-sandi.
// - Daftar murid → langsung masuk → mendarat di /perlu-verifikasi yang menyebut
//   emailnya, dan **gerbang akun pending** benar-benar menahan halaman lain.
// - Tautan verifikasi dari "email" membuka halaman berhasil, dan sesudah itu
//   gerbangnya terbuka.
// - Anti-enumerasi /lupa-sandi: jawabannya identik untuk email terdaftar dan
//   tidak terdaftar.
// - Tautan reset benar-benar mengubah kata sandi: masuk dengan sandi BARU
//   berhasil, dengan sandi LAMA gagal; tautan yang sama tidak berlaku dua kali
//   (halaman "tautan sudah pernah dipakai"); dan token salah **tidak**
//   menampilkan halaman "kata sandi sudah diganti".
//
// Prasyarat: backend 8000 (mailer log), vite 5173, Chrome :9333
// (dijalankan oleh `docs/jalankan-smoke-ui.sh auth`).
import { closeSync, openSync, readSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }

const TANDA = String(Date.now()).slice(-6)
const NAMA_UJI = `Smoke Auth ${TANDA}`
const EMAIL_UJI = `smoke.auth.${TANDA}@sekolah.test`
const EMAIL_ASING = `smoke.tidak.ada.${TANDA}@sekolah.test`
const SANDI_AWAL = 'RahasiaAwal123'
const SANDI_BARU = 'RahasiaBaru456'
/** Kata sandi yang dicoba lewat tautan yang sudah terpakai — tidak boleh berlaku. */
const SANDI_KETIGA = 'SandiKetigaTidakBoleh7'

/** Berkas log backend — sumber "email" yang dikirim aplikasi di dev. */
const BERKAS_LOG = fileURLToPath(new URL('../backend/storage/logs/laravel.log', import.meta.url))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ALAT = `window.__alat = {
  halaman() { return (document.querySelector('main')?.innerText ?? '').replace(/\\s+/g, ' ').trim() },
  teks(sel) { return document.querySelector(sel)?.textContent?.replace(/\\s+/g, ' ').trim() ?? '' },
  nilai(sel) { return document.querySelector(sel)?.value ?? null },
  tombolMati(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === teks)
    return tombol ? tombol.disabled : null
  },
  klikTeks(teks) {
    const tombol = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(teks))
    if (!tombol) return false
    tombol.click()
    return true
  },
  klikTautan(teks) {
    const tautan = [...document.querySelectorAll('a')].find((a) => (a.textContent ?? '').includes(teks))
    if (!tautan) return false
    tautan.click()
    return true
  },
  isi(sel, teks) {
    const el = document.querySelector(sel)
    if (!el) return false
    const tipe = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(tipe.prototype, 'value').set
    setter.call(el, teks)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  },
  /** Isi kolom berdasarkan label teks (halaman auth memakai label, bukan id). */
  isiLabel(label, teks) {
    const semua = [...document.querySelectorAll('label')]
    const el = semua
      .filter((l) => (l.textContent ?? '').trim().toLowerCase().startsWith(label.toLowerCase()))
      .map((l) => (l.getAttribute('for') ? document.getElementById(l.getAttribute('for')) : l.querySelector('input, textarea')))
      .find((kandidat) => kandidat !== null && kandidat !== undefined)
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, teks)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  },
  kirim() {
    const form = document.querySelector('form')
    if (!form) return false
    form.requestSubmit()
    return true
  },
  toast() { return [...document.querySelectorAll('.toast-item')].map((t) => (t.innerText ?? '').replace(/\\s+/g, ' ')).join(' | ') },
}`

const hasil = []
/** Langkah yang tidak bisa dijalankan (mis. tautan email tidak terbaca). */
const dilewati = []

function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos: Boolean(lolos) })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

function lewati(nama, alasan) {
  dilewati.push(nama)
  console.log(`DILEWATI · ${nama} · ${alasan}`)
}

/** Posisi baca log: hanya baris BARU yang diperiksa (log lama tidak ikut). */
let posisiLog = 0

function bacaLogBaru() {
  try {
    const ukuran = statSync(BERKAS_LOG).size
    if (ukuran < posisiLog) posisiLog = 0
    const panjang = ukuran - posisiLog
    if (panjang <= 0) return ''
    const fd = openSync(BERKAS_LOG, 'r')
    const buf = Buffer.alloc(panjang)
    readSync(fd, buf, 0, panjang, posisiLog)
    closeSync(fd)
    posisiLog = ukuran
    return buf.toString('utf8')
  } catch {
    return ''
  }
}

/**
 * Ambil tautan dari isi log. Surat di log bisa terbungkus quoted-printable
 * (`=\n` di tengah baris dan `=3D` untuk `=`), jadi isinya dirapikan dulu.
 * @param {string} teks
 * @param {string} penanda
 * @returns {string|null}
 */
function ambilTautan(teks, penanda) {
  const rapi = teks.replace(/=\r?\n/g, '').replace(/=3D/gi, '=')
  const cocok = [...rapi.matchAll(new RegExp(`https?://[^\\s"'<>()]*${penanda}[^\\s"'<>()]*`, 'g'))].map((m) =>
    m[0].replace(/&amp;/g, '&'),
  )
  return cocok.length > 0 ? cocok[cocok.length - 1] : null
}

/** Tunggu sampai log memuat tautan tertentu (surat dikirim saat itu juga). */
async function tungguTautan(penanda, batas = 15_000) {
  const mulai = Date.now()
  while (Date.now() - mulai < batas) {
    const tautan = ambilTautan(bacaLogBaru(), penanda)
    if (tautan !== null) return tautan
    await sleep(500)
  }
  return null
}

async function main() {
  const wsUrl = await fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
    }
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const myId = ++id
      pending.set(myId, { res, rej })
      ws.send(JSON.stringify({ id: myId, method, params, sessionId }))
    })

  /** Dua konteks: `baru` tanpa sesi (murid yang baru mendaftar) & `guru` (bersih-bersih). */
  async function pasang(browserContextId) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    await send('Page.enable', {}, sessionId)
    await send('Page.addScriptToEvaluateOnNewDocument', { source: ALAT }, sessionId)

    const evalJs = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
      if (r.exceptionDetails) {
        throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)))
      }
      return r.result.value
    }

    const buka = async (jalur) => {
      await send('Page.navigate', { url: APP + jalur }, sessionId)
      await sleep(2400)
    }

    const bukaPenuh = async (url) => {
      await send('Page.navigate', { url }, sessionId)
      await sleep(3000)
    }

    const tunggu = async (ekspresi, batas = 12_000) => {
      const mulai = Date.now()
      while (Date.now() - mulai < batas) {
        if (await evalJs(ekspresi)) return true
        await sleep(300)
      }
      return false
    }

    const apiJson = async (jalur, metode = 'GET', muatan = null) =>
      evalJs(`(async () => {
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
        const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '')
        const res = await fetch('/api${jalur}', {
          method: '${metode}',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
          body: ${muatan === null ? 'null' : `JSON.stringify(${JSON.stringify(muatan)})`},
        })
        return { status: res.status, isi: await res.json().catch(() => null) }
      })()`)

    const masuk = async (akun) => {
      if ((await evalJs('location.origin')) !== APP) await buka('/masuk')
      await apiJson('/v1/auth/keluar', 'POST')
      let jawab = await apiJson('/v1/auth/masuk', 'POST', akun)
      for (let coba = 0; coba < 3 && jawab?.status === 429; coba++) {
        console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
        await sleep(20_000)
        jawab = await apiJson('/v1/auth/masuk', 'POST', akun)
      }
      return jawab
    }

    return { evalJs, buka, bukaPenuh, tunggu, apiJson, masuk }
  }

  const { browserContextId: ctxBaru } = await send('Target.createBrowserContext')
  const { browserContextId: ctxGuru } = await send('Target.createBrowserContext')

  const murid = await pasang(ctxBaru)
  const guru = await pasang(ctxGuru)

  /** Bersihkan sisa log lama supaya hanya surat baru yang dibaca. */
  bacaLogBaru()

  let akunTerbuat = false

  try {
    // ---------- 1. Dari halaman masuk ke lupa sandi ----------
    await murid.buka('/masuk')
    catat('halaman masuk terbuka', await murid.tunggu(`__alat.halaman().includes('Selamat datang kembali')`), '')
    await murid.evalJs(`__alat.klikTautan('Lupa kata sandi?')`)
    catat(
      'tautan "Lupa kata sandi?" membawa ke /lupa-sandi',
      await murid.tunggu(`location.pathname === '/lupa-sandi'`),
      await murid.evalJs('location.pathname'),
    )

    await murid.evalJs('__alat.kirim()')
    catat(
      'email kosong ditolak sebelum dikirim',
      await murid.tunggu(`__alat.halaman().includes('Email wajib diisi.')`),
      await murid.evalJs('location.pathname'),
    )

    // ---------- 2. Anti-enumerasi: email tak dikenal tetap dijawab sama ----------
    await murid.evalJs(`__alat.isiLabel('Email', ${JSON.stringify(EMAIL_ASING)})`)
    await murid.evalJs('__alat.kirim()')
    catat(
      'email tak terdaftar pun dijawab "Cek email kamu" (anti-enumerasi)',
      await murid.tunggu(`__alat.halaman().includes('Cek email kamu') && __alat.halaman().includes(${JSON.stringify(EMAIL_ASING)})`, 15_000),
      (await murid.evalJs(`__alat.halaman()`)).slice(0, 130),
    )
    const jawabTakDikenal = await murid.evalJs(`__alat.halaman().replace(${JSON.stringify(EMAIL_ASING)}, 'EMAIL')`)
    catat(
      'jawabannya menyebut syarat "jika terdaftar", bukan membocorkan status akun',
      jawabTakDikenal.includes('terdaftar'),
      '',
    )

    // ---------- 3. Daftar murid: validasi dulu, baru kirim ----------
    await murid.buka('/daftar')
    catat('halaman daftar terbuka', await murid.tunggu(`__alat.halaman().includes('Buat akun murid')`), '')

    await murid.evalJs('__alat.kirim()')
    catat(
      'formulir kosong ditolak dengan pesan per kolom',
      await murid.tunggu(`__alat.halaman().includes('Nama minimal 2 karakter.')`) &&
        (await murid.evalJs(`__alat.halaman().includes('Email wajib diisi.')`)) &&
        (await murid.evalJs(`__alat.halaman().includes('Kata sandi minimal 10 karakter.')`)),
      await murid.evalJs(`__alat.halaman()`),
    )
    catat('tetap di halaman daftar (tidak ada apa pun yang dikirim)', (await murid.evalJs('location.pathname')) === '/daftar', '')

    await murid.evalJs(`__alat.isiLabel('Nama lengkap', ${JSON.stringify(NAMA_UJI)})`)
    await murid.evalJs(`__alat.isiLabel('Email', 'bukan-email')`)
    await murid.evalJs('__alat.kirim()')
    catat(
      'email yang tidak berbentuk email ditolak',
      await murid.tunggu(`__alat.halaman().includes('Format email tidak valid.')`),
      '',
    )

    await murid.evalJs(`__alat.isiLabel('Email', ${JSON.stringify(EMAIL_UJI)})`)
    await murid.evalJs(`__alat.isiLabel('Kata sandi', 'pendek')`)
    await murid.evalJs('__alat.kirim()')
    catat(
      'kata sandi kurang dari 10 karakter ditolak',
      await murid.tunggu(`__alat.halaman().includes('Kata sandi minimal 10 karakter.')`),
      '',
    )

    await murid.evalJs(`__alat.isiLabel('Kata sandi', ${JSON.stringify(SANDI_AWAL)})`)
    await murid.evalJs(`__alat.isiLabel('Ulangi kata sandi', 'RahasiaAwal124')`)
    await murid.evalJs('__alat.kirim()')
    catat(
      'ulangan kata sandi yang berbeda ditolak',
      await murid.tunggu(`__alat.halaman().includes('Kata sandi belum sama.')`),
      '',
    )

    // ---------- 4. Daftar sungguhan: langsung masuk, mendarat di verifikasi ----------
    await murid.evalJs(`__alat.isiLabel('Ulangi kata sandi', ${JSON.stringify(SANDI_AWAL)})`)
    await murid.evalJs('__alat.kirim()')
    const mendarat = await murid.tunggu(`location.pathname === '/perlu-verifikasi'`, 25_000)
    akunTerbuat = mendarat || (await murid.evalJs(`__alat.toast().includes('Akun dibuat')`))
    catat('pendaftaran berhasil & mendarat di /perlu-verifikasi', mendarat, await murid.evalJs('location.pathname'))
    catat(
      'halaman menyebut email yang harus diaktifkan & bahwa ia sudah masuk',
      await murid.tunggu(
        `__alat.halaman().includes(${JSON.stringify(EMAIL_UJI)}) && __alat.halaman().includes('Kamu sudah masuk sebagai')`,
      ),
      (await murid.evalJs(`__alat.halaman()`)).slice(0, 150),
    )

    // Surat verifikasi sudah dikirim oleh pendaftaran itu sendiri — tautannya
    // dibaca SEKARANG, sebelum langkah "kirim ulang" menambah surat kedua.
    const tautanVerifikasi = await tungguTautan('verifikasi-email')
    catat(
      '(email) surat verifikasi benar-benar dikirim & tautannya terbaca dari log',
      tautanVerifikasi !== null,
      tautanVerifikasi === null ? 'tidak ada di laravel.log' : tautanVerifikasi.slice(0, 60) + '…',
    )

    // ---------- 5. Gerbang akun pending ----------
    await murid.buka('/')
    catat(
      'akun yang belum verifikasi dipantulkan kembali ke /perlu-verifikasi',
      await murid.tunggu(`location.pathname === '/perlu-verifikasi'`, 15_000),
      `pathname: ${await murid.evalJs('location.pathname')}`,
    )
    await murid.buka('/kuis')
    catat(
      'halaman lain pun ikut tertahan',
      await murid.tunggu(`location.pathname === '/perlu-verifikasi'`, 15_000),
      `pathname: ${await murid.evalJs('location.pathname')}`,
    )

    // ---------- 6. Tautan yang tidak benar dijelaskan apa adanya ----------
    await murid.buka('/verifikasi-email')
    catat(
      'halaman verifikasi tanpa status mengatakan tautannya tidak berlaku',
      await murid.tunggu(`__alat.halaman().includes('Tautan tidak berlaku')`),
      '',
    )

    // ---------- 7. (email) Kirim ulang lalu buka tautannya ----------
    await murid.buka('/perlu-verifikasi')
    await murid.evalJs(`__alat.klikTeks('Kirim ulang')`)
    const pesanKirimUlang = await murid.tunggu(
      `__alat.toast().includes('dikirim') || __alat.halaman().includes('sudah kami kirim') || __alat.halaman().includes('Kami mengirim')`,
      20_000,
    )
    catat('kirim ulang tautan verifikasi dijawab halaman/notifikasi', pesanKirimUlang, (await murid.evalJs(`__alat.toast()`)).slice(0, 120))

    if (tautanVerifikasi === null) {
      lewati(
        'buka tautan verifikasi dari email',
        'tautan tidak ada di storage/logs/laravel.log — backend ini memakai mailer lain (jalankan lewat `docs/jalankan-smoke-ui.sh auth`)',
      )
    } else {
      await murid.bukaPenuh(tautanVerifikasi)
      catat(
        'tautan verifikasi dari email membuka halaman berhasil',
        await murid.tunggu(`location.pathname === '/verifikasi-email' && __alat.halaman().includes('Email terverifikasi')`, 20_000),
        `${await murid.evalJs('location.pathname')} · ${(await murid.evalJs(`__alat.halaman()`)).slice(0, 90)}`,
      )

      await murid.buka('/')
      catat(
        'sesudah verifikasi, gerbang akun pending terbuka',
        await murid.tunggu(`location.pathname === '/' && !__alat.halaman().includes('Satu langkah lagi')`, 20_000),
        `pathname: ${await murid.evalJs('location.pathname')}`,
      )
    }

    // ---------- 8. Lupa sandi untuk akun yang benar-benar terdaftar ----------
    // Halaman auth memantulkan pemakai yang SUDAH masuk ke beranda, jadi
    // sesinya dikeluarkan dulu — persis seperti murid yang membuka lupa sandi
    // dari perangkat lain.
    await murid.apiJson('/v1/auth/keluar', 'POST')
    await murid.buka('/lupa-sandi')
    await murid.evalJs(`__alat.isiLabel('Email', ${JSON.stringify(EMAIL_UJI)})`)
    await murid.evalJs('__alat.kirim()')
    catat(
      'email terdaftar dijawab halaman yang sama dengan email tak terdaftar',
      await murid.tunggu(`__alat.halaman().includes('Cek email kamu') && __alat.halaman().includes(${JSON.stringify(EMAIL_UJI)})`, 15_000),
      (await murid.evalJs(`__alat.halaman()`)).slice(0, 120),
    )
    const jawabTerdaftar = await murid.evalJs(`__alat.halaman().replace(${JSON.stringify(EMAIL_UJI)}, 'EMAIL')`)
    const samaDenganTakDikenal = jawabTerdaftar.replace(/Kirim ulang dalam \d+ detik/, 'Kirim ulang').replace(/dalam \d+ detik/, '')
    catat(
      'jawabannya identik untuk email terdaftar & tidak terdaftar (anti-enumerasi)',
      samaDenganTakDikenal === jawabTakDikenal.replace(/Kirim ulang dalam \d+ detik/, 'Kirim ulang').replace(/dalam \d+ detik/, ''),
      '',
    )

    // ---------- 9. (email) Buka tautan reset & ganti kata sandi ----------
    const tautanReset = await tungguTautan('atur-ulang-sandi')
    if (tautanReset === null) {
      lewati(
        'buka tautan atur ulang sandi dari email',
        'tautan tidak ada di storage/logs/laravel.log — backend ini memakai mailer lain',
      )
    } else {
      await murid.bukaPenuh(tautanReset)
      catat(
        'tautan reset dari email membuka formulir sandi baru untuk akun yang benar',
        await murid.tunggu(`location.pathname === '/atur-ulang-sandi' && __alat.halaman().includes(${JSON.stringify(EMAIL_UJI)})`, 20_000),
        (await murid.evalJs(`__alat.halaman()`)).slice(0, 110),
      )

      await murid.evalJs(`__alat.isiLabel('Kata sandi baru', 'pendek')`)
      await murid.evalJs('__alat.kirim()')
      catat(
        'sandi baru yang terlalu pendek ditolak',
        await murid.tunggu(`__alat.halaman().includes('Kata sandi minimal 10 karakter.')`),
        '',
      )

      await murid.evalJs(`__alat.isiLabel('Kata sandi baru', ${JSON.stringify(SANDI_BARU)})`)
      await murid.evalJs(`__alat.isiLabel('Ulangi kata sandi baru', 'RahasiaBaru457')`)
      await murid.evalJs('__alat.kirim()')
      catat(
        'ulangan sandi baru yang berbeda ditolak',
        await murid.tunggu(`__alat.halaman().includes('Kata sandi belum sama.')`),
        '',
      )

      await murid.evalJs(`__alat.isiLabel('Ulangi kata sandi baru', ${JSON.stringify(SANDI_BARU)})`)
      await murid.evalJs('__alat.kirim()')
      catat(
        'kata sandi baru benar-benar diterima',
        await murid.tunggu(`__alat.halaman().includes('Kata sandi sudah diganti')`, 20_000),
        (await murid.evalJs(`__alat.halaman()`)).slice(0, 120),
      )

      // Tautan sekali pakai. Halaman baru bisa tahu tautannya sudah terpakai
      // dari jawaban server, jadi formulirnya benar-benar dikirim lagi —
      // inilah yang membedakan "tautan sudah dipakai" dari "token salah".
      await murid.bukaPenuh(tautanReset)
      await sleep(900)
      await murid.evalJs(`__alat.isiLabel('Kata sandi baru', ${JSON.stringify(SANDI_KETIGA)})`)
      await murid.evalJs(`__alat.isiLabel('Ulangi kata sandi baru', ${JSON.stringify(SANDI_KETIGA)})`)
      await murid.evalJs('__alat.kirim()')
      catat(
        'tautan reset yang sudah terpakai dijawab halaman khusus "sudah pernah dipakai"',
        await murid.tunggu(`__alat.halaman().includes('Tautan sudah pernah dipakai')`, 20_000),
        (await murid.evalJs(`__alat.halaman()`)).slice(0, 120),
      )
    }

    // ---------- 10. Token salah TIDAK boleh mengaku berhasil ----------
    await murid.buka(`/atur-ulang-sandi?token=token-palsu-${TANDA}&email=${encodeURIComponent(EMAIL_UJI)}`)
    catat(
      'formulir tampil dengan email dari tautan terkunci',
      await murid.tunggu(`__alat.halaman().includes(${JSON.stringify(EMAIL_UJI)})`),
      '',
    )
    await murid.evalJs(`__alat.isiLabel('Kata sandi baru', 'SandiPalsuInginGanti1')`)
    await murid.evalJs(`__alat.isiLabel('Ulangi kata sandi baru', 'SandiPalsuInginGanti1')`)
    await murid.evalJs('__alat.kirim()')
    catat(
      'token palsu ditolak dan halaman TIDAK mengaku sandi sudah diganti',
      await murid.tunggu(`__alat.halaman().includes('Belum berhasil')`, 20_000) &&
        !(await murid.evalJs(`__alat.halaman().includes('Kata sandi sudah diganti')`)),
      (await murid.evalJs(`__alat.halaman()`)).slice(0, 130),
    )

    await murid.buka('/atur-ulang-sandi')
    catat(
      'tanpa token sama sekali, halaman meminta membuka tautan dari email',
      await murid.tunggu(`__alat.halaman().includes('Tautan belum lengkap')`),
      '',
    )

    // ---------- 11. Kata sandi benar-benar berubah ----------
    if (tautanReset !== null) {
      const masukBaru = await murid.masuk({ email: EMAIL_UJI, password: SANDI_BARU })
      catat('masuk dengan kata sandi BARU berhasil', masukBaru?.status === 200, `status ${masukBaru?.status}`)

      const masukLama = await murid.masuk({ email: EMAIL_UJI, password: SANDI_AWAL })
      catat('masuk dengan kata sandi LAMA gagal', masukLama?.status === 422 || masukLama?.status === 401, `status ${masukLama?.status}`)

      const masukKetiga = await murid.masuk({ email: EMAIL_UJI, password: SANDI_KETIGA })
      catat(
        'tautan yang sudah terpakai benar-benar tidak mengganti kata sandi lagi',
        masukKetiga?.status === 422 || masukKetiga?.status === 401,
        `status ${masukKetiga?.status}`,
      )

      await murid.buka('/masuk')
      await murid.evalJs(`__alat.isiLabel('Email', 'tidak-ada@sekolah.test')`)
      await murid.evalJs(`__alat.isiLabel('Kata sandi', 'SandiSalahSekali1')`)
      await murid.evalJs('__alat.kirim()')
      catat(
        'kredensial salah dijelaskan di layar (bukan layar kosong)',
        await murid.tunggu(`__alat.halaman().includes('Belum bisa masuk')`, 15_000) &&
          (await murid.evalJs(`__alat.halaman().includes('Belum verifikasi email?')`)),
        (await murid.evalJs(`__alat.halaman()`)).slice(0, 130),
      )
    } else {
      lewati('masuk dengan kata sandi baru/lama', 'tautan reset tidak terbaca dari log')
    }
  } catch (galat) {
    catat('alur akun murid selesai tanpa galat tak terduga', false, galat?.message ?? String(galat))
  } finally {
    // ---------- Pembersihan: akun uji benar-benar dihapus ----------
    try {
      const masukGuru = await guru.masuk(AKUN_GURU)
      if (masukGuru?.status !== 200) {
        catat('pembersihan: guru bisa masuk untuk menghapus akun uji', false, `status ${masukGuru?.status}`)
      } else {
        const daftar = await guru.apiJson(`/v1/murid?per_page=100&filter[cari]=${encodeURIComponent(EMAIL_UJI)}`)
        const kandidat = Array.isArray(daftar.isi) ? daftar.isi : (daftar.isi?.data ?? [])
        const akun = kandidat.find((satu) => satu.email === EMAIL_UJI)
        if (akun === undefined) {
          catat('pembersihan: akun uji ditemukan untuk dihapus', false, 'tidak ada di daftar murid')
        } else {
          const hapus = await guru.apiJson(`/v1/murid/${akun.id}`, 'DELETE')
          catat('pembersihan: akun uji dihapus', hapus.status === 200 || hapus.status === 204, `status=${hapus.status}`)

          const masihAda = await guru.apiJson(`/v1/murid?per_page=100&filter[cari]=${encodeURIComponent(EMAIL_UJI)}`)
          const sisa = Array.isArray(masihAda.isi) ? masihAda.isi : (masihAda.isi?.data ?? [])
          catat('pembersihan: akun uji tidak tersisa di daftar', !sisa.some((satu) => satu.email === EMAIL_UJI), '')
        }
      }
    } catch (galat) {
      catat('pembersihan akun uji', false, galat?.message ?? String(galat))
    }

    await send('Target.disposeBrowserContext', { browserContextId: ctxGuru }).catch(() => {})
    await send('Target.disposeBrowserContext', { browserContextId: ctxBaru }).catch(() => {})
    ws.close()

    const gagal = hasil.filter((satu) => !satu.lolos)
    console.log(`\nTotal: ${hasil.length - gagal.length}/${hasil.length} lulus · ${gagal.length} gagal`)
    if (dilewati.length > 0) {
      console.log(`DILEWATI ${dilewati.length} langkah: ${dilewati.join(' ; ')}`)
    }
    if (akunTerbuat === false) {
      console.log('catatan: akun uji tampaknya tidak sempat terbuat — tidak ada yang perlu dihapus.')
    }
    process.exit(gagal.length === 0 ? 0 : 1)
  }
}

main().catch((e) => {
  console.error('harness error:', e.message)
  process.exit(1)
})
