// Smoke slice 04 lewat browser sungguhan (Chrome DevTools Protocol):
// guru membuat ulangannya sendiri (dua soal + kuis + terbit), lalu murid
// mengerjakan lewat layar pengerjaan — timer tampil, soal tanpa kunci, jawaban
// tersimpan otomatis ke server, dikumpulkan (idempoten), dan hasil tampil tanpa
// kunci/pembahasan.
//
// Harness ini MANDIRI: ulangan dan soalnya dibuat di awal lalu dihapus lagi di
// akhir, jadi bisa dijalankan berulang kali tanpa bergantung sisa data uji
// (dan tanpa menumpuk data di DB dev).
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Alat bantu di sisi halaman (disuntik ulang setiap navigasi). */
const ALAT = `window.__alat = {
  isi(sel, nilai) {
    const el = document.querySelector(sel)
    if (!el) throw new Error('elemen tidak ada: ' + sel)
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, nilai)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  },
  klik(sel) {
    const el = document.querySelector(sel)
    if (!el) throw new Error('elemen tidak ada: ' + sel)
    el.click()
    return true
  },
  klikTeks(teks) {
    const el = [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().includes(teks))
    if (!el) throw new Error('tombol tidak ada: ' + teks)
    el.click()
    return true
  },
  // Kartu soal yang sedang dibuka (papan desain 4: satu soal per layar).
  kartuSoal() { return document.querySelector('section.kartu-ulangan') },
  // Tunggu sampai kartu soal memuat teks tertentu (React selesai menggambar).
  tungguKartu(teks, batasMs) {
    return new Promise((selesai) => {
      const mulai = Date.now()
      const cek = () => {
        const isi = document.querySelector('section.kartu-ulangan')?.innerText ?? ''
        if (isi.includes(teks) || Date.now() - mulai > batasMs) return selesai(isi.includes(teks))
        setTimeout(cek, 100)
      }
      cek()
    })
  },
  // Pindah ke soal yang memuat teks tertentu lewat navigator kisi nomor.
  async bukaSoal(teks) {
    if (await window.__alat.tungguKartu(teks, 600)) return true
    const semua = [...document.querySelectorAll('button[aria-label^="Soal "]')]
    const unik = [...new Map(semua.map((t) => [t.getAttribute('aria-label'), t])).values()]
    for (const tombol of unik) {
      tombol.click()
      if (await window.__alat.tungguKartu(teks, 500)) return true
    }
    return false
  },
  // Pilih opsi pada soal yang memuat teks tertentu (jawaban sungguhan).
  async pilihOpsi(teksSoal, nilaiOpsi) {
    if (!(await window.__alat.bukaSoal(teksSoal))) throw new Error('kartu soal tidak ada: ' + teksSoal)
    const input = window.__alat.kartuSoal()?.querySelector('input[value="' + nilaiOpsi + '"]')
    if (!input) throw new Error('opsi tidak ada: ' + nilaiOpsi)
    input.click()
    return true
  },
  // Jumlah soal terjawab menurut bilah progres di kepala halaman.
  progres() { return Number(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? -1) },
  ada(teks) { return (document.querySelector('main')?.innerText ?? '').includes(teks) },
  teksMain() { return document.querySelector('main')?.innerText?.replace(/\\s+/g, ' ') ?? '' },
  timer() { return document.querySelector('[role="timer"]')?.textContent?.trim() ?? null },
}`

const hasil = []

function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

async function endpoint() {
  return fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
}

/** Soal uji yang dibuat harness ini (kunci diketahui pasti). */
const SOAL_UJI = [
  {
    teks: 'SMOKE-04: berapa hasil dari 7 + 8?',
    opsi: [
      { id: 'A', teks: '15' },
      { id: 'B', teks: '14' },
      { id: 'C', teks: '16' },
    ],
    kunci: 'A',
    skor: 5,
  },
  {
    teks: 'SMOKE-04: berapa hasil dari 4 + 5?',
    opsi: [
      { id: 'A', teks: '8' },
      { id: 'B', teks: '9' },
      { id: 'C', teks: '10' },
    ],
    kunci: 'B',
    skor: 5,
  },
]

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

  // Alat bantu + confirm diterima otomatis di setiap dokumen baru.
  await send('Page.enable', {}, sessionId)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: ALAT }, sessionId)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm = () => true' }, sessionId)

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)))
    }
    return r.result.value
  }

  const buka = async (jalur) => {
    await send('Page.navigate', { url: APP + jalur }, sessionId)
    await sleep(3200)
  }

  const masukSekali = async (akun) =>
    evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api/v1/auth/masuk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify(${JSON.stringify(akun)}),
      })
      return { status: res.status, email: (await res.json())?.user?.email ?? null }
    })()`)

  const masuk = async (akun) => {
    let hasilMasuk = await masukSekali(akun)

    for (let coba = 0; coba < 3 && hasilMasuk.status === 429; coba++) {
      console.log('   (batas masuk per menit tercapai, menunggu 20 detik…)')
      await sleep(20_000)
      hasilMasuk = await masukSekali(akun)
    }

    return hasilMasuk
  }

  const apiJson = async (jalur, metode = 'GET', muatan = null) =>
    evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api${jalur}', {
        method: '${metode}',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: ${muatan === null ? 'null' : `JSON.stringify(${JSON.stringify(muatan)})`},
      })
      return { status: res.status, isi: await res.json().catch(() => null) }
    })()`)

  // Server menyimpan waktu dalam UTC — kirim ISO agar jendela jadwal tepat.
  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 3_600_000).toISOString()

  /** @type {number[]} */ const idSoalUji = []
  let idKuisUji = 0

  /** Hapus ulangan + soal uji (dipakai baik saat lulus maupun saat gagal). */
  const bersihkan = async () => {
    if (idKuisUji === 0 && idSoalUji.length === 0) return { status: 0, sisa: '(tidak ada yang dibuat)' }

    await apiJson('/v1/auth/keluar', 'POST')
    await masuk(AKUN_GURU)

    let status = 0
    if (idKuisUji > 0) status = (await apiJson(`/v1/kuis/${idKuisUji}`, 'DELETE')).status
    for (const idSoal of idSoalUji) {
      const hapus = await apiJson(`/v1/soal/${idSoal}`, 'DELETE')
      if (hapus.status !== 200) status = hapus.status
    }

    return { status, sisa: `kuis ${idKuisUji} · soal ${idSoalUji.join(',')}` }
  }

  // ---------- 1. Guru menyiapkan ulangan sendiri ----------
  await buka('/masuk')
  const masukGuru = await masuk(AKUN_GURU)
  catat('login guru lewat API', masukGuru.status === 200, `status ${masukGuru.status}`)

  // Murid uji harus ada dan kelasnya diketahui: kuis dibuat untuk kelas itu juga,
  // jadi murid pasti berhak mengerjakannya (bukan bergantung kuis sisa smoke lain).
  const daftarMurid = await apiJson('/v1/murid?per_page=100')
  const muridUji = (daftarMurid.isi?.data ?? []).find((satu) => satu.email === AKUN_MURID.email)
  const daftarMapel = await apiJson('/v1/mapel')
  const mapelId = (daftarMapel.isi ?? []).find((satu) => satu.nama === 'Matematika')?.id
  if (!muridUji || !mapelId) throw new Error('murid uji atau mapel Matematika tidak ada di DB dev — jalankan seeder')

  catat(
    'murid uji ada di kelas yang diketahui',
    Number(muridUji.class_id) > 0,
    `${muridUji.nama} · ${muridUji.kelas_nama}`,
  )

  const buatSoal = []
  for (const satu of SOAL_UJI) {
    const dibuat = await apiJson('/v1/soal', 'POST', {
      subject_id: mapelId,
      tipe: 'pilihan_ganda',
      konten: { teks: satu.teks, opsi: satu.opsi },
      kunci: { jawaban: satu.kunci },
      skor: satu.skor,
      aktif: true,
    })
    if (dibuat.status !== 201) throw new Error(`gagal membuat soal uji: ${dibuat.status}`)
    idSoalUji.push(dibuat.isi.id)
    buatSoal.push(dibuat.status)
  }
  catat('guru membuat dua soal uji pilihan ganda', buatSoal.every((s) => s === 201), `status ${buatSoal.join(', ')}`)

  try {
    const buatKuis = await apiJson('/v1/kuis', 'POST', {
      judul: 'SMOKE-04 Ulangan Pengerjaan',
      deskripsi: 'Ulangan sementara untuk smoke layar pengerjaan.',
      subject_id: mapelId,
      class_id: muridUji.class_id,
      durasi_menit: 20,
      mulai_at: mulai,
      selesai_at: selesai,
      acak_soal: false,
      acak_opsi: false,
    })
    if (buatKuis.status !== 201) throw new Error(`gagal membuat kuis uji: ${buatKuis.status}`)
    idKuisUji = buatKuis.isi.id

    const susun = await apiJson(`/v1/kuis/${idKuisUji}/soal`, 'PUT', { soal: idSoalUji })
    const terbit = await apiJson(`/v1/kuis/${idKuisUji}/publikasi`, 'POST')
    catat(
      'guru menyusun soal lalu menerbitkan ulangan uji',
      susun.status === 200 && terbit.status === 200 && terbit.isi?.sedang_berjalan === true,
      `kuis ${idKuisUji} · susun ${susun.status} · terbit ${terbit.status}`,
    )

    // ---------- 2. Murid mengerjakan ----------
    await apiJson('/v1/auth/keluar', 'POST')
    await buka('/masuk')
    const masukMurid = await masuk(AKUN_MURID)
    catat('login murid lewat API', masukMurid.status === 200, `status ${masukMurid.status}`)

    await buka('/kuis')
    const adaTombol = await evalJs(
      `!!([...document.querySelectorAll('a')].find((a) => a.textContent.includes('Kerjakan sekarang')))`,
    )
    catat('daftar ulangan murid menampilkan tombol Kerjakan sekarang', adaTombol)

    await buka(`/kerjakan/${idKuisUji}`)
    const timer = await evalJs(`__alat.timer()`)
    const mainKerjakan = await evalJs(`__alat.teksMain()`)
    catat(
      'layar pengerjaan menampilkan timer dan tidak memuat kunci',
      /^\d{1,2}:\d{2}(:\d{2})?$/.test(timer ?? '') &&
        !mainKerjakan.includes('Kunci') &&
        !mainKerjakan.includes('Pembahasan'),
      `timer ${timer}`,
    )

    // Ambil attempt aktif lewat API (mulai idempoten) + pastikan tanpa kunci.
    const mulaiApi = await apiJson(`/v1/kuis/${idKuisUji}/mulai`, 'POST')
    const attempt = mulaiApi.isi
    const teksSoal = SOAL_UJI[0].teks
    const opsiBenar = SOAL_UJI[0].kunci
    const skorSoal = SOAL_UJI[0].skor
    const soalTerjawab = (attempt.soal ?? []).find((s) => s.konten?.teks === teksSoal)
    const bocor = JSON.stringify(attempt.soal ?? []).toLowerCase()
    catat(
      'respons attempt tidak memuat kunci/pembahasan',
      !bocor.includes('kunci') && !bocor.includes('pembahasan') && soalTerjawab !== undefined,
      `attempt ${attempt.id} · ${attempt.jumlah_soal} soal`,
    )

    // Navigator kisi nomor (papan desain 4) membawa murid ke soal yang dicari,
    // walau urutan soal dari server diacak per attempt.
    const kartuTerbuka = await evalJs(`__alat.bukaSoal(${JSON.stringify(teksSoal)})`)
    catat('navigator membuka soal yang dicari tanpa kunci', kartuTerbuka === true)

    // Jawab soal pilihan ganda dengan kunci yang benar → skor penuh untuk soal itu.
    const progresSebelum = await evalJs(`__alat.progres()`)
    await evalJs(`__alat.pilihOpsi(${JSON.stringify(teksSoal)}, ${JSON.stringify(opsiBenar)})`)
    await sleep(2200)

    const setelahJawab = await apiJson(`/v1/attempt/${attempt.id}`)
    const tersimpan = (setelahJawab.isi?.jawaban ?? []).find((j) => j.question_id === soalTerjawab.id)
    catat(
      'autosave mengirim jawaban ke server',
      tersimpan !== undefined && tersimpan.jawaban === opsiBenar,
      `jawaban ${JSON.stringify(tersimpan?.jawaban)}`,
    )

    const progresSesudah = await evalJs(`__alat.progres()`)
    catat(
      'penghitung terjawab di layar bertambah',
      progresSesudah === progresSebelum + 1,
      `${progresSebelum} → ${progresSesudah} dari ${attempt.jumlah_soal}`,
    )

    // ---------- 3. Kumpulkan + hasil ----------
    // Papan desain 4: "Selesai" membuka ringkasan dulu, baru tombol Kumpulkan.
    await evalJs(`__alat.klikTeks('Selesai')`)
    await sleep(600)
    const ringkasanKumpul = await evalJs(`window.__alat.ada('Sudah selesai mengerjakan?')`)
    catat('tombol Selesai membuka ringkasan sebelum mengumpulkan', ringkasanKumpul)

    await evalJs(`__alat.klikTeks('Kumpulkan')`)
    await sleep(3200)

    const jalurHasil = await evalJs(`location.pathname`)
    catat('murid diarahkan ke halaman hasil', /^\/hasil\/\d+$/.test(jalurHasil), jalurHasil)

    const mainHasil = await evalJs(`__alat.teksMain()`)
    const adaSkor = await evalJs(`__alat.ada('Skor')`)
    // Tidak ada lencana kunci maupun teks pembahasan; catatan "kunci tidak
    // ditampilkan" pada halaman hasil memang disengaja, jadi bukan kebocoran.
    const adaLencanaKunci = await evalJs(`document.querySelectorAll('.badge-kunci').length > 0`)
    catat(
      'hasil menampilkan skor dan tidak membocorkan kunci',
      adaSkor && !adaLencanaKunci && !mainHasil.includes('Pembahasan:'),
      mainHasil.slice(0, 100),
    )

    const attemptId = Number(jalurHasil.split('/').pop())
    const hasilApi = await apiJson(`/v1/attempt/${attemptId}/hasil`)
    const h = hasilApi.isi
    const soalDinilai = (h?.per_soal ?? []).find((s) => s.question_id === soalTerjawab.id)
    catat(
      'hasil server: soal benar dinilai penuh, sisanya belum dijawab',
      h?.skor === skorSoal &&
        h?.jumlah_benar === 1 &&
        soalDinilai?.benar === true &&
        h?.ringkasan_penilaian?.belum_dijawab === h.jumlah_soal - 1,
      `skor ${h?.skor}/${h?.skor_maksimal} · benar ${h?.jumlah_benar} · belum ${h?.ringkasan_penilaian?.belum_dijawab}`,
    )

    // Kumpulkan ulang (idempoten) tidak menggandakan/mengubah hasil.
    const kumpul2 = await apiJson(`/v1/attempt/${attemptId}/kumpulkan`, 'POST', { idempotency_key: 'smoke-ulang-0001' })
    catat(
      'kumpulkan ulang tetap 200 dan hasil tidak berubah',
      kumpul2.status === 200 && kumpul2.isi?.skor === h?.skor && kumpul2.isi?.jumlah_benar === h?.jumlah_benar,
      `status ${kumpul2.status}`,
    )

    // Jawab sesudah dikumpulkan ditolak.
    const jawabLagi = await apiJson(`/v1/attempt/${attemptId}/jawab`, 'POST', {
      question_id: soalTerjawab.id,
      jawaban: opsiBenar,
    })
    catat(
      'server menolak jawaban sesudah dikumpulkan',
      jawabLagi.status === 403 || jawabLagi.status === 422,
      `status ${jawabLagi.status}`,
    )
  } finally {
    // ---------- 4. Bersih-bersih ----------
    const beres = await bersihkan()
    const sisaKuis = idKuisUji > 0 ? await apiJson(`/v1/kuis/${idKuisUji}`) : { status: 404 }
    catat(
      'ulangan & soal uji dihapus lagi (DB dev tidak menumpuk)',
      beres.status === 200 && (sisaKuis.status === 404 || sisaKuis.status === 403),
      `${beres.sisa} · baca ulang kuis ${sisaKuis.status}`,
    )
  }

  // Tab yang dibuat harness ini ditutup supaya target Chrome tidak menumpuk
  // saat smoke dijalankan berulang.
  await send('Target.closeTarget', { targetId })
  ws.close()

  const gagal = hasil.filter((satu) => !satu.lolos)
  console.log('')
  console.log(`smoke slice 04: ${hasil.length - gagal.length}/${hasil.length} lulus`)
  process.exit(gagal.length === 0 ? 0 : 1)
}

main().catch((galat) => {
  console.error('smoke gagal:', galat.message)
  process.exit(1)
})
