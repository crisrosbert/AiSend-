import { describe, it, expect } from 'vitest'
import { signPayload, verifySignature, generateSecret } from './sign'

describe('signPayload / verifySignature', () => {
  it('round-trips a valid signature', () => {
    const secret = 'test-secret'
    const body = JSON.stringify({ hello: 'world' })
    const ts = Math.floor(Date.now() / 1000)
    const header = signPayload(secret, body, ts)
    expect(verifySignature(secret, body, header)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const secret = 'test-secret'
    const ts = Math.floor(Date.now() / 1000)
    const header = signPayload(secret, JSON.stringify({ a: 1 }), ts)
    expect(verifySignature(secret, JSON.stringify({ a: 2 }), header)).toBe(false)
  })

  it('rejects the wrong secret', () => {
    const ts = Math.floor(Date.now() / 1000)
    const body = JSON.stringify({ a: 1 })
    const header = signPayload('secret-a', body, ts)
    expect(verifySignature('secret-b', body, header)).toBe(false)
  })

  it('rejects a signature older than the tolerance window', () => {
    const secret = 'test-secret'
    const body = JSON.stringify({ a: 1 })
    const staleTs = Math.floor(Date.now() / 1000) - 10 * 60
    const header = signPayload(secret, body, staleTs)
    expect(verifySignature(secret, body, header, 300)).toBe(false)
  })

  it('rejects a missing or malformed header', () => {
    expect(verifySignature('secret', 'body', null)).toBe(false)
    expect(verifySignature('secret', 'body', 'not-a-valid-header')).toBe(false)
    expect(verifySignature('secret', 'body', 't=abc,v1=deadbeef')).toBe(false)
  })

  it('produces the t=…,v1=… header shape', () => {
    const header = signPayload('secret', 'body', 1700000000)
    expect(header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/)
  })
})

describe('generateSecret', () => {
  it('returns a whsec_-prefixed, sufficiently random secret', () => {
    const a = generateSecret()
    const b = generateSecret()
    expect(a).toMatch(/^whsec_[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
  })
})
