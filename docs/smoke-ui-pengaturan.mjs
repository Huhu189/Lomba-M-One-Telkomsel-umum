// Smoke UI halaman Pengaturan (CDP) — DIPERSEMPIT 13 Oktober 2026.
//
// Halaman /pengaturan sekarang berisi **setelan akun sendiri** (nama, kata
// sandi, tema, penunjuk avatar) dan TIDAK lagi berisi setelan ulangan. Setelan
// ulangan (anti-cheat, percobaan ulang, peringkat, layar guru) menyatu dengan
// kuisnya: guru membukanya di halaman detail/kelola kuis, tanpa memilih ulangan
// lebih dulu dari daftar.
//
// Karena itu harness ini memeriksa tiga hal:
//   1. /pengaturan memang halaman akun — ada isian nama + sandi, dan TIDAK ada
//      satu pun saklar ulangan (kalau ada, artinya pemindahan belum terjadi).
//   2. Halaman detail kuis memuat panel "Setelan ulangan" untuk kuis itu.
//   3. Saklar di panel itu masih bisa diubah dan nilainya kembali seperti semula
//      di akhir uji — jadi basis data dev tidak berubah.
//
// Prasyarat: backend 8000, vite 5173, dan Chrome --remote-debugging-port=9333.
const CDP = 'http://127.0.0.1:9333'
const APP = 'http://localhost:5173'
// Peran `admin` (kepala sekolah) HANYA MELIHAT sejak 14 Okt 2026, jadi harness guru
// memakai akun guru sungguhan (guru1@sekolah.test) — bukan akun admin seperti dulu.
// Jalur kepala sekolah diuji terpisah di `docs/smoke-ui-admin.mjs`.
const AKUN_GURU = { email: 'guru1@sekolah.test', password: 'password12' }

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

  const kelompokAntiCheat = `[...document.querySelectorAll('section')].find((s) => s.innerText.startsWith('ANTI-CHEAT') || s.innerText.startsWith('Anti-cheat'))`

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

    // --- 1. Halaman akun ---
    await send('Page.navigate', { url: `${APP}/pengaturan` }, sessionId)
    await sleep(3500)

    const akun = await evalJs(`(() => {
      const isian = (pemilih) => document.querySelector(pemilih)
      const saklar = document.querySelectorAll('input[role="switch"]').length
      const pilih = document.querySelector('select')
      return {
        judul: (document.querySelector('h1') ?? ({ innerText: '' })).innerText.trim(),
        nama: isian('input[autocomplete="name"]')?.value ?? null,
        email: isian('#akun-email')?.value ?? null,
        emailTerbaca: isian('#akun-email')?.readOnly ?? null,
        sandiSekarang: Boolean(isian('input[autocomplete="current-password"]')),
        sandiBaru: document.querySelectorAll('input[autocomplete="new-password"]').length,
        saklar,
        adaPemilih: Boolean(pilih),
        teks: (document.body.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 400),
      }
    })()`)

    catat(
      '/pengaturan = halaman akun (nama + email terbaca + kata sandi)',
      akun.nama !== null && akun.nama !== '' && akun.emailTerbaca === true && akun.sandiSekarang && akun.sandiBaru === 2,
      `judul="${akun.judul}" · nama="${akun.nama}" · email="${akun.email}"`,
    )

    catat(
      'tidak ada satu pun saklar ulangan di halaman akun',
      akun.saklar === 0 && akun.adaPemilih === false,
      `${akun.saklar} saklar · pemilih lingkup=${akun.adaPemilih}`,
    )

    catat(
      'halaman akun menunjuk ke setelan ulangan per-kuis',
      akun.teks.includes('per ulangan') || akun.teks.includes('Setelan ulangan'),
      '',
    )

    // --- 2. Panel setelan ulangan di halaman kuis ---
    //
    // Alamatnya **slug** (`/kuis/unu5k`), bukan id berurutan: inilah alamat yang
    // dipakai aplikasi dan dibagikan guru, sekaligus yang tidak bisa disisir
    // orang lain (`/kuis/191` membuat id kuis mana pun bisa ditebak). Daftar
    // kuis dari server memang hanya memuat kuis milik guru yang masuk.
    const kuis = await evalJs(`fetch('/api/v1/kuis', { credentials: 'include', headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((d) => { const s = (Array.isArray(d) ? d : d.data ?? [])[0]; return s ? { id: s.id, slug: s.slug, judul: s.judul } : null })`)
    catat('ada kuis milik guru untuk diuji', kuis !== null, kuis ? `kuis #${kuis.id} (${kuis.slug})` : '')

    if (kuis !== null) {
      catat('alamat kuis memakai slug, bukan id berurutan', typeof kuis.slug === 'string' && kuis.slug.length > 0, `slug=${kuis.slug}`)

      await send('Page.navigate', { url: `${APP}/kuis/${kuis.slug}` }, sessionId)
      await sleep(4000)

      const judulDiHalaman = await evalJs(`(document.querySelector('h1') ?? ({ innerText: '' })).innerText.trim()`)
      catat(
        `slug membuka kuis yang benar (${kuis.slug})`,
        judulDiHalaman.includes(kuis.judul),
        `h1="${judulDiHalaman}" · diharapkan memuat "${kuis.judul}"`,
      )

      const panel = await evalJs(`(() => {
        const bagian = ${kelompokAntiCheat}
        const setelan = [...document.querySelectorAll('section')].find((s) =>
          s.querySelector('h2')?.innerText?.trim().toLowerCase() === 'setelan ulangan',
        )
        return {
          adaSetelan: Boolean(setelan),
          pemilihDiHalaman: Boolean(document.querySelector('select#lingkup-pengaturan')),
          saklar: setelan ? setelan.querySelectorAll('input[role="switch"]').length : 0,
          tombol: setelan
            ? [...setelan.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => t.startsWith('Nyalakan') || t.startsWith('Matikan'))
            : [],
        }
      })()`)

      catat(
        'halaman detail kuis memuat panel "Setelan ulangan" untuk kuis ini',
        panel.adaSetelan && panel.pemilihDiHalaman === false,
        `pemilih lama=${panel.pemilihDiHalaman}`,
      )

      catat(
        'panel memuat saklar per jenis + tombol massal',
        panel.saklar >= 10 && panel.tombol.length >= 2,
        `${panel.saklar} saklar · ${panel.tombol.join(', ')}`,
      )

      // Aturan peringkat baru (14 Oktober 2026) harus BISA DIATUR dari panel ini,
      // bukan hanya ada di server: murid cuma diberi nomor untuk N% teratas, dan
      // bonus penyemangat punya ambang + batas sendiri.
      //
      // Kolom angkanya dikenali dari `aria-label` (dibentuk dari label server),
      // sedangkan saklarnya dari baris tempat ia berada — jadi penamaannya tidak
      // perlu dicocokkan huruf per huruf dengan judul kolomnya.
      const aturanPeringkat = await evalJs(`(() => {
        const setelan = [...document.querySelectorAll('section')].find((s) =>
          s.querySelector('h2')?.innerText?.trim().toLowerCase() === 'setelan ulangan',
        )
        if (!setelan) return null
        const angka = [...setelan.querySelectorAll('input[type="number"]')].map(
          (el) => el.getAttribute('aria-label') ?? '',
        )
        const barisSaklar = [...setelan.querySelectorAll('input[role="switch"]')].map(
          (el) => el.closest('div')?.parentElement?.innerText ?? '',
        )
        const hitung = (daftar, potongan) => daftar.filter((satu) => satu.includes(potongan)).length
        return {
          persen: hitung(angka, 'Nomor peringkat hanya untuk'),
          bawah: hitung(angka, 'Bonus penyemangat: ambang bawah'),
          maks: hitung(angka, 'Bonus penyemangat: tambahan maksimal'),
          induk: hitung(barisSaklar, 'Bonus penyemangat untuk murid di bawah ambang'),
        }
      })()`)

      catat(
        'aturan peringkat baru (N% teratas + bonus penyemangat) bisa diatur dari panel setelan ulangan',
        aturanPeringkat?.persen === 1 &&
          aturanPeringkat?.bawah === 1 &&
          aturanPeringkat?.maks === 1 &&
          aturanPeringkat?.induk === 1,
        `persen ${aturanPeringkat?.persen} · ambang ${aturanPeringkat?.bawah} · batas ${aturanPeringkat?.maks} · saklar ${aturanPeringkat?.induk}`,
      )

      // --- 3. Saklar sungguhan: ubah lalu kembalikan (basis data dev utuh) ---
      const saklarUji = `(() => {
        const bagian = ${kelompokAntiCheat}
        if (!bagian) return null
        return [...bagian.querySelectorAll('input[role="switch"]')].find((el) => !el.disabled) ?? null
      })()`

      const sebelum = await evalJs(`${saklarUji}?.checked ?? null`)
      catat('ada saklar yang bisa diubah (tidak dikunci sekolah)', typeof sebelum === 'boolean', `checked=${sebelum}`)

      if (typeof sebelum === 'boolean') {
        // Klik SUNGGUHAN pada kotak centangnya (React membaca perubahan dari
        // event `click`, dan `el.click()` sekaligus menjalankan perilaku bawaan
        // kotak centang) — bukan menyetel `checked` lalu menembak `change`.
        const ubah = (nilai) => evalJs(`(async () => {
          const el = ${saklarUji}
          if (el.checked !== ${nilai}) el.click()
          await new Promise((r) => setTimeout(r, 1800))
          return el.checked
        })()`)

        const sesudahUbah = await ubah(!sebelum)
        catat('saklar bisa diubah dan tersimpan', sesudahUbah === !sebelum, `dari=${sebelum} ke=${sesudahUbah}`)

        const sesudahKembali = await ubah(sebelum)
        catat('saklar dikembalikan ke nilai semula', sesudahKembali === sebelum, `checked=${sesudahKembali}`)
      }
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
