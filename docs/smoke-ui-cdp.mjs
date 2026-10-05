// Smoke test login end-to-end lewat browser sungguhan pakai Chrome DevTools Protocol.
const CDP = 'http://127.0.0.1:9333'

function endpoint() {
  return fetch(`${CDP}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const url = await endpoint()
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
  const send = (method, params = {}, sessionId) => {
    const myId = ++id
    return new Promise((res, rej) => {
      pending.set(myId, { res, rej })
      ws.send(JSON.stringify({ id: myId, method, params, sessionId }))
    })
  }

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

  const evalJs = async (expression) => {
    const r = await send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    )
    if (r.exceptionDetails) {
      throw new Error('eval error: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails))
    }
    return r.result.value
  }

  // 1) buka halaman app, lalu login lewat API yang sama dengan yang dipakai UI
  await send('Page.navigate', { url: 'http://localhost:5173/masuk' }, sessionId)
  await sleep(4000)

  const login = await evalJs(`(async () => {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
    const token = decodeURIComponent(document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1])
    const res = await fetch('/api/v1/auth/masuk', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': token },
      body: JSON.stringify({ email: 'admin@sekolah.test', password: 'Passw0rd!Aman' }),
    })
    return { status: res.status, body: (await res.json()).user?.role ?? null }
  })()`)
  console.log('LOGIN:', JSON.stringify(login))

  const halaman = ['/kelas', '/mapel', '/murid', '/murid/impor', '/pengaturan']
  for (const jalur of halaman) {
    await send('Page.navigate', { url: 'http://localhost:5173' + jalur }, sessionId)
    await sleep(3500)
    const info = await evalJs(
      `({ judul: document.title, menu: [...document.querySelectorAll('nav a')].map((a) => a.textContent.trim() + '=>' + a.getAttribute('href')).join(' | '), isi: document.querySelector('main')?.innerText?.replace(/\\s+/g, ' ').slice(0, 260) ?? '(tanpa main)' })`,
    )
    console.log('==', jalur, '==')
    console.log('   judul:', info.judul)
    console.log('   menu :', info.menu)
    console.log('   isi  :', info.isi)
  }

  ws.close()
}

main().catch((e) => {
  console.error('GAGAL:', e.message)
  process.exit(1)
})
