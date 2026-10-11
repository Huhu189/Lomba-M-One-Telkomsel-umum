/**
 * Tangkap SEMUA halaman aplikasi lewat browser sungguhan (Chrome DevTools
 * Protocol) sebagai guru dan sebagai murid, lalu simpan satu PNG per halaman.
 *
 * Satu TAB BARU per halaman. Ini bukan kerapian belaka: Chrome headless
 * terbukti mengembalikan permukaan gambar yang beku (stale surface) bila satu
 * tab dipakai menangkap banyak navigasi berturut-turut — dua halaman berbeda
 * bisa tersimpan sebagai PNG yang identik byte-per-byte. Tab baru menjamin
 * setiap tangkapan diambil dari permukaan yang segar.
 *
 * Prasyarat: backend :8000, vite :5173, realtime :4000 (halaman Live Monitor /
 * Layar memakainya), dan Chrome headless --remote-debugging-port=9333.
 * Tanpa pustaka: memakai WebSocket bawaan Node 22.
 *
 * Pemakaian:
 *   node docs/tangkap-semua-halaman.mjs <direktori-keluaran>
 */
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

const LEBAR = 1440
const TINGGI = 1000
const MAKS_TINGGI_PENUH = 6000
const KELUARAN = process.argv[2] ?? '/tmp/tangkapan-halaman'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Buka tab baru + kanal CDP-nya. Setiap tab mewakili satu permukaan gambar segar. */
async function buatTab() {
  const buatan = await fetch(`${CDP}/json/new`, { method: 'PUT' })
  const tab = await buatan.json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  let urut = 0
  const tunggu = new Map()
  ws.onmessage = (kejadian) => {
    const pesan = JSON.parse(kejadian.data)
    if (pesan.id && tunggu.has(pesan.id)) {
      tunggu.get(pesan.id)(pesan)
      tunggu.delete(pesan.id)
    }
  }
  const kirim = (method, params = {}) =>
    new Promise((selesai) => {
      urut += 1
      tunggu.set(urut, selesai)
      ws.send(JSON.stringify({ id: urut, method, params }))
    })

  await new Promise((s, g) => {
    ws.onopen = s
    ws.onerror = () => g(new Error('websocket Chrome gagal dibuka'))
  })
  await kirim('Page.enable')
  await kirim('Runtime.enable')
  await kirim('Emulation.setDeviceMetricsOverride', {
    width: LEBAR,
    height: TINGGI,
    deviceScaleFactor: 1,
    mobile: false,
  })

  const evalJs = async (expression) => {
    const r = await kirim('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    const hasil = r.result ?? {}
    if (hasil.exceptionDetails) {
      throw new Error(
        'eval error: ' + (hasil.exceptionDetails.exception?.description ?? JSON.stringify(hasil.exceptionDetails)),
      )
    }
    return hasil.result?.value
  }

  const tutup = async () => {
    ws.close()
    await fetch(`${CDP}/json/close/${tab.id}`).catch(() => {})
  }

  return { kirim, evalJs, tutup }
}

function daftarHalamanGuru(kuis, materi) {
  return [
    { nama: '10-guru-kelas', jalur: '/kelas' },
    { nama: '11-guru-mapel', jalur: '/mapel' },
    { nama: '12-guru-murid', jalur: '/murid' },
    { nama: '13-guru-impor-murid', jalur: '/murid/impor' },
    { nama: '14-guru-bank-soal', jalur: '/bank-soal' },
    { nama: '15-guru-tag', jalur: '/tag' },
    { nama: '16-guru-kuis', jalur: '/kuis' },
    { nama: '17-guru-kuis-detail', jalur: `/kuis/${kuis}` },
    { nama: '18-guru-kuis-laporan', jalur: `/kuis/${kuis}/laporan` },
    { nama: '19-guru-kuis-koreksi', jalur: `/kuis/${kuis}/koreksi` },
    { nama: '20-guru-kuis-monitor', jalur: `/kuis/${kuis}/monitor` },
    { nama: '21-guru-kuis-tim', jalur: `/kuis/${kuis}/tim` },
    { nama: '22-guru-kuis-layar', jalur: `/kuis/${kuis}/layar` },
    { nama: '23-guru-peringkat', jalur: `/peringkat/${kuis}` },
    { nama: '24-guru-materi', jalur: '/materi' },
    { nama: '25-guru-materi-editor', jalur: `/materi/${materi}/editor` },
    { nama: '26-guru-avatar', jalur: '/avatar' },
    // Tanpa /badge dan /progres-tema: keduanya dibungkus <HanyaMurid /> dan
    // guru dialihkan ke Beranda — tangkapannya ada di daftar murid (45 & 46).
    { nama: '27-guru-pengaturan', jalur: '/pengaturan' },
  ]
}

function daftarHalamanMurid(kuis, attempt) {
  return [
    { nama: '40-murid-kuis', jalur: '/kuis' },
    { nama: '41-murid-kerjakan', jalur: `/kerjakan/${kuis}`, tunggu: 'Soal' },
    { nama: '42-murid-hasil', jalur: `/hasil/${attempt}` },
    { nama: '43-murid-materi', jalur: '/materi' },
    { nama: '44-murid-avatar', jalur: '/avatar' },
    { nama: '45-murid-badge', jalur: '/badge' },
    { nama: '46-murid-progres-tema', jalur: '/progres-tema' },
  ]
}

const CAMPURAN = [
  { nama: '01-beranda', jalur: '/' },
  { nama: '02-masuk', jalur: '/masuk' },
  { nama: '03-daftar', jalur: '/daftar' },
  { nama: '04-lupa-sandi', jalur: '/lupa-sandi' },
  { nama: '05-atur-ulang-sandi', jalur: '/atur-ulang-sandi' },
  { nama: '06-perlu-verifikasi', jalur: '/perlu-verifikasi' },
  { nama: '07-verifikasi-email', jalur: '/verifikasi-email' },
  { nama: '08-tidak-ditemukan', jalur: '/halaman-ngawur' },
]

async function utama() {
  const fs = await import('node:fs')
  fs.mkdirSync(KELUARAN, { recursive: true })

  const ringkas = []

  const masuk = async (akun) => {
    const tab = await buatTab()
    await tab.kirim('Page.navigate', { url: `${APP}/masuk` })
    await sleep(4000)
    const sekali = () =>
      tab.evalJs(`(async () => {
        await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
        const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
        const res = await fetch('/api/v1/auth/masuk', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
          body: JSON.stringify(${JSON.stringify(akun)}),
        })
        return { status: res.status, role: (await res.json().catch(() => null))?.user?.role ?? null }
      })()`)

    let hasil = await sekali()
    // Throttle 'auth' membatasi 5 percobaan masuk per menit — perilaku server yang benar.
    for (let coba = 0; coba < 3 && hasil.status === 429; coba++) {
      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
      hasil = await sekali()
    }
    if (hasil.status !== 200) throw new Error(`login ${akun.email} gagal: status ${hasil.status}`)
    await tab.tutup()
    return hasil.role
  }

  const apiJson = async (jalur) => {
    const tab = await buatTab()
    await tab.kirim('Page.navigate', { url: `${APP}/masuk` })
    await sleep(3500)
    const hasil = await tab.evalJs(`(async () => {
      const res = await fetch('/api${jalur}', { credentials: 'include', headers: { Accept: 'application/json' } })
      return await res.json().catch(() => null)
    })()`)
    await tab.tutup()
    return hasil
  }

  const keluar = async () => {
    const tab = await buatTab()
    await tab.kirim('Page.navigate', { url: `${APP}/masuk` })
    await sleep(3500)
    await tab.evalJs(
      `fetch('/api/v1/auth/keluar', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } }).then(() => true)`,
    )
    await tab.tutup()
  }

  /**
   * Tab baru → buka halaman → tunggu RUTE-nya benar-benar tergambar → tangkap.
   *
   * Menunggu "<main> tidak kosong" saja terbukti salah: saat aplikasi masih
   * memuat sesi, rute tujuan belum tergambar dan yang tertangkap justru layar
   * Beranda. Jadi syaratnya: `location.pathname` sudah sama dengan jalur tujuan,
   * isinya cukup, teksnya stabil dua kali berturut-turut, dan (bila diketahui)
   * penanda teks khas halamannya muncul.
   */
  const tangkap = async (halaman) => {
    const tab = await buatTab()
    try {
      await tab.kirim('Page.navigate', { url: APP + halaman.jalur })
      const jalurTujuan = halaman.jalur.split('?')[0]
      const batas = Date.now() + 30_000
      let isi = 0
      let teks = ''
      let sebelumnya = null
      let stabil = 0
      let diRute = false
      while (Date.now() < batas) {
        await sleep(600)
        const info = await tab.evalJs(
          `({ p: location.pathname, t: (document.querySelector('main')?.innerText || '').replace(/\\s+/g, ' '), judul: document.title })`,
        )
        const p = info?.p ?? ''
        const t = info?.t ?? ''
        if (p === jalurTujuan && t.length > 40) {
          diRute = true
          stabil = t === sebelumnya ? stabil + 1 : 0
          teks = t
          isi = t.length
          if (stabil >= 2 && (!halaman.tunggu || t.includes(halaman.tunggu))) break
        } else {
          diRute = false
          stabil = 0
        }
        sebelumnya = t
      }
      if (!diRute) throw new Error(`rute tidak tergambar (pathname != ${jalurTujuan})`)
      await sleep(900)
      const metrik = await tab.kirim('Page.getLayoutMetrics')
      const ukuran = metrik.result?.cssContentSize ?? metrik.result?.contentSize ?? { width: LEBAR, height: TINGGI }
      const tinggi = Math.min(Math.max(Math.round(ukuran.height), TINGGI), MAKS_TINGGI_PENUH)
      const lebar = Math.max(Math.round(ukuran.width), LEBAR)
      const gambar = await tab.kirim('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: lebar, height: tinggi, scale: 1 },
      })
      const data = gambar.result?.data
      if (!data) throw new Error('tangkapan layar kosong')
      fs.writeFileSync(`${KELUARAN}/${halaman.nama}.png`, Buffer.from(data, 'base64'))
      const judul = await tab.evalJs('document.title')
      const jalurAkhir = await tab.evalJs('location.pathname')
      ringkas.push(
        `### ${halaman.nama} — ${halaman.jalur}\njalur tergambar: ${jalurAkhir}\njudul: ${judul}\nukuran: ${lebar}x${tinggi}\nteks: ${teks.slice(0, 260)}`,
      )
      console.log(`OK · ${halaman.nama}.png · ${lebar}x${tinggi} · ${String(judul).slice(0, 60)}`)
      return { isi }
    } finally {
      await tab.tutup()
    }
  }

  const gagal = []
  const jalankan = async (daftar) => {
    for (const halaman of daftar) {
      try {
        const { isi } = await tangkap(halaman)
        if (isi <= 40) gagal.push(`${halaman.nama} (halaman kosong)`)
      } catch (e) {
        gagal.push(`${halaman.nama} (${e.message})`)
        console.log(`GAGAL · ${halaman.nama} · ${e.message}`)
      }
    }
  }

  // Halaman tamu (/masuk, /daftar, /lupa-sandi, /atur-ulang-sandi) dibungkus
  // <HanyaTamu />: bila browser masih menyimpan sesi dari tangkapan sebelumnya,
  // keempatnya dialihkan ke Beranda dan yang tertangkap bukan halamannya. Jadi
  // sesi dibersihkan dulu, apa pun isi profil Chrome.
  const bersihkanSesi = async () => {
    const tab = await buatTab()
    await tab.kirim('Network.enable')
    await tab.kirim('Network.clearBrowserCookies')
    await tab.kirim('Page.navigate', { url: APP + '/' })
    await sleep(3000)
    await tab.evalJs('localStorage.clear(); sessionStorage.clear(); true')
    await tab.tutup()
    console.log('sesi browser dibersihkan')
  }
  await bersihkanSesi()

  await jalankan(CAMPURAN)

  console.log(`login guru: ${await masuk(AKUN_GURU)}`)
  const kuisGuru = await apiJson('/v1/kuis')
  const daftarKuis = Array.isArray(kuisGuru) ? kuisGuru : kuisGuru?.data ?? []
  const kuis = (daftarKuis.find((k) => k.status === 'publikasi') ?? daftarKuis[0])?.id ?? 1
  const materiGuru = await apiJson('/v1/materi')
  const daftarMateri = Array.isArray(materiGuru) ? materiGuru : materiGuru?.data ?? []
  const materi = daftarMateri[0]?.id ?? 1
  console.log(`id kuis=${kuis} · id materi=${materi}`)
  await jalankan(daftarHalamanGuru(kuis, materi))
  await keluar()

  console.log(`login murid: ${await masuk(AKUN_MURID)}`)
  const kuisMurid = await apiJson('/v1/kuis')
  const daftarKuisMurid = Array.isArray(kuisMurid) ? kuisMurid : kuisMurid?.data ?? []
  // Utamakan kuis yang jendelanya sedang terbuka supaya halaman pengerjaan
  // menampilkan soal sungguhan, bukan pemberitahuan "waktu sudah berakhir".
  const kuisUntukDikerjakan =
    (
      daftarKuisMurid.find((k) => k.sedang_berjalan) ??
      daftarKuisMurid.find((k) => k.status === 'publikasi') ??
      daftarKuisMurid[0]
    )?.id ?? 32
  const daftarAttempt = await apiJson(`/v1/kuis/${kuisUntukDikerjakan}/attempt`)
  const attemptId = (Array.isArray(daftarAttempt) ? daftarAttempt : daftarAttempt?.data ?? [])[0]?.id
  console.log(`kerjakan kuis=${kuisUntukDikerjakan} · attempt=${attemptId ?? 22}`)
  await jalankan(daftarHalamanMurid(kuisUntukDikerjakan, attemptId ?? 22))

  fs.writeFileSync(`${KELUARAN}/ringkasan.txt`, ringkas.join('\n\n') + '\n')

  const berkasPng = fs.readdirSync(KELUARAN).filter((f) => f.endsWith('.png'))
  console.log(`\nSelesai: ${berkasPng.length} tangkapan di ${KELUARAN}`)
  if (gagal.length) console.log(`Gagal (${gagal.length}):\n - ${gagal.join('\n - ')}`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

utama().catch((e) => {
  console.error('gagal:', e.message)
  process.exit(1)
})
