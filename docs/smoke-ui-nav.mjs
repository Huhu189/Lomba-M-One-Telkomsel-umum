// Smoke UI shell navigasi lewat Chrome DevTools Protocol.
//
// Yang diperiksa (dua ukuran layar):
//   1. layar kecil (390px): tombol hamburger tampil, laci berisi tautan bagian
//      ber-ikon, dan baris aksi kartu kuis TIDAK meluber keluar layar;
//   2. layar lebar (1280px): navbar pil tampil dengan ikon, hamburger tersembunyi.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const hasil = []
function cek(nama, lulus, catatan = '') {
  hasil.push({ nama, lulus })
  console.log(`${lulus ? '✅' : '❌'} ${nama}${catatan ? ` — ${catatan}` : ''}`)
}

async function endpoint() {
  return fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
}

async function main() {
  const ws = new WebSocket(await endpoint())
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

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

  const evalJs = async (expression) => {
    const r = await send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    )
    if (r.exceptionDetails) {
      throw new Error(
        'eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)),
      )
    }
    return r.result.value
  }

  const ukuran = (lebar, tinggi, mobile) =>
    send('Emulation.setDeviceMetricsOverride', { width: lebar, height: tinggi, deviceScaleFactor: 1, mobile }, sessionId)

  const buka = async (jalur) => {
    await send('Page.navigate', { url: APP + jalur }, sessionId)
    await sleep(3200)
  }

  // ---------- login guru lewat API yang sama dipakai UI ----------
  await buka('/masuk')
  const masukSekali = () =>
    evalJs(`(async () => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
    const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
    const res = await fetch('/api/v1/auth/masuk', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
      body: JSON.stringify(${JSON.stringify(AKUN)}),
    })
    return { status: res.status, role: (await res.json())?.user?.role ?? null }
  })()`)

  /**
   * Masuk sebagai akun uji. Throttle 'auth' memang membatasi 5 percobaan masuk
   * per menit per akun+IP; smoke yang dijalankan beruntun jadi menunggu
   * sebentar lalu mencoba lagi, bukan gagal karena 429 (perilaku server benar).
   */
  let login = await masukSekali()

  for (let coba = 0; coba < 3 && login.status === 429; coba++) {
    console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
    await sleep(20_000)
    login = await masukSekali()
  }
  cek('login guru lewat API', login.status === 200 && login.role === 'admin', `status ${login.status}`)

  // ---------- 1. Layar kecil: hamburger + laci + aksi kartu ----------
  await ukuran(390, 844, true)
  await buka('/kuis')

  const kecil = await evalJs(`(() => {
    const tombol = document.querySelector('button[aria-label="Buka menu"]')
    const navDesktop = document.querySelector('nav.papan-nav')
    const navTampil = navDesktop ? getComputedStyle(navDesktop).display !== 'none' : false
    return {
      adaTombol: Boolean(tombol),
      tombolTinggi: tombol?.getBoundingClientRect().height ?? 0,
      navTampil,
      lebarLayar: document.documentElement.clientWidth,
    }
  })()`)
  cek('layar 390px: tombol hamburger tampil', kecil.adaTombol && kecil.tombolTinggi >= 44, `tinggi=${kecil.tombolTinggi}`)
  cek('layar 390px: navbar pil disembunyikan', kecil.navTampil === false, `tampil=${kecil.navTampil}`)

  // Buka laci.
  await evalJs(`document.querySelector('button[aria-label="Buka menu"]').click()`)
  await sleep(400)
  const laci = await evalJs(`(() => {
    const el = document.querySelector('#laci-navigasi')
    if (!el) return { ada: false }
    const taut = [...el.querySelectorAll('a')]
    return {
      ada: true,
      jumlah: taut.length,
      berIkon: taut.slice(0, 3).every((a) => Boolean(a.querySelector('svg'))),
      adaBankSoal: taut.some((a) => a.textContent.includes('Bank Soal')),
      tepiKanan: Math.max(...taut.map((a) => a.getBoundingClientRect().right)),
      lebarLayar: document.documentElement.clientWidth,
    }
  })()`)
  cek('laci terbuka berisi tautan bagian', laci.ada && laci.jumlah >= 9, `jumlah=${laci.jumlah}`)
  cek('tautan laci memakai ikon (svg)', laci.berIkon === true, '')
  cek('laci tidak meluber dari layar', laci.ada && laci.tepiKanan <= laci.lebarLayar + 1, `kanan=${laci.tepiKanan} layar=${laci.lebarLayar}`)

  // Tutup laci lewat tombol tutup.
  await evalJs(`document.querySelector('#laci-navigasi button[aria-label="Tutup menu"]').click()`)
  await sleep(300)
  cek('laci bisa ditutup', (await evalJs(`document.querySelector('#laci-navigasi') === null`)) === true, '')

  // Baris aksi kartu kuis tidak boleh meluber.
  const aksi = await evalJs(`(() => {
    const baris = [...document.querySelectorAll('.kartu-aksi')]
    // Tombol ikon (hapus) tetap persegi 44 px; yang diperiksa lebar barisnya
    // hanya tombol teks supaya tidak ada label yang terpotong.
    const tombol = [...document.querySelectorAll('.kartu-aksi > .btn:not(.btn-ikon)')]
    const lebar = document.documentElement.clientWidth
    return {
      adaKartu: Boolean(document.querySelector('.kartu-soal')),
      jumlah: tombol.length,
      adaUbah: tombol.some((b) => b.textContent.includes('Ubah')),
      ubahBerIkon: tombol.some((b) => b.textContent.includes('Ubah') && b.querySelector('svg')),
      meluber: tombol.filter((b) => b.getBoundingClientRect().right > lebar + 1 || b.getBoundingClientRect().left < -1).length,
      // Di layar sempit tiap tombol selebar barisnya (menumpuk satu kolom).
      selebarBaris: baris.length > 0
        ? baris.every((b) => {
            const lebarBaris = b.getBoundingClientRect().width
            return [...b.children]
              .filter((btn) => !btn.classList.contains('btn-ikon'))
              .every((btn) => btn.getBoundingClientRect().width >= lebarBaris - 2)
          })
        : null,
      ikonPersegi: [...document.querySelectorAll('.kartu-aksi > .btn-ikon')].every((b) => {
        const kotak = b.getBoundingClientRect()
        return kotak.height >= 44 && kotak.width <= 60
      }),
    }
  })()`)
  cek('kartu kuis punya tombol Ubah ber-ikon', aksi.adaUbah && aksi.ubahBerIkon, `tombol=${aksi.jumlah}`)
  cek('tombol aksi tidak meluber di layar 390px', aksi.meluber === 0, `meluber=${aksi.meluber}`)
  cek('tombol aksi menumpuk selebar barisnya di layar sempit', aksi.selebarBaris === true, `selebarBaris=${aksi.selebarBaris}`)
  cek('tombol ikon hapus tetap persegi (tidak direntangkan)', aksi.ikonPersegi === true, '')

  // ---------- 2. Layar lebar: navbar pil ----------
  await ukuran(1280, 800, false)
  await buka('/kuis')
  const lebar = await evalJs(`(() => {
    const nav = document.querySelector('nav.papan-nav')
    const taut = nav ? [...nav.querySelectorAll('a')] : []
    return {
      navTampil: nav ? getComputedStyle(nav).display !== 'none' : false,
      jumlah: taut.length,
      berIkon: taut.length > 0 && taut.every((a) => Boolean(a.querySelector('svg'))),
      // Hamburger tetap ada di DOM tetapi disembunyikan (d-lg-none) di layar lebar.
      hamburgerTampil: (() => {
        const t = document.querySelector('button[aria-label="Buka menu"]')
        return t ? getComputedStyle(t).display !== 'none' : false
      })(),
    }
  })()`)
  cek('layar 1280px: navbar pil tampil', lebar.navTampil === true, '')
  cek('layar 1280px: 9 tautan ber-ikon', lebar.jumlah >= 9 && lebar.berIkon === true, `jumlah=${lebar.jumlah}`)
  cek('layar 1280px: hamburger tersembunyi', lebar.hamburgerTampil === false, `tampil=${lebar.hamburgerTampil}`)

  await send('Emulation.clearDeviceMetricsOverride', {}, sessionId)
  // Tab yang dibuat harness ini ditutup supaya target Chrome tidak menumpuk
  // saat smoke dijalankan berulang.
  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagal = hasil.filter((h) => !h.lulus)
  console.log(`\nTotal: ${hasil.length - gagal.length}/${hasil.length} lulus · ${gagal.length} gagal`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('smoke gagal:', e.message)
  process.exit(1)
})
