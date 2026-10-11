// Smoke UI durasi klip di editor materi (CDP).
//
// Yang dijaga:
//   1. durasi klip bisa dipangkas tipis di inspector (langkah 0,1 detik),
//   2. durasi media dibaca dari berkasnya sendiri — bukan angka tetap 10 detik
//      atau "1 menit" — termasuk berkas webm hasil rekaman yang durasinya baru
//      terbaca setelah dimajukan (kasus `duration` tak terhingga di Chrome), dan
//   3. **gagang pangkas `|` di kedua sisi klip terpilih**: menyeret tanda kanan
//      mengubah ujung (durasi ikut berubah) sementara tanda kiri menggeser awal
//      tanpa memindahkan ujung kanannya, dan
//   4. gagang itu berlaku juga untuk klip **kuis** dan klip **media** (bukan cuma
//      tipe klip yang kebetulan terpilih di bagian 3): materi dicari dari API
//      berdasarkan tipe bloknya, lalu klip tipe itu diklik dan dipangkas.
//
// Materi yang dibuka tidak disimpan, jadi susunan aslinya tidak berubah.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
const AKUN_GURU = { email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }

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

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails))
    }
    return r.result.value
  }

  try {
    await send('Page.navigate', { url: `${APP}/masuk` }, sessionId)
    await sleep(3500)
    const masuk = await evalJs(`(async () => {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
      const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
      const res = await fetch('/api/v1/auth/masuk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
        body: JSON.stringify(${JSON.stringify(AKUN_GURU)}),
      })
      return res.status
    })()`)
    catat('login guru', masuk === 200, `status ${masuk}`)

    // ---------- 1. Teknik pembacaan panjang berkas (dipakai editor) ----------
    const terbaca = await evalJs(`(async () => {
      // Kode yang sama dengan bacaDurasiMedia() di EditorMateri.jsx: baca
      // duration dari elemen media; kalau belum terhingga, majukan jauh lalu
      // tunggu durationchange.
      const baca = (url) => new Promise((selesai) => {
        const el = document.createElement('video')
        el.preload = 'metadata'
        let sudah = false
        const batas = setTimeout(() => tutup(null), 5000)
        const tutup = (durasi) => {
          if (sudah) return
          sudah = true
          clearTimeout(batas)
          el.onloadedmetadata = null
          el.ondurationchange = null
          el.removeAttribute('src')
          el.load()
          selesai(durasi)
        }
        const lapor = () => { if (Number.isFinite(el.duration) && el.duration > 0) tutup(el.duration) }
        el.onloadedmetadata = () => {
          if (Number.isFinite(el.duration) && el.duration > 0) { tutup(el.duration); return }
          el.ondurationchange = lapor
          el.currentTime = 1e101
        }
        el.ondurationchange = lapor
        el.onerror = () => tutup(null)
        el.src = url
      })

      // Rekam klip pendek dari canvas supaya ada berkas media sungguhan.
      const rekam = async (detik) => {
        const kanvas = document.createElement('canvas')
        kanvas.width = 64
        kanvas.height = 64
        const ctx = kanvas.getContext('2d')
        const aliran = kanvas.captureStream(10)
        const perekam = new MediaRecorder(aliran, { mimeType: 'video/webm' })
        const bagian = []
        perekam.ondataavailable = (e) => bagian.push(e.data)
        perekam.start()
        const warna = setInterval(() => {
          ctx.fillStyle = ctx.fillStyle === '#123456' ? '#654321' : '#123456'
          ctx.fillRect(0, 0, 64, 64)
        }, 100)
        await new Promise((r) => setTimeout(r, detik * 1000))
        const selesai = new Promise((r) => { perekam.onstop = r })
        perekam.stop()
        await selesai
        clearInterval(warna)
        return URL.createObjectURL(new Blob(bagian, { type: 'video/webm' }))
      }

      const pendek = await baca(await rekam(1.5))
      const panjang = await baca(await rekam(4))

      return {
        pendek: pendek === null ? null : Math.round(pendek * 10) / 10,
        panjang: panjang === null ? null : Math.round(panjang * 10) / 10,
      }
    })()`)
    catat(
      'panjang media dibaca dari berkasnya (bukan 10 detik / 1 menit tetap)',
      terbaca.pendek !== null && terbaca.panjang !== null && terbaca.panjang > terbaca.pendek + 1,
      `klip 1,5 dtk → ${terbaca.pendek} dtk · klip 4 dtk → ${terbaca.panjang} dtk`,
    )

    // ---------- 2. Inspector klip: durasi dipangkas per 0,1 detik ----------
    // Inspector klip hanya tampil bila materi punya blok, jadi dicari materi
    // pertama yang isinya tidak kosong.
    const materi = await evalJs(`(async () => {
      const daftar = await fetch('/api/v1/materi', { credentials: 'include', headers: { Accept: 'application/json' } }).then((r) => r.json()).catch(() => [])
      for (const satu of daftar) {
        const detail = await fetch('/api/v1/materi/' + satu.id, { credentials: 'include', headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : null)).catch(() => null)
        if (detail && (detail.blok ?? []).length > 0) return { id: satu.id, blok: detail.blok.length }
      }
      return null
    })()`)

    if (materi === null) {
      catat('materi guru dengan blok tersedia untuk memeriksa inspector klip', false, 'tidak ada materi berisi blok')
      return
    }

    console.log(`   (materi uji #${materi.id} dengan ${materi.blok} blok)`)

    await send('Page.navigate', { url: `${APP}/materi/${materi.id}/editor` }, sessionId)
    await sleep(4500)

    const inspector = await evalJs(`(() => {
      const el = document.querySelector('#nle-durasi')
      if (!el) return null
      return { step: el.step, min: el.min, nilai: Number(el.value) }
    })()`)
    catat(
      'inspector klip memakai langkah tipis 0,1 detik',
      inspector !== null && inspector.step === '0.1' && inspector.min === '0.1',
      inspector === null ? 'input #nle-durasi tidak ada' : `step=${inspector.step} min=${inspector.min} durasi=${inspector.nilai}`,
    )

    const setelahKlik = await evalJs(`(async () => {
      const el = document.querySelector('#nle-durasi')
      const sebelum = Number(el.value)
      const tombol = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '−0,1')
      if (!tombol) return { galat: 'tombol −0,1 tidak ada', sebelum }
      tombol.click()
      await new Promise((r) => setTimeout(r, 400))
      return { sebelum, sesudah: Number(document.querySelector('#nle-durasi').value) }
    })()`)
    catat(
      'tombol −0,1 memangkas durasi klip sepersepuluh detik',
      setelahKlik.galat === undefined && Math.abs(setelahKlik.sebelum - setelahKlik.sesudah - 0.1) < 1e-6,
      setelahKlik.galat ?? `${setelahKlik.sebelum} → ${setelahKlik.sesudah}`,
    )

    // ---------- 3. Gagang pangkas `|` di kedua sisi klip terpilih ----------
    // Timeline berada jauh di bawah lipatan. Event tetikus lewat CDP memakai
    // koordinat viewport, jadi viewport headless ditinggikan dulu — kalau tidak,
    // tetikus "menekan" titik kosong dan hasilnya gagal palsu.
    await send(
      'Emulation.setDeviceMetricsOverride',
      { width: 1280, height: 2200, deviceScaleFactor: 1, mobile: false },
      sessionId,
    )
    await sleep(300)

    const gagang = await evalJs(`(() => {
      const daftar = [...document.querySelectorAll('.nle-pangkas')]
      const grup = document.querySelector('.nle-pangkas-grup')
      const klip = document.querySelector('.nle-klip-aktif')
      const kiri = document.querySelector('.nle-pangkas-kiri')
      const kanan = document.querySelector('.nle-pangkas-kanan')

      return {
        jumlah: daftar.length,
        peran: daftar.map((satu) => satu.getAttribute('role')),
        pemilih: daftar.map((satu) => ({ peran: satu.getAttribute('role'), min: satu.getAttribute('aria-valuemin') })),
        adaGrup: grup !== null,
        sebaris: grup !== null && klip !== null && Math.abs(grup.getBoundingClientRect().left - klip.getBoundingClientRect().left) < 2,
        kursor: kiri ? getComputedStyle(kiri).cursor : null,
        kiriAda: kiri !== null,
        kananAda: kanan !== null,
      }
    })()`)
    catat(
      'klip terpilih punya tanda | di kedua sisinya',
      gagang.jumlah === 2 && gagang.kiriAda && gagang.kananAda && gagang.adaGrup && gagang.sebaris,
      `tanda=${gagang.jumlah} sebaris=${gagang.sebaris}`,
    )
    catat(
      'tanda | berperan slider (bukan sekadar hiasan)',
      gagang.peran.every((satu) => satu === 'slider') && gagang.peran.length === 2,
      gagang.peran.join(','),
    )
    catat(
      'tanda | memakai kursor seret kiri-kanan',
      gagang.kursor === 'ew-resize',
      String(gagang.kursor),
    )

    // Penjaga: pastikan titiknya benar-benar mengenai tanda `|` (bukan elemen
    // lain / ruang kosong), supaya seretan di bawah menguji hal yang benar.
    const jangkau = await evalJs(`(() => {
      const el = document.querySelector('.nle-pangkas-kanan')
      const r = el.getBoundingClientRect()
      const titik = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return {
        dapat: titik !== null && (titik === el || el.contains(titik)),
        target: titik === null ? 'null' : String(titik.className),
        puncak: Math.round(r.top),
      }
    })()`)
    catat(
      'tanda | terjangkau tetikus (di dalam viewport)',
      jangkau.dapat,
      `puncak=${jangkau.puncak}px target=${jangkau.target}`,
    )

    // Seret tanda kanan ke kiri: ujung kanan maju, titik mulai tetap.
    const posisiKanan = await evalJs(`(() => {
      const el = document.querySelector('.nle-pangkas-kanan')
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })()`)
    const sebelumSeret = await evalJs(
      `({ mulai: Number(document.querySelector('#nle-mulai').value), durasi: Number(document.querySelector('#nle-durasi').value) })`,
    )
    await send(
      'Input.dispatchMouseEvent',
      { type: 'mousePressed', x: posisiKanan.x, y: posisiKanan.y, button: 'left', buttons: 1, clickCount: 1 },
      sessionId,
    )
    await send(
      'Input.dispatchMouseEvent',
      { type: 'mouseMoved', x: posisiKanan.x - 45, y: posisiKanan.y, button: 'left', buttons: 1 },
      sessionId,
    )
    await send(
      'Input.dispatchMouseEvent',
      { type: 'mouseReleased', x: posisiKanan.x - 45, y: posisiKanan.y, button: 'left', buttons: 0, clickCount: 1 },
      sessionId,
    )
    await sleep(400)
    const sesudahSeret = await evalJs(
      `({ mulai: Number(document.querySelector('#nle-mulai').value), durasi: Number(document.querySelector('#nle-durasi').value) })`,
    )
    catat(
      'seret tanda | kanan memendekkan klip tanpa memindahkan titik mulai',
      sesudahSeret.durasi < sebelumSeret.durasi && Math.abs(sesudahSeret.mulai - sebelumSeret.mulai) < 1e-6,
      `mulai ${sebelumSeret.mulai}→${sesudahSeret.mulai} · durasi ${sebelumSeret.durasi}→${sesudahSeret.durasi}`,
    )

    // Seret tanda kiri ke kanan: awal maju, ujung kanan tetap di tempatnya.
    const posisiKiri = await evalJs(`(() => {
      const el = document.querySelector('.nle-pangkas-kiri')
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })()`)
    const sebelumKiri = await evalJs(
      `({ mulai: Number(document.querySelector('#nle-mulai').value), durasi: Number(document.querySelector('#nle-durasi').value) })`,
    )
    await send(
      'Input.dispatchMouseEvent',
      { type: 'mousePressed', x: posisiKiri.x, y: posisiKiri.y, button: 'left', buttons: 1, clickCount: 1 },
      sessionId,
    )
    await send(
      'Input.dispatchMouseEvent',
      { type: 'mouseMoved', x: posisiKiri.x + 30, y: posisiKiri.y, button: 'left', buttons: 1 },
      sessionId,
    )
    await send(
      'Input.dispatchMouseEvent',
      { type: 'mouseReleased', x: posisiKiri.x + 30, y: posisiKiri.y, button: 'left', buttons: 0, clickCount: 1 },
      sessionId,
    )
    await sleep(400)
    const sesudahKiri = await evalJs(
      `({ mulai: Number(document.querySelector('#nle-mulai').value), durasi: Number(document.querySelector('#nle-durasi').value) })`,
    )
    const ujungSebelum = Math.round((sebelumKiri.mulai + sebelumKiri.durasi) * 10) / 10
    const ujungSesudah = Math.round((sesudahKiri.mulai + sesudahKiri.durasi) * 10) / 10
    catat(
      'seret tanda | kiri memajukan awal dan menjaga ujung kanan tetap',
      sesudahKiri.mulai > sebelumKiri.mulai && ujungSesudah === ujungSebelum,
      `mulai ${sebelumKiri.mulai}→${sesudahKiri.mulai} · ujung ${ujungSebelum}→${ujungSesudah}`,
    )

    // Papan tombol: gagang juga bisa dipakai tanpa tetikus.
    const papanTombol = await evalJs(`(async () => {
      const el = document.querySelector('.nle-pangkas-kanan')
      el.focus()
      const sebelum = Number(document.querySelector('#nle-durasi').value)
      const fokus = document.activeElement === el
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
      await new Promise((r) => setTimeout(r, 300))
      return { fokus, sebelum, sesudah: Number(document.querySelector('#nle-durasi').value) }
    })()`)
    catat(
      'tanda | bisa dipangkas dengan panah kiri/kanan di papan tombol',
      papanTombol.fokus && Math.abs(papanTombol.sebelum - papanTombol.sesudah - 0.1) < 1e-6,
      `fokus=${papanTombol.fokus} · durasi ${papanTombol.sebelum}→${papanTombol.sesudah}`,
    )

    // ---------- 4. Gagang juga berlaku untuk klip `kuis` dan klip `media` ----------
    // Permintaan yang mendasari fitur ini menyebut "quiz/media", sedangkan
    // bagian 3 hanya menguji klip yang kebetulan terpilih (materi pertama yang
    // punya blok). Di sini tiap tipe diuji sendiri: materi dicari dari API
    // berdasarkan tipe bloknya, klip tipe itu diklik, lalu dipangkas.
    const pemilikTipe = await evalJs(`(async () => {
      const daftar = await fetch('/api/v1/materi', { credentials: 'include', headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : [])).catch(() => [])
      const peta = {}
      for (const satu of daftar) {
        const detail = await fetch('/api/v1/materi/' + satu.id, { credentials: 'include', headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : null)).catch(() => null)
        ;(detail?.blok ?? []).forEach((blok) => {
          if ((blok.tipe === 'kuis' || blok.tipe === 'media') && peta[blok.tipe] === undefined) {
            peta[blok.tipe] = satu.id
          }
        })
      }
      return peta
    })()`)

    for (const tipe of ['kuis', 'media']) {
      const idMateri = pemilikTipe?.[tipe]
      if (idMateri === undefined) {
        catat(`materi dengan klip ${tipe} tersedia untuk uji gagang`, false, 'tidak ada materi yang punya klip tipe itu')
        continue
      }

      await send('Page.navigate', { url: `${APP}/materi/${idMateri}/editor` }, sessionId)
      await sleep(4500)

      const terpilih = await evalJs(`(() => {
        const el = document.querySelector('.nle-klip-${tipe}')
        if (el === null) return false
        el.click()
        return true
      })()`)
      await sleep(500)

      const duaSisi = await evalJs(`(() => {
        const klip = document.querySelector('.nle-klip-${tipe}')
        const grup = document.querySelector('.nle-pangkas-grup')
        const kotak = klip === null ? null : klip.getBoundingClientRect()
        return {
          aktif: klip === null ? false : klip.classList.contains('nle-klip-aktif'),
          jumlah: document.querySelectorAll('.nle-pangkas').length,
          kiri: document.querySelector('.nle-pangkas-kiri') !== null,
          kanan: document.querySelector('.nle-pangkas-kanan') !== null,
          sebaris: grup !== null && kotak !== null && Math.abs(grup.getBoundingClientRect().left - kotak.left) < 2,
        }
      })()`)
      catat(
        `klip ${tipe} terpilih punya tanda | di kedua sisinya`,
        terpilih && duaSisi.aktif && duaSisi.jumlah === 2 && duaSisi.kiri && duaSisi.kanan && duaSisi.sebaris,
        `materi #${idMateri} · aktif=${duaSisi.aktif} tanda=${duaSisi.jumlah} sebaris=${duaSisi.sebaris}`,
      )

      const titikKanan = await evalJs(`(() => {
        const el = document.querySelector('.nle-pangkas-kanan')
        if (el === null) return null
        const r = el.getBoundingClientRect()
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, kena: t !== null && (t === el || el.contains(t)) }
      })()`)

      if (titikKanan === null || !titikKanan.kena) {
        catat(
          `seret tanda | kanan klip ${tipe} memendekkan durasi`,
          false,
          'tanda | tidak terjangkau tetikus (di luar viewport?)',
        )
        continue
      }

      const sebelumTipe = await evalJs(
        `({ mulai: Number(document.querySelector('#nle-mulai').value), durasi: Number(document.querySelector('#nle-durasi').value) })`,
      )
      await send(
        'Input.dispatchMouseEvent',
        { type: 'mousePressed', x: titikKanan.x, y: titikKanan.y, button: 'left', buttons: 1, clickCount: 1 },
        sessionId,
      )
      await send(
        'Input.dispatchMouseEvent',
        { type: 'mouseMoved', x: titikKanan.x - 40, y: titikKanan.y, button: 'left', buttons: 1 },
        sessionId,
      )
      await send(
        'Input.dispatchMouseEvent',
        { type: 'mouseReleased', x: titikKanan.x - 40, y: titikKanan.y, button: 'left', buttons: 0, clickCount: 1 },
        sessionId,
      )
      await sleep(400)
      const sesudahTipe = await evalJs(
        `({ mulai: Number(document.querySelector('#nle-mulai').value), durasi: Number(document.querySelector('#nle-durasi').value) })`,
      )
      catat(
        `seret tanda | kanan klip ${tipe} memendekkan durasi tanpa memindahkan titik mulai`,
        sesudahTipe.durasi < sebelumTipe.durasi && Math.abs(sesudahTipe.mulai - sebelumTipe.mulai) < 1e-6,
        `materi #${idMateri} · mulai ${sebelumTipe.mulai}→${sesudahTipe.mulai} · durasi ${sebelumTipe.durasi}→${sesudahTipe.durasi}`,
      )
    }
  } finally {
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
