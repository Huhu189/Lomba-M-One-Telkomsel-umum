// Smoke UI "soal berubah di tengah ulangan" (CDP): kebijakan 12 Oktober 2026 —
// soal boleh diperbaiki guru saat kuis SEDANG berjalan, tetapi murid yang
// sedang mengerjakan harus benar-benar melihat versi barunya, diberi tahu, dan
// jawabannya tidak boleh hilang.
//
// Dua konteks peramban dipakai sekaligus (dua "profil" cookie yang terpisah):
// guru memperbaiki soal di konteks pertama, murid mengerjakan di konteks kedua —
// jadi tidak ada login yang saling menendang seperti pada harness satu-konteks.
//
// Yang diperiksa:
//   1. kontrak server: cap versi soal berubah setelah guru menyimpan perbaikan,
//      dan skor/kunci tetap DITOLAK selama kuis berjalan;
//   2. editor guru menampilkan aturan "sedang berjalan" (isi boleh, skor kunci);
//   3. layar murid memberi tahu "Guru memperbarui soal" tanpa memuat ulang
//      halaman, dan teks soal yang tampil sudah versi baru;
//   4. jawaban yang sudah diketik murid MASIH tercentang setelah soal dimuat
//      ulang (cadangan jawaban bekerja).
//
// Harness ini MANDIRI: kuis + soal ujinya dibuat di awal dan dihapus di akhir.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333
// (jalankan lewat `docs/jalankan-smoke-ui.sh soal-berubah`).
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }
const AKUN_MURID = { email: 'smoke.murid@sekolah.test', password: 'Passw0rd!Aman' }

const TEKS_AWAL = 'SMOKE-VERSI: berapa hasil dari 3 + 4?'
const TEKS_BARU = 'SMOKE-VERSI: berapa hasil dari 3 + 4? (tulis satuannya juga)'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const hasil = []

function catat(nama, lolos, detail = '') {
  hasil.push({ nama, lolos })
  console.log(`${lolos ? 'LULUS' : 'GAGAL'} · ${nama}${detail ? ' · ' + detail : ''}`)
}

async function main() {
  const url = await fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
  const ws = new WebSocket(url)
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

  /** Satu sesi = satu halaman dengan cookie-nya sendiri. */
  const pasang = async (sid) => {
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sid)
      if (r.exceptionDetails) {
        throw new Error('eval error: ' + (r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails)))
      }
      return r.result.value
    }

    const buka = async (jalur) => {
      await send('Page.navigate', { url: APP + jalur }, sid)
      await sleep(3200)
    }

    const tunggu = async (ekspresi, batas = 15_000) => {
      const mulai = Date.now()
      while (Date.now() - mulai < batas) {
        if (await evaluate(ekspresi)) return true
        await sleep(400)
      }
      return false
    }

    const masuk = (akun) =>
      evaluate(`(async () => {
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

    /**
     * Panggil API dari halaman yang sudah masuk (cookie sesi milik sesi ini).
     * @param {string} jalur @param {string} metode @param {unknown} muatan
     */
    const api = (jalur, metode = 'GET', muatan = null) =>
      evaluate(`(async () => {
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

    /** Mulai/lanjutkan attempt murid — sekaligus sumber cap versi soal. */
    const muatAttempt = (idKuis) => api(`/v1/kuis/${idKuis}/mulai`, 'POST')

    return { evaluate, buka, tunggu, masuk, api, muatAttempt }
  }

  // ---- Konteks guru (target bawaan) ----------------------------------------
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId: sidGuru } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, sidGuru)
  const guru = await pasang(sidGuru)

  // ---- Konteks murid (jarsa cookie terpisah) -------------------------------
  const { browserContextId } = await send('Target.createBrowserContext')
  const { targetId: targetMurid } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { sessionId: sidMurid } = await send('Target.attachToTarget', { targetId: targetMurid, flatten: true })
  await send('Page.enable', {}, sidMurid)
  const murid = await pasang(sidMurid)

  let idKuisUji = 0
  /** @type {number[]} */
  const idSoalUji = []

  const bersihkan = async () => {
    // Kuis dihapus lebih dulu: attempt + jawaban murid ikut terhapus, sehingga
    // soal yang sudah dijawab juga boleh dihapus.
    if (idKuisUji > 0) await guru.api(`/v1/kuis/${idKuisUji}`, 'DELETE')
    for (const idSoal of idSoalUji) await guru.api(`/v1/soal/${idSoal}`, 'DELETE')
  }

  const mulai = new Date(Date.now() - 60_000).toISOString()
  const selesai = new Date(Date.now() + 45 * 60_000).toISOString()

  try {
    // --- 1. Guru menyiapkan ulangan uji ---
    await guru.buka('/')
    const guruMasuk = await guru.masuk(AKUN_GURU)
    catat('guru masuk', guruMasuk.status === 200, guruMasuk.email ?? '')

    const daftarMurid = await guru.api('/v1/murid?per_page=100')
    const semuaMurid = Array.isArray(daftarMurid.isi) ? daftarMurid.isi : (daftarMurid.isi?.data ?? [])
    const muridUji = semuaMurid.find((satu) => satu.email === AKUN_MURID.email)
    const kelasId = muridUji?.class_id ?? null
    catat('murid uji ada di kelas yang diketahui', kelasId !== null, `kelas ${kelasId} · ${muridUji?.kelas_nama ?? '—'}`)
    if (kelasId === null) throw new Error('murid uji tidak ada di DB dev — jalankan seeder')

    const daftarMapel = await guru.api('/v1/mapel')
    const mapelId = (daftarMapel.isi ?? []).find((satu) => satu.nama === 'Matematika')?.id
    if (!mapelId) throw new Error('mapel Matematika tidak ada di DB dev')

    const soalUji = {
      subject_id: mapelId,
      tipe: 'pilihan_ganda',
      konten: {
        teks: TEKS_AWAL,
        opsi: [
          { id: 'A', teks: '6' },
          { id: 'B', teks: '7' },
          { id: 'C', teks: '8' },
        ],
      },
      kunci: { jawaban: 'B' },
      skor: 5,
      aktif: true,
    }

    const buatSoal = await guru.api('/v1/soal', 'POST', soalUji)
    if (buatSoal.status !== 201) throw new Error(`gagal membuat soal uji: ${buatSoal.status}`)
    idSoalUji.push(buatSoal.isi.id)

    const buatKuis = await guru.api('/v1/kuis', 'POST', {
      judul: 'SMOKE-VERSI Ulangan Sedang Berjalan',
      deskripsi: 'Ulangan sementara untuk menguji perbaikan soal di tengah ulangan.',
      subject_id: mapelId,
      class_id: kelasId,
      durasi_menit: 30,
      mulai_at: mulai,
      selesai_at: selesai,
      acak_soal: false,
      acak_opsi: false,
    })
    if (buatKuis.status !== 201) throw new Error(`gagal membuat kuis uji: ${buatKuis.status}`)
    idKuisUji = buatKuis.isi.id

    await guru.api(`/v1/kuis/${idKuisUji}/soal`, 'PUT', { soal: idSoalUji })
    const terbit = await guru.api(`/v1/kuis/${idKuisUji}/publikasi`, 'POST')
    catat(
      'guru menerbitkan ulangan uji yang sedang berjalan',
      terbit.status === 200 && terbit.isi?.sedang_berjalan === true,
      `kuis ${idKuisUji} · soal ${buatSoal.isi.id}`,
    )

    // --- 2. Murid membuka dan menjawab satu soal (jawaban harus aman nanti) ---
    await murid.buka('/')
    const muridMasuk = await murid.masuk(AKUN_MURID)
    catat('murid masuk di konteks terpisah', muridMasuk.status === 200, muridMasuk.email ?? '')

    const attemptAwal = await murid.muatAttempt(idKuisUji)
    const capSebelum = attemptAwal.isi?.versi_soal ?? null
    catat('payload attempt membawa cap versi soal', typeof capSebelum === 'string' && capSebelum.length > 0, String(capSebelum))

    await murid.buka(`/kerjakan/${idKuisUji}`)
    const soalTampil = await murid.tunggu(`document.body.innerText.includes('SMOKE-VERSI')`)
    catat('murid melihat soal versi awal', soalTampil === true)

    const jawab = await murid.evaluate(`(() => {
      const radio = document.querySelector('section.kartu-ulangan input[type="radio"]')
      if (!radio) return false
      radio.click()
      return true
    })()`)
    catat('murid menjawab satu pilihan', jawab === true)

    // Beri waktu autosave + cadangan perangkat bekerja sebelum soalnya berubah.
    await sleep(2500)

    // --- 3. Guru memperbaiki ISI soal di tengah ulangan ---
    const perbaiki = await guru.api(`/v1/soal/${buatSoal.isi.id}`, 'PUT', {
      ...soalUji,
      konten: {
        ...soalUji.konten,
        teks: TEKS_BARU,
        opsi: [
          { id: 'A', teks: '6' },
          { id: 'B', teks: '7 satuan' },
          { id: 'C', teks: '8' },
        ],
      },
    })
    catat(
      'guru boleh memperbaiki isi soal saat ulangan berjalan',
      perbaiki.status === 200,
      `status ${perbaiki.status}${perbaiki.status >= 400 ? ' · ' + JSON.stringify(perbaiki.isi) : ''}`,
    )

    const capSesudah = await murid.api(`/v1/attempt/${attemptAwal.isi.id}/versi-soal`)
    catat(
      'cap versi soal berubah setelah perbaikan guru',
      typeof capSesudah.isi?.versi_soal === 'string' && capSesudah.isi.versi_soal !== capSebelum,
      `${capSebelum} → ${capSesudah.isi?.versi_soal}`,
    )

    // --- 4. Layar murid: diberi tahu + soal dimuat ulang, jawaban tetap ada ---
    // Simulasi murid kembali ke tab: efek penjaga versi memeriksa saat itu juga.
    await murid.evaluate(`window.dispatchEvent(new Event('focus'))`)
    const adaInfo = await murid.tunggu(`document.body.innerText.includes('Guru memperbarui soal')`, 20_000)
    catat('murid diberi tahu bahwa guru memperbarui soal', adaInfo === true)

    const soalBaruTampil = await murid.tunggu(
      `document.body.innerText.includes('7 satuan') && document.body.innerText.includes('(tulis satuannya juga)')`,
      15_000,
    )
    catat('soal versi baru benar-benar tampil tanpa memuat ulang halaman', soalBaruTampil === true)

    const jawabanTersimpan = await murid.evaluate(
      `document.querySelectorAll('section.kartu-ulangan input[type="radio"]:checked').length === 1`,
    )
    catat('jawaban murid tetap tercentang setelah soal dimuat ulang', jawabanTersimpan === true)

    const tanpaKunci = await murid.evaluate(`!document.body.innerText.includes('Kunci jawaban')`)
    catat('halaman murid tetap tidak membocorkan kunci', tanpaKunci === true)

    // --- 5. Editor guru menjelaskan aturan "sedang berjalan" ---
    await guru.buka('/bank-soal')
    const adaSoal = await guru.tunggu(`document.body.innerText.includes('SMOKE-VERSI')`)
    catat('soal uji tampil di bank soal guru', adaSoal === true)

    if (adaSoal) {
      await guru.evaluate(`(() => {
        const tombol = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Ubah soal:'))
        if (tombol) tombol.click()
      })()`)
      const adaBanner = await guru.tunggu(`document.body.innerText.includes('Kuis yang memakai soal ini sedang berjalan')`)
      catat('editor memberi tahu kuis pemakainya sedang berjalan', adaBanner === true)

      const skorTerkunci = await guru.evaluate(`document.querySelector('#soal-skor')?.disabled === true`)
      catat('skor dikunci di editor selama kuis berjalan', skorTerkunci === true)

      const isiMasihBisa = await guru.evaluate(`document.querySelector('#soal-teks')?.disabled === false`)
      catat('isi soal tetap bisa diperbaiki dari editor', isiMasihBisa === true)
    }

    // --- 6. Skor & kunci tetap ditolak server saat kuis berjalan ---
    const ubahSkor = await guru.api(`/v1/soal/${buatSoal.isi.id}`, 'PUT', { ...soalUji, skor: 9 })
    catat('server menolak perubahan skor saat kuis berjalan', ubahSkor.status === 422, `status ${ubahSkor.status}`)

    const ubahKunci = await guru.api(`/v1/soal/${buatSoal.isi.id}`, 'PUT', { ...soalUji, kunci: { jawaban: 'C' } })
    catat('server menolak perubahan kunci saat kuis berjalan', ubahKunci.status === 422, `status ${ubahKunci.status}`)
  } finally {
    await bersihkan().catch(() => {})
    await send('Target.disposeBrowserContext', { browserContextId }).catch(() => {})

    const gagal = hasil.filter((satu) => !satu.lolos)
    console.log(`\n${hasil.length - gagal.length}/${hasil.length} pemeriksaan lulus.`)
    ws.close()
    if (gagal.length > 0) process.exit(1)
  }
}

main().catch((e) => {
  console.error('GAGAL:', e.message)
  process.exit(1)
})
