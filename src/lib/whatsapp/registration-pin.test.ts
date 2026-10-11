// src/lib/whatsapp/registration-pin.test.ts
//
// Every Embedded Signup client's number used to be registered with the same
// PIN (000000). That PIN is the number's two-step-verification PIN, so anyone
// who knew it could re-register the number elsewhere. These tests pin down
// the replacement: a fresh random PIN per number, reused (not regenerated)
// when the same number reconnects, and never claimed as stored when Meta
// rejected the registration.

import { describe, it, expect, vi } from 'vitest'
import {
  generateRegistrationPin,
  choosePin,
  registerPhoneNumber,
} from './registration-pin'

describe('generateRegistrationPin', () => {
  it.each([
    [0, '000000'],
    [42, '000042'], // leading zeros kept: Meta wants exactly six digits
    [123456, '123456'],
    [999999, '999999'],
  ])('turns the random number %d into the PIN %s', (n, want) => {
    expect(generateRegistrationPin(() => n)).toBe(want)
  })

  it('draws from the whole six-digit range', () => {
    const randomInt = vi.fn(() => 1)
    generateRegistrationPin(randomInt)
    expect(randomInt).toHaveBeenCalledWith(0, 1_000_000)
  })

  it('produces different six-digit PINs with the real random source — not one fixed value', () => {
    const pins = new Set(Array.from({ length: 50 }, () => generateRegistrationPin()))
    for (const pin of pins) expect(pin).toMatch(/^\d{6}$/)
    expect(pins.size).toBeGreaterThan(1)
  })
})

describe('choosePin', () => {
  const decrypt = (v: string) => {
    if (v === 'CORRUPT') throw new Error('bad ciphertext')
    return v.replace(/^enc:/, '')
  }

  it('reuses the stored PIN so a reconnect does not clash with the number\'s existing two-step PIN', () => {
    expect(choosePin('enc:482913', decrypt, () => '111111')).toEqual({ pin: '482913', reused: true })
  })

  it.each([
    ['nothing stored', null],
    ['an empty value', ''],
    ['an undecryptable value', 'CORRUPT'],
    ['a stored value that is not six digits', 'enc:12ab'],
  ])('generates a new PIN when there is %s', (_label, stored) => {
    expect(choosePin(stored, decrypt, () => '654321')).toEqual({ pin: '654321', reused: false })
  })
})

describe('registerPhoneNumber', () => {
  function fakeFetch(response: Response | Error) {
    return vi.fn<typeof fetch>(async () => {
      if (response instanceof Error) throw response
      return response
    })
  }

  it('posts the PIN to the number\'s /register edge with the client\'s token', async () => {
    const fetchFn = fakeFetch(new Response(JSON.stringify({ success: true }), { status: 200 }))

    const result = await registerPhoneNumber({
      graphBase: 'https://graph.facebook.com/v23.0',
      phoneNumberId: '1055555',
      accessToken: 'tok',
      pin: '482913',
      fetchFn,
    })

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://graph.facebook.com/v23.0/1055555/register')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(init?.body as string)).toEqual({ messaging_product: 'whatsapp', pin: '482913' })
  })

  it('reports Meta\'s own message when registration is rejected', async () => {
    const fetchFn = fakeFetch(
      new Response(JSON.stringify({ error: { message: 'Wrong two-step PIN' } }), { status: 400 }),
    )
    const result = await registerPhoneNumber({
      graphBase: 'g', phoneNumberId: '1', accessToken: 't', pin: '482913', fetchFn,
    })
    expect(result).toEqual({ ok: false, error: 'Wrong two-step PIN' })
  })

  it('reports failure (does not throw) on a network error or a non-JSON error body', async () => {
    const offline = await registerPhoneNumber({
      graphBase: 'g', phoneNumberId: '1', accessToken: 't', pin: '482913',
      fetchFn: fakeFetch(new Error('socket hang up')),
    })
    expect(offline.ok).toBe(false)

    const html = await registerPhoneNumber({
      graphBase: 'g', phoneNumberId: '1', accessToken: 't', pin: '482913',
      fetchFn: fakeFetch(new Response('<html>502</html>', { status: 502 })),
    })
    expect(html.ok).toBe(false)
  })
})
