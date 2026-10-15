// Smoke UI papan 10 (susun kuis satu halaman) & papan 11 (editor soal dengan
// pratinjau) lewat Chrome DevTools Protocol.
//
// Yang diperiksa, di layar 1280px dan 390px:
//   1. Halaman kuis: tombol "Buat kuis" membuka **satu halaman tiga bagian**
//      (14 Oktober 2026 — dulu tiga langkah berurutan). Ketiga bagian tampil
//      sekaligus, pil di atasnya hanya pelompat (aria-current="step"), tidak ada
//      tombol "Lanjut: …", dan **tidak ada pita aksi lengket** di atas layar
//      (15 Oktober 2026): "Simpan draf" ada di dalam formulir bagian 1 dan
//      "Publikasikan kuis" di kaki bagian 3; bank soal bisa dicentang, dan
//      bagian 3 menampilkan ringkasan + butir kelengkapan;
//   2. Halaman bank soal: "Tambah soal" membuka editor tiga kartu bernomor
//      (tulis soal → pengaturan → pilih jenis) dengan sisi pratinjau/kelengkapan,
//      pemilih jenis di kartu paling bawah berupa petak berikon yang bisa
//      dilipat (22 petak berperan radio + <svg>), dan butir "Lengkap/Belum"
//      berubah saat isian dilengkapi;
//   3. Tidak ada luapan mendatar di layar 390px dan sasaran sentuh ≥44px.
//
// Efek samping dijaga: kuis draf dan soal contoh yang dibuat di sini dihapus
// lagi lewat API di akhir, jadi basis data dev tidak menumpuk data uji.
//
// Prasyarat: backend 8000, vite 5173, Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN = { email: 'guru1@sekolah.test', password: 'password12' }

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
  cek('login guru lewat API', login.status === 200 && login.role === 'guru', `status ${login.status}`)

  // ================= PAPAN 10: susun kuis satu halaman =================
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
  await sleep(800)

  const satuHalaman = await evalJs(`(() => {
    const pil = [...document.querySelectorAll('.pil-langkah')]
    const aktif = pil.filter((p) => p.getAttribute('aria-current') === 'step')
    const judulBagian = ['1. Info dan jadwal', '2. Susun soal', '3. Tinjau dan publikasikan']
    const adaBagian = judulBagian.map((t) => [...document.querySelectorAll('h2')].some((h) => h.textContent.trim() === t))
    // Pita aksi lengket di atas layar sudah dihapus (15 Oktober 2026) —
    // disimpan sebagai kontrol negatif: kalau ia muncul lagi, harness merah.
    const pita = document.querySelector('.bar-susun')
    const lencana = document.querySelector('#bagian-terbit-judul .badge-status')
    const tombolLanjut = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Lanjut:'))
    return {
      jumlah: pil.length,
      nama: pil.map((p) => p.textContent.replace('(sedang dibuka)', '').trim()),
      aktif: aktif.map((p) => p.textContent.replace('(sedang dibuka)', '').trim()),
      tinggi: pil[0]?.getBoundingClientRect().height ?? 0,
      adaJudul: Boolean(document.querySelector('#kuis-judul')),
      adaBagian,
      // Ketiga bagian tampil sekaligus: isi bagian 2 & 3 sudah ada di DOM tanpa
      // menekan apa pun (dulu tersembunyi di balik tombol Lanjut).
      adaBankSoal: Boolean(document.querySelector('#cari-soal-kuis')),
      adaKelengkapan: Boolean(document.querySelector('section[aria-labelledby="bagian-terbit-judul"]')),
      tombolLanjut: tombolLanjut.map((b) => b.textContent.trim()),
      pita: pita ? pita.textContent.trim() : null,
      lencana: lencana?.textContent.trim() ?? '',
      simpanDalamForm: (() => {
        const form = document.querySelector('form#form-kuis')
        const tombolSimpan = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Simpan draf'))
        return Boolean(form && tombolSimpan && form.contains(tombolSimpan))
      })(),
      jumlahSimpan: [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Simpan draf')).length,
      terbit: (() => {
        const tombol = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Publikasikan kuis'))
        return tombol ? { ada: true, mati: tombol.disabled, diBagian3: Boolean(document.querySelector('#bagian-terbit')?.contains(tombol)) } : { ada: false, mati: false, diBagian3: false }
      })(),
    }
  })()`)
  cek('satu halaman: tiga pil bagian tampil', satuHalaman.jumlah === 3, satuHalaman.nama.join(' | '))
  cek('satu halaman: pil aktif = "Info dan jadwal" lewat aria-current', satuHalaman.aktif.length === 1 && satuHalaman.aktif[0].includes('Info dan jadwal'), satuHalaman.aktif.join(','))
  cek('satu halaman: pil bagian ≥48px', satuHalaman.tinggi >= 48, `tinggi=${satuHalaman.tinggi}`)
  cek('satu halaman: ketiga bagian tampil SEKALIGUS (tak ada yang tersembunyi)', satuHalaman.adaBagian.every(Boolean) && satuHalaman.adaJudul && satuHalaman.adaBankSoal && satuHalaman.adaKelengkapan, `bagian=${satuHalaman.adaBagian.join(',')}`)
  cek('satu halaman: tidak ada lagi tombol "Lanjut: …"', satuHalaman.tombolLanjut.length === 0, satuHalaman.tombolLanjut.join(' / '))
  cek('satu halaman: tidak ada pita aksi lengket di atas layar', satuHalaman.pita === null, satuHalaman.pita ?? '')
  cek('satu halaman: lencana kelengkapan duduk di judul bagian 3', satuHalaman.lencana.includes('lengkap'), satuHalaman.lencana)
  cek('satu halaman: "Simpan draf" ada di dalam formulirnya dan hanya satu di halaman', satuHalaman.simpanDalamForm && satuHalaman.jumlahSimpan === 1, `dalamForm=${satuHalaman.simpanDalamForm} jumlah=${satuHalaman.jumlahSimpan}`)
  cek('satu halaman: publikasi ada di bagian 3 dan masih mati selagi belum lengkap', satuHalaman.terbit.ada && satuHalaman.terbit.diBagian3 && satuHalaman.terbit.mati === true, JSON.stringify(satuHalaman.terbit))

  // Isi formulir bagian 1 lalu simpan draf lewat tombol di kaki bagian 1.
  // Tombolnya kini DI DALAM formulir, jadi tidak lagi bergantung pada atribut
  // `form` — dan menekan Enter di kolom tetap menyimpan.
  await evalJs(`(() => {
    const pilih = (sel) => { const s = document.querySelector(sel); const opsi = [...s.options].filter((o) => o.value !== ''); return opsi[0]?.value ?? '' }
    window.__isi('#kuis-judul', 'Smoke UI: susun kuis satu halaman')
    window.__isi('#kuis-mapel', pilih('#kuis-mapel'))
    window.__isi('#kuis-kelas', pilih('#kuis-kelas'))
    window.__isi('#kuis-durasi', '45')
    const iso = (menit) => { const d = new Date(Date.now() + menit * 60000); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) }
    window.__isi('#kuis-mulai', iso(60))
    window.__isi('#kuis-selesai', iso(150))
    return true
  })()`)
  await evalJs(`document.querySelector('form#form-kuis button[type="submit"]').click()`)
  await sleep(2500)

  const bagian2 = await evalJs(`(() => {
    const barisSoal = [...document.querySelectorAll('.pilih-soal')]
    const toast = [...document.querySelectorAll('[role="status"]')].map((e) => e.textContent).join(' ')
    const pilAktif = document.querySelector('.pil-langkah[aria-current="step"]')?.textContent ?? ''
    return {
      jumlahSoal: barisSoal.length,
      centang: Boolean(document.querySelector('.pilih-soal .kotak-centang')),
      // Baris susunan dibedakan dari penanda nomornya (.susunan-no): bagian 3
      // memakai kelas baris yang sama untuk butir kelengkapan & ringkasan setelan.
      adaSusunan: Boolean(document.querySelector('.susunan-no')) || Boolean(document.querySelector('.kotak-kosong')),
      adaSimpanSusunan: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Simpan susunan')),
      toast: toast.slice(0, 120),
      pilAktif,
    }
  })()`)
  cek('simpan draf dari bagian 1 menyimpan kuis', bagian2.toast.includes('Kuis dibuat sebagai draf'), bagian2.toast)
  cek('bagian 2: bank soal tampil dengan kotak centang', bagian2.jumlahSoal > 0 && bagian2.centang, `soal=${bagian2.jumlahSoal}`)
  cek('bagian 2: panel susunan tampil (kosong atau terisi)', bagian2.adaSusunan === true, '')
  cek('bagian 2: ada tombol "Simpan susunan" tanpa harus menerbitkan', bagian2.adaSimpanSusunan === true, '')
  cek('mengisi bagian 1 tidak memindahkan pandangan ke bagian lain', bagian2.pilAktif.includes('Info dan jadwal'), bagian2.pilAktif)

  // Centang dua soal, lalu periksa daftar susunan + tombol naik/turun.
  const dipilih = await evalJs(`(() => {
    const baris = [...document.querySelectorAll('.pilih-soal')].slice(0, 2)
    baris.forEach((b) => b.click())
    return baris.length
  })()`)
  await sleep(500)
  const susunan = await evalJs(`(() => {
    // Bagian 2 & 3 tampil sekaligus sejak 14 Oktober 2026, dan bagian 3 juga
    // memakai .baris-ringkas untuk butir kelengkapan + ringkasan setelan. Baris
    // susunan dikenali dari penanda nomornya (.susunan-no) supaya hitungannya
    // tidak ikut menghitung baris bagian 3.
    const baris = [...document.querySelectorAll('.baris-ringkas')].filter((b) => b.querySelector('.susunan-no'))
    const tombol = baris.flatMap((b) => [...b.querySelectorAll('button[aria-label]')])
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

  await sleep(400)

  const bagian3 = await evalJs(`(() => {
    // Butir kelengkapan dibaca dari daftar MILIK bagian 3 saja: bagian ini juga
    // memuat panel "Setelan sesi ini" yang memakai kelas baris yang sama
    // (.baris-ringkas + .badge-status) dengan label yang bukan Lengkap/Belum
    // ("Proteksi mati", "Siswa tamu tidak boleh", "Aturan lain").
    const daftarKelengkapan = document.querySelector('section[aria-labelledby="bagian-terbit-judul"] > ul')
    const butir = [...(daftarKelengkapan?.querySelectorAll('.badge-status') ?? [])].map((b) => b.textContent.trim())
    const ringkas = [...document.querySelectorAll('.petak-ringkas')].map((e) => e.textContent.trim())
    const publikasi = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Publikasikan kuis'))
    return {
      butir,
      ringkas,
      adaPublikasi: Boolean(publikasi),
      publikasiAktif: publikasi ? !publikasi.disabled : false,
      // Setelan ulangan kini SATU tombol: panelnya tidak lagi menggelar saklar
      // di halaman, dan tidak ada satu saklar pun sebelum panelnya dibuka.
      tombolSetelan: [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('Setelan ulangan')).length,
      saklarDiHalaman: document.querySelectorAll('input[role="switch"][id^="set-"]').length,
    }
  })()`)
  cek('bagian 3: butir kelengkapan tampil dengan status Lengkap/Belum', bagian3.butir.length >= 6, bagian3.butir.join(','))
  cek('bagian 3: semua butir lengkap setelah formulir diisi', bagian3.butir.every((b) => b === 'Lengkap'), bagian3.butir.filter((b) => b !== 'Lengkap').join(','))
  cek('bagian 3: ringkasan kelas/jadwal/soal tampil', bagian3.ringkas.length === 3, bagian3.ringkas.map((r) => r.slice(0, 40)).join(' | '))
  cek('bagian 3: tombol publikasi aktif karena kuis siap', bagian3.adaPublikasi && bagian3.publikasiAktif, `aktif=${bagian3.publikasiAktif}`)
  cek('setelan ulangan jadi SATU tombol (tidak diulang di halaman), tanpa saklar tergeletak', bagian3.tombolSetelan === 1 && bagian3.saklarDiHalaman === 0, `tombol=${bagian3.tombolSetelan} saklar=${bagian3.saklarDiHalaman}`)

  // Panel setelan benar-benar terbuka dan berisi saklar (dulu tergeletak di halaman).
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Setelan ulangan')).click()`)
  await sleep(1200)
  const panelSetelan = await evalJs(`(() => {
    const dialog = [...document.querySelectorAll('dialog')].find((d) => d.open && d.textContent.includes('Setelan ulangan'))
    return {
      terbuka: Boolean(dialog),
      judul: dialog ? [...dialog.querySelectorAll('h3')].map((h) => h.textContent.trim()) : [],
      saklar: dialog ? dialog.querySelectorAll('input[role="switch"]').length : 0,
    }
  })()`)
  cek('panel setelan terbuka dari satu tombol dan terstruktur per kelompok', panelSetelan.terbuka && panelSetelan.judul.length >= 2 && panelSetelan.saklar >= 10, `kelompok=${panelSetelan.judul.join(' | ')} saklar=${panelSetelan.saklar}`)
  await evalJs(`(() => {
    const dialog = [...document.querySelectorAll('dialog')].find((d) => d.open && d.textContent.includes('Setelan ulangan'))
    dialog?.querySelector('button[aria-label^="Tutup"]')?.click()
    return true
  })()`)
  await sleep(400)

  // Layar sempit: pil + kartu tidak boleh meluber.
  await ukuran(390, 844, true)
  await sleep(500)
  const sempit = await evalJs(`(() => {
    const akar = document.documentElement
    const pil = [...document.querySelectorAll('.pil-langkah')]
    const kanan = Math.max(...pil.map((p) => p.getBoundingClientRect().right))
    const kecil = [...document.querySelectorAll('.pil-langkah, #form-kuis button, .baris-ringkas button, .pilih-soal')]
      .filter((el) => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 44)
    return {
      luber: akar.scrollWidth - akar.clientWidth,
      pilTerpotong: kanan > akar.clientWidth + 1,
      terlaluKecil: kecil.length,
    }
  })()`)
  cek('layar 390px: halaman susun tidak meluber mendatar', sempit.luber <= 1, `luber=${sempit.luber}px`)
  cek('layar 390px: pil bagian tetap di dalam layar', sempit.pilTerpotong === false, '')
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
    const petak = [...document.querySelectorAll('.petak-tipe-tombol')]
    const sisi = document.querySelector('.sisi-lengket')
    return {
      h1: document.querySelector('h1')?.textContent ?? '',
      judul,
      petak: petak.length,
      petakPeran: petak.length > 0 ? petak[0].getAttribute('role') : null,
      petakIkon: petak.length > 0 && petak.every((b) => b.querySelector('svg') !== null),
      atas: petak.length > 0 ? petak[0].closest('[role="radiogroup"]')?.getAttribute('aria-label') ?? null : null,
      lipat: document.querySelector('.pemilih-jenis')?.tagName ?? null,
      terbukaAwal: document.querySelector('.pemilih-jenis')?.open ?? null,
      urutan: [...document.querySelectorAll('.col-lg-8 section')].map((s) => s.querySelector('h2')?.textContent.trim() ?? ''),
      sisiLengket: sisi ? getComputedStyle(sisi).position : null,
      adaPratinjau: [...document.querySelectorAll('h2')].some((h) => h.textContent.includes('Pratinjau')),
      adaKelengkapan: [...document.querySelectorAll('h2')].some((h) => h.textContent.includes('Kelengkapan')),
    }
  })()`)
  cek('editor: h1 berubah jadi "Tambah soal"', editor.h1.toLowerCase().includes('tambah soal'), editor.h1)
  // Urutan kartu mengikuti kebijakan 12 Oktober 2026 (dikunci lagi di A.62):
  // jenis soal dipilih DULU, jadi kartu 1 = pemilih jenis, kartu 2 = penulisan
  // soal, kartu 3 = pengaturan (mapel & tag).
  cek('editor: kartu bernomor tampil (jenis · tulis · pengaturan)', ['1. Pilih jenis soal', '2. Tulis soalnya', '3. Pengaturan soal'].every((t) => editor.judul.includes(t)), editor.judul.join(' | '))
  cek('editor: pemilih jenis soal di kartu PERTAMA (pilih tipe dulu)', editor.urutan[0] === '1. Pilih jenis soal', editor.urutan.join(' | '))
  // A.62 melipat 22 petak jadi chip <details> yang tertutup bawaan supaya
  // pertanyaan & pilihannya tidak terdorong ke bawah.
  cek('editor: pemilih jenis soal berupa chip <details> tertutup bawaan', editor.lipat === 'DETAILS' && editor.terbukaAwal === false, `tag=${editor.lipat} terbuka=${editor.terbukaAwal}`)

  await evalJs(`document.querySelector('.pemilih-jenis > summary').click()`)
  await sleep(300)
  const chipTerbuka = await evalJs(`document.querySelector('.pemilih-jenis')?.open ?? null`)
  cek('editor: chip pemilih jenis terbuka saat ditekan', chipTerbuka === true, `terbuka=${chipTerbuka}`)
  cek('editor: petak jenis soal berperan radio & berikon', editor.petak === 22 && editor.petakPeran === 'radio' && editor.petakIkon && editor.atas === 'Jenis soal', `petak=${editor.petak} peran=${editor.petakPeran} ikon=${editor.petakIkon}`)
  cek('editor: sisi kanan berisi pratinjau + kelengkapan', editor.adaPratinjau && editor.adaKelengkapan, '')
  cek('editor: sisi kanan lengket di layar lebar', editor.sisiLengket === 'sticky', `posisi=${editor.sisiLengket}`)

  // Ganti jenis soal ke isian singkat: bidangnya harus ikut berubah.
  await evalJs(`[...document.querySelectorAll('.petak-tipe-tombol')].find((b) => b.textContent.includes('Isian singkat')).click()`)
  await sleep(400)
  const setelahGanti = await evalJs(`(() => {
    const aktif = [...document.querySelectorAll('.petak-tipe-tombol')].filter((b) => b.getAttribute('aria-checked') === 'true')
    return {
      aktif: aktif.map((b) => b.textContent.trim()),
      adaJawabanBaku: Boolean(document.querySelector('#soal-ambang-isian')),
      chipTerbuka: document.querySelector('.pemilih-jenis')?.open ?? null,
      butir: [...document.querySelectorAll('#soal-kelengkapan ~ ul .badge-status')].map((b) => b.textContent.trim()),
    }
  })()`)
  cek('editor: petak aktif tunggal setelah ganti jenis', setelahGanti.aktif.length === 1 && setelahGanti.aktif[0].includes('Isian singkat'), setelahGanti.aktif.join(','))
  cek('editor: bidang isian singkat muncul', setelahGanti.adaJawabanBaku === true, '')
  cek('editor: memilih satu petak menutup chip lagi', setelahGanti.chipTerbuka === false, `terbuka=${setelahGanti.chipTerbuka}`)
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
