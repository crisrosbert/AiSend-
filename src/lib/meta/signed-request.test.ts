// src/lib/meta/signed-request.test.ts
//
// This signature is the only thing standing between a public URL and
// deleting a business's entire account, so the forgery cases matter
// more than the happy path.

import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  verifySignedRequest,
  buildSignedRequest,
  newConfirmationCode,
} from './signed-request'

const SECRET = 'test-app-secret-0123456789'
const OTHER_SECRET = 'a-different-app-secret'

function validRequest(over: Record<string, unknown> = {}) {
  return buildSignedRequest(
    { algorithm: 'HMAC-SHA256', issued_at: 1786000000, user_id: '1234567890', ...over },
    SECRET,
  )
}

describe('accepting a genuine request', () => {
  it('verifies one built the way Meta builds it', () => {
    const result = verifySignedRequest(validRequest(), SECRET)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.userId).toBe('1234567890')
    expect(result.payload.issuedAt).toBe(1786000000)
  })

  it('keeps any extra fields Meta included', () => {
    const result = verifySignedRequest(validRequest({ expires: 0, code: 'abc' }), SECRET)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.raw.code).toBe('abc')
  })

  it('handles a payload whose base64 needs padding restored', () => {
    // Meta strips '='. Lengths vary, so run a spread of user ids to hit
    // every remainder case.
    for (const id of ['1', '12', '123', '1234', '12345', '123456']) {
      const result = verifySignedRequest(validRequest({ user_id: id }), SECRET)
      expect(result.ok, `failed for user_id ${id}`).toBe(true)
    }
  })
})

describe('refusing a forged request', () => {
  it('refuses a signature made with the wrong secret', () => {
    const forged = buildSignedRequest(
      { algorithm: 'HMAC-SHA256', issued_at: 1786000000, user_id: '1234567890' },
      OTHER_SECRET,
    )
    const result = verifySignedRequest(forged, SECRET)
    expect(result.ok).toBe(false)
  })

  it('refuses a tampered payload that keeps the old signature', () => {
    // The attack: take a real request, swap in someone else's user id.
    const real = validRequest({ user_id: 'victim-000' })
    const [signature] = real.split('.')
    const swapped = Buffer.from(
      JSON.stringify({ algorithm: 'HMAC-SHA256', issued_at: 1786000000, user_id: 'attacker-999' }),
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const result = verifySignedRequest(`${signature}.${swapped}`, SECRET)
    expect(result.ok).toBe(false)
  })

  it('refuses a downgraded algorithm', () => {
    // Correctly signed, but claiming something weaker.
    const result = verifySignedRequest(validRequest({ algorithm: 'none' }), SECRET)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/algorithm/i)
  })

  it('refuses a request with no user_id', () => {
    const result = verifySignedRequest(validRequest({ user_id: '' }), SECRET)
    expect(result.ok).toBe(false)
  })

  it('refuses malformed input without throwing', () => {
    for (const bad of ['', 'nodot', 'a.b.c', '.onlypayload', 'onlysig.', 'a.!!!not-base64!!!']) {
      const result = verifySignedRequest(bad, SECRET)
      expect(result.ok, `accepted "${bad}"`).toBe(false)
    }
  })

  it('refuses null and undefined', () => {
    expect(verifySignedRequest(null, SECRET).ok).toBe(false)
    expect(verifySignedRequest(undefined, SECRET).ok).toBe(false)
  })

  it('refuses a signature of the wrong length rather than throwing', () => {
    // timingSafeEqual throws on mismatched lengths; that must be caught
    // before it reaches the request handler as a 500.
    const [, payload] = validRequest().split('.')
    const short = Buffer.from('too-short').toString('base64url')
    const result = verifySignedRequest(`${short}.${payload}`, SECRET)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/length/i)
  })

  it('refuses everything when the app secret is not configured', () => {
    // Better to reject genuine requests than to accept forged ones.
    expect(verifySignedRequest(validRequest(), undefined).ok).toBe(false)
    expect(verifySignedRequest(validRequest(), '').ok).toBe(false)
  })

  it('refuses a payload that is valid base64 but not JSON', () => {
    const payload = Buffer.from('not json at all').toString('base64url')
    const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
    const result = verifySignedRequest(`${signature}.${payload}`, SECRET)
    expect(result.ok).toBe(false)
  })
})

describe('newConfirmationCode', () => {
  it('is formatted for someone to read out loud', () => {
    expect(newConfirmationCode()).toMatch(/^DEL-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
  })

  it('omits letters that get misread', () => {
    // Crockford base32: no I, L, O or U.
    for (let i = 0; i < 200; i++) {
      expect(newConfirmationCode().slice(4)).not.toMatch(/[ILOU]/)
    }
  })

  it('does not repeat', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) seen.add(newConfirmationCode())
    expect(seen.size).toBe(500)
  })
})
