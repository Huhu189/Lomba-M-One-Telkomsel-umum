import { describe, expect, it } from 'vitest'
import { DASAR_REALTIME, urlSse } from '../../../shared/api/realtime.js'

describe('urlSse', () => {
  it('menyusun URL aliran untuk kanal monitor dan kuis', () => {
    expect(urlSse('monitor', 'abc')).toBe(`${DASAR_REALTIME}/sse/monitor?tiket=abc`)
    expect(urlSse('kuis', 'abc')).toBe(`${DASAR_REALTIME}/sse/kuis?tiket=abc`)
  })

  it('meng-encode tiket: tanpa ini tanda + berubah jadi spasi dan tiket tidak cocok', () => {
    const tiket = 'a+b/c=d&e'

    expect(urlSse('kuis', tiket)).toBe(`${DASAR_REALTIME}/sse/kuis?tiket=a%2Bb%2Fc%3Dd%26e`)
  })
})
