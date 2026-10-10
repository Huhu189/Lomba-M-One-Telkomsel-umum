// Smoke UI papan 10 (susun kuis tiga langkah) & papan 11 (editor soal dengan
// pratinjau) lewat Chrome DevTools Protocol.
//
// Yang diperiksa, di layar 1280px dan 390px:
//   1. Halaman kuis: tombol "Buat kuis" membuka alur tiga langkah dengan pil
//      langkah (aria-current="step"), langkah 1 → 2 → 3 bisa dilalui, bank soal
//      bisa dicentang, dan langkah 3 menampilkan ringkasan + butir kelengkapan;
//   2. Halaman bank soal: "Tambah soal" membuka editor tiga kartu bernomor
//      dengan sisi pratinjau/kelengkapan, pil jenis soal berperan radio, dan
//      butir "Lengkap/Belum" berubah saat isian dilengkapi;
//   3. Tidak ada luapan mendatar di layar 390px dan sasaran sentuh ≥44px.
//
// Efek samping dijaga: kuis draf dan soal contoh yang dibuat di sini dihapus
// lagi lewat API di akhir, jadi basis data dev tidak menumpuk data uji.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333.
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
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)))
    }
    return r.result.value
  }

  const ukuran = (lebar, tinggi, mobile) =>
    send('Emulation.setDeviceMetricsOverride', { width: lebar, height: tinggi, deviceScaleFactor: 1, mobile }, sessionId)

  // Isi kendali React terkontrol (input/textarea/select) seperti yang dilakukan
  // pengguna. Helper-nya dipasang ulang tiap kali halaman dimuat karena
  // navigasi mengganti `window` (SPA tetap memakai dokumen yang sama).
  const ALAT = `window.__isi = (sel, nilai) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error('tidak ada ' + sel)
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(el, nilai)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return el.value
  }`

  const buka = async (jalur) => {
    await send('Page.navigate', { url: APP + jalur }, sessionId)
    await sleep(3000)
    await evalJs(ALAT)
  }

  // ---------- login guru ----------
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

  // ================= PAPAN 10: susun kuis tiga langkah =================
  await ukuran(1280, 900, false)
  await buka('/kuis')

  const daftar = await evalJs(`(() => {
    const h1 = document.querySelector('h1')
    const tombol = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Buat kuis'))
    return { judul: h1?.textContent ?? '', adaTombol: Boolean(tombol), tinggi: tombol?.getBoundingClientRect().height ?? 0 }
  })()`)
  cek('halaman kuis: judul satu h1 "Kuis & Ulangan"', daftar.judul.includes('Kuis & Ulangan'), daftar.judul)
  cek('halaman kuis: ada tombol "Buat kuis" ≥44px', daftar.adaTombol && daftar.tinggi >= 44, `tinggi=${daftar.tinggi}`)

  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Buat kuis')).click()`)
  await sleep(600)

  const langkah1 = await evalJs(`(() => {
    const pil = [...document.querySelectorAll('.pil-langkah')]
    const aktif = pil.filter((p) => p.getAttribute('aria-current') === 'step')
    return {
      jumlah: pil.length,
      nama: pil.map((p) => p.textContent.replace('(sedang dibuka)', '').trim()),
      aktif: aktif.map((p) => p.textContent.replace('(sedang dibuka)', '').trim()),
      tinggi: pil[0]?.getBoundingClientRect().height ?? 0,
      adaJudul: Boolean(document.querySelector('#kuis-judul')),
      adaTombolLanjut: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Lanjut: susun soal')),
    }
  })()`)
  cek('langkah 1: tiga pil langkah tampil', langkah1.jumlah === 3, langkah1.nama.join(' | '))
  cek('langkah 1: pil aktif = "Info dan jadwal" lewat aria-current', langkah1.aktif.length === 1 && langkah1.aktif[0].includes('Info dan jadwal'), langkah1.aktif.join(','))
  cek('langkah 1: pil langkah ≥48px', langkah1.tinggi >= 48, `tinggi=${langkah1.tinggi}`)
  cek('langkah 1: formulir info & jadwal tampil', langkah1.adaJudul && langkah1.adaTombolLanjut, '')

  // Isi formulir langkah 1 lalu lanjut (menyimpan draf ke server).
  await evalJs(`(() => {
    const pilih = (sel) => { const s = document.querySelector(sel); const opsi = [...s.options].filter((o) => o.value !== ''); return opsi[0]?.value ?? '' }
    window.__isi('#kuis-judul', 'Smoke UI: susun kuis tiga langkah')
    window.__isi('#kuis-mapel', pilih('#kuis-mapel'))
    window.__isi('#kuis-kelas', pilih('#kuis-kelas'))
    window.__isi('#kuis-durasi', '45')
    const iso = (menit) => { const d = new Date(Date.now() + menit * 60000); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) }
    window.__isi('#kuis-mulai', iso(60))
    window.__isi('#kuis-selesai', iso(150))
    return true
  })()`)
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Lanjut: susun soal')).click()`)
  await sleep(2500)

  const langkah2 = await evalJs(`(() => {
    const pil = [...document.querySelectorAll('.pil-langkah')]
    const aktif = pil.find((p) => p.getAttribute('aria-current') === 'step')?.textContent ?? ''
    const barisSoal = [...document.querySelectorAll('.pilih-soal')]
    return {
      aktif: aktif.replace('(sedang dibuka)', '').trim(),
      jumlahSoal: barisSoal.length,
      centang: Boolean(document.querySelector('.pilih-soal .kotak-centang')),
      adaSusunan: Boolean(document.querySelector('.baris-ringkas')) || Boolean(document.querySelector('.kotak-kosong')),
      toast: [...document.querySelectorAll('[role="status"]')].map((e) => e.textContent).join(' ').slice(0, 120),
    }
  })()`)
  cek('langkah 2 terbuka setelah draf tersimpan', langkah2.aktif.includes('Susun soal'), langkah2.aktif)
  cek('langkah 2: bank soal tampil dengan kotak centang', langkah2.jumlahSoal > 0 && langkah2.centang, `soal=${langkah2.jumlahSoal}`)
  cek('langkah 2: panel susunan tampil (kosong atau terisi)', langkah2.adaSusunan === true, '')

  // Centang dua soal, lalu periksa daftar susunan + tombol naik/turun.
  const dipilih = await evalJs(`(() => {
    const baris = [...document.querySelectorAll('.pilih-soal')].slice(0, 2)
    baris.forEach((b) => b.click())
    return baris.length
  })()`)
  await sleep(500)
  const susunan = await evalJs(`(() => {
    const baris = [...document.querySelectorAll('.baris-ringkas')]
    const tombol = [...document.querySelectorAll('.baris-ringkas button[aria-label]')]
    return {
      jumlah: baris.length,
      centangAktif: document.querySelectorAll('.pilih-soal[aria-checked="true"]').length,
      nomor: [...document.querySelectorAll('.susunan-no')].map((e) => e.textContent),
      tombol: tombol.length,
      tinggiTombol: tombol[0]?.getBoundingClientRect().height ?? 0,
      label: tombol.slice(0, 3).map((b) => b.getAttribute('aria-label')),
    }
  })()`)
  cek('bank soal: baris tercentang menandai dirinya aria-checked', susunan.centangAktif === dipilih, `centang=${susunan.centangAktif}/${dipilih}`)
  cek('susunan: soal terpilih muncul bernomor urut', susunan.jumlah === dipilih && susunan.nomor.join(',') === '1,2', susunan.nomor.join(','))
  cek('susunan: tombol naik/turun/keluar ada dan ≥44px', susunan.tombol >= 4 && susunan.tinggiTombol >= 44, `tombol=${susunan.tombol} tinggi=${susunan.tinggiTombol}`)
  cek('susunan: tombol menyebut objeknya di aria-label', (susunan.label[0] ?? '').startsWith('Naikkan soal'), susunan.label.join(' / '))

  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Lanjut: tinjau')).click()`)
  await sleep(2200)

  const langkah3 = await evalJs(`(() => {
    const butir = [...document.querySelectorAll('.baris-ringkas .badge-status')].map((b) => b.textContent.trim())
    const ringkas = [...document.querySelectorAll('.petak-ringkas')].map((e) => e.textContent.trim())
    const publikasi = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Publikasikan kuis'))
    return {
      butir,
      ringkas,
      adaPublikasi: Boolean(publikasi),
      publikasiAktif: publikasi ? !publikasi.disabled : false,
    }
  })()`)
  cek('langkah 3: butir kelengkapan tampil dengan status Lengkap/Belum', langkah3.butir.length >= 6, langkah3.butir.join(','))
  cek('langkah 3: semua butir lengkap setelah formulir diisi', langkah3.butir.every((b) => b === 'Lengkap'), langkah3.butir.filter((b) => b !== 'Lengkap').join(','))
  cek('langkah 3: ringkasan kelas/jadwal/soal tampil', langkah3.ringkas.length === 3, langkah3.ringkas.map((r) => r.slice(0, 40)).join(' | '))
  cek('langkah 3: tombol publikasi aktif karena kuis siap', langkah3.adaPublikasi && langkah3.publikasiAktif, '')

  // Layar sempit: pil + kartu tidak boleh meluber.
  await ukuran(390, 844, true)
  await sleep(500)
  const sempit = await evalJs(`(() => {
    const akar = document.documentElement
    const pil = [...document.querySelectorAll('.pil-langkah')]
    const kanan = Math.max(...pil.map((p) => p.getBoundingClientRect().right))
    const kecil = [...document.querySelectorAll('.pil-langkah, .baris-ringkas button, .pilih-soal')]
      .filter((el) => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 44)
    return {
      luber: akar.scrollWidth - akar.clientWidth,
      pilTerpotong: kanan > akar.clientWidth + 1,
      terlaluKecil: kecil.length,
    }
  })()`)
  cek('layar 390px: halaman langkah 3 tidak meluber mendatar', sempit.luber <= 1, `luber=${sempit.luber}px`)
  cek('layar 390px: pil langkah tetap di dalam layar', sempit.pilTerpotong === false, '')
  cek('layar 390px: tidak ada sasaran sentuh <44px di alur ini', sempit.terlaluKecil === 0, `kecil=${sempit.terlaluKecil}`)

  await ukuran(1280, 900, false)
  await sleep(400)

  // ================= PAPAN 11: editor soal =================
  await buka('/bank-soal')
  const bank = await evalJs(`(() => {
    const h1 = document.querySelector('h1')?.textContent ?? ''
    const tombol = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Tambah soal'))
    return { h1, adaTombol: Boolean(tombol) }
  })()`)
  cek('bank soal: judul satu h1 "Bank soal"', bank.h1.toLowerCase().includes('bank soal'), bank.h1)
  cek('bank soal: ada tombol "Tambah soal"', bank.adaTombol, '')

  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Tambah soal')).click()`)
  await sleep(800)

  const editor = await evalJs(`(() => {
    const judul = [...document.querySelectorAll('h2')].map((h) => h.textContent.trim())
    const pil = [...document.querySelectorAll('.pil-tipe')]
    const sisi = document.querySelector('.sisi-lengket')
    return {
      h1: document.querySelector('h1')?.textContent ?? '',
      judul,
      pilTipe: pil.length,
      pilPeran: pil.length > 0 ? pil[0].getAttribute('role') : null,
      atas: pil.length > 0 ? pil[0].closest('[role="radiogroup"]')?.getAttribute('aria-label') ?? null : null,
      sisiLengket: sisi ? getComputedStyle(sisi).position : null,
      adaPratinjau: [...document.querySelectorAll('h2')].some((h) => h.textContent.includes('Pratinjau')),
      adaKelengkapan: [...document.querySelectorAll('h2')].some((h) => h.textContent.includes('Kelengkapan')),
    }
  })()`)
  cek('editor: h1 berubah jadi "Tambah soal"', editor.h1.toLowerCase().includes('tambah soal'), editor.h1)
  cek('editor: tiga kartu bernomor tampil', ['1. Pilih jenis soal', '2. Tulis soalnya', '3. Pengaturan soal'].every((t) => editor.judul.includes(t)), editor.judul.join(' | '))
  cek('editor: pil jenis soal berperan radio', editor.pilTipe === 8 && editor.pilPeran === 'radio' && editor.atas === 'Jenis soal', `pil=${editor.pilTipe} peran=${editor.pilPeran}`)
  cek('editor: sisi kanan berisi pratinjau + kelengkapan', editor.adaPratinjau && editor.adaKelengkapan, '')
  cek('editor: sisi kanan lengket di layar lebar', editor.sisiLengket === 'sticky', `posisi=${editor.sisiLengket}`)

  // Ganti jenis soal ke isian singkat: bidangnya harus ikut berubah.
  await evalJs(`[...document.querySelectorAll('.pil-tipe')].find((b) => b.textContent.includes('Isian singkat')).click()`)
  await sleep(400)
  const setelahGanti = await evalJs(`(() => {
    const aktif = [...document.querySelectorAll('.pil-tipe')].filter((b) => b.getAttribute('aria-checked') === 'true')
    return {
      aktif: aktif.map((b) => b.textContent.trim()),
      adaJawabanBaku: Boolean(document.querySelector('#soal-ambang-isian')),
      butir: [...document.querySelectorAll('#soal-kelengkapan ~ ul .badge-status')].map((b) => b.textContent.trim()),
    }
  })()`)
  cek('editor: pil aktif tunggal setelah ganti jenis', setelahGanti.aktif.length === 1 && setelahGanti.aktif[0].includes('Isian singkat'), setelahGanti.aktif.join(','))
  cek('editor: bidang isian singkat muncul', setelahGanti.adaJawabanBaku === true, '')
  cek('editor: butir kelengkapan menandai yang belum diisi', setelahGanti.butir.includes('Belum') && setelahGanti.butir.includes('Lengkap'), setelahGanti.butir.join(','))

  // Simpan tombol mati selama wajib belum terisi.
  const sebelumSimpan = await evalJs(`(() => {
    const tombol = [...document.querySelectorAll('.sisi-lengket button')].find((b) => b.textContent.includes('Simpan soal'))
    return { ada: Boolean(tombol), mati: tombol ? tombol.disabled : null }
  })()`)
  cek('editor: tombol simpan mati selama soal belum lengkap', sebelumSimpan.ada && sebelumSimpan.mati === true, `mati=${sebelumSimpan.mati}`)

  // Lengkapi lalu simpan (lalu hapus lagi lewat API supaya tidak menumpuk).
  await evalJs(`(() => {
    const pilih = (sel) => { const s = document.querySelector(sel); const opsi = [...s.options].filter((o) => o.value !== ''); return opsi[0]?.value ?? '' }
    window.__isi('#soal-mapel', pilih('#soal-mapel'))
    window.__isi('#soal-teks', 'Smoke UI: organ penyaring debu di hidung disebut …')
    window.__isi('input[aria-label="Jawaban baku 1"]', 'rambut hidung')
    return true
  })()`)
  await sleep(500)
  const setelahLengkap = await evalJs(`(() => {
    const butir = [...document.querySelectorAll('#soal-kelengkapan ~ ul .badge-status')].map((b) => b.textContent.trim())
    const tombol = [...document.querySelectorAll('.sisi-lengket button')].find((b) => b.textContent.includes('Simpan soal'))
    const pratinjau = document.querySelector('.sisi-lengket .soal-render')?.textContent ?? ''
    return { butir, mati: tombol ? tombol.disabled : null, pratinjau: pratinjau.slice(0, 80) }
  })()`)
  cek('editor: daftar kelengkapan jadi lengkap setelah diisi', setelahLengkap.butir.every((b) => b === 'Lengkap'), setelahLengkap.butir.join(','))
  cek('editor: tombol simpan hidup kembali', setelahLengkap.mati === false, `mati=${setelahLengkap.mati}`)
  cek('editor: pratinjau memakai renderer yang sama dengan layar murid', setelahLengkap.pratinjau.includes('Smoke UI'), setelahLengkap.pratinjau)

  await evalJs(`[...document.querySelectorAll('.sisi-lengket button')].find((b) => b.textContent.includes('Simpan soal')).click()`)
  await sleep(2000)
  const setelahSimpan = await evalJs(`(() => ({
    h1: document.querySelector('h1')?.textContent ?? '',
    adaToast: [...document.querySelectorAll('[role="status"]')].some((e) => e.textContent.includes('Soal ditambahkan')),
    soal: [...document.querySelectorAll('tbody tr, .tabel-data li')].map((r) => r.textContent).join(' ').slice(0, 200),
  }))()`)
  cek('editor: tersimpan lalu kembali ke daftar', setelahSimpan.h1.toLowerCase().includes('bank soal'), setelahSimpan.h1)
  cek('editor: notifikasi "Soal ditambahkan" muncul', setelahSimpan.adaToast === true, '')
  cek('editor: soal baru tampil di daftar', setelahSimpan.soal.includes('Smoke UI'), setelahSimpan.soal.slice(0, 80))

  // Bersihkan data uji lewat API (kuis draf + soal contoh).
  const bersih = await evalJs(`(async () => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
    const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
    const hapus = async (url) => {
      const res = await fetch(url, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json', 'X-XSRF-TOKEN': token } })
      return res.status
    }
    const kuis = await fetch('/api/v1/kuis', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json())
    const draf = kuis.filter((k) => k.judul.startsWith('Smoke UI'))
    const statusKuis = []
    for (const k of draf) statusKuis.push(await hapus('/api/v1/kuis/' + k.id))
    const soal = await fetch('/api/v1/soal?page=1', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json())
    const contoh = (soal.data ?? []).filter((s) => String(s.konten?.teks ?? '').startsWith('Smoke UI'))
    const statusSoal = []
    for (const s of contoh) statusSoal.push(await hapus('/api/v1/soal/' + s.id))
    return { draf: draf.length, statusKuis, contoh: contoh.length, statusSoal }
  })()`)
  cek('pembersihan: kuis draf uji terhapus', bersih.draf === 0 || bersih.statusKuis.every((s) => s === 204 || s === 200), JSON.stringify(bersih))
  cek('pembersihan: soal uji terhapus', bersih.contoh === 0 || bersih.statusSoal.every((s) => s === 204 || s === 200), JSON.stringify(bersih))

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
