// src/lib/whatsapp/verify-token.test.ts
//
// Meta calls GET /api/whatsapp/webhook once, when you press "Verify and
// save" in the dashboard. For a Tech Provider that happens BEFORE any
// client has connected, so the platform's own token (env) has to work with
// zero database rows — and when it is not configured, nothing may match by
// accident (no built-in default, no empty-equals-empty).

import { describe, it, expect } from 'vitest'
import { platformTokenMatches, findTenantByVerifyToken } from './verify-token'

describe('platformTokenMatches', () => {
  it('accepts the configured platform token', () => {
    expect(platformTokenMatches('s3cret-platform-token', 's3cret-platform-token')).toBe(true)
  })

  it('tolerates the trailing newline that pasting into a dashboard adds to the env value', () => {
    expect(platformTokenMatches('s3cret', 's3cret\n')).toBe(true)
  })

  it.each([
    ['a different token', 'guess', 's3cret'],
    ['a prefix of the real token', 's3c', 's3cret'],
    ['the real token plus extra text', 's3cret-and-more', 's3cret'],
    ['different case', 'S3CRET', 's3cret'],
  ])('rejects %s', (_label, provided, configured) => {
    expect(platformTokenMatches(provided, configured)).toBe(false)
  })

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace only', '  \n'],
  ])('matches nothing when the platform token is %s — not even the same blank value', (_label, configured) => {
    expect(platformTokenMatches('', configured)).toBe(false)
    expect(platformTokenMatches('clickstream2026', configured)).toBe(false)
    expect(platformTokenMatches('undefined', configured)).toBe(false)
  })
})

describe('findTenantByVerifyToken', () => {
  // The real encryption is exercised in encryption.test.ts; here a reversible
  // stand-in keeps the test about WHICH row is chosen.
  const decrypt = (v: string) => {
    if (v.startsWith('BROKEN')) throw new Error('bad ciphertext')
    return v.replace(/^enc:/, '')
  }

  it('returns the row whose decrypted token equals the provided one', () => {
    const rows = [
      { id: 'a', verify_token: 'enc:alpha' },
      { id: 'b', verify_token: 'enc:beta' },
    ]
    expect(findTenantByVerifyToken('beta', rows, decrypt)?.id).toBe('b')
  })

  it('returns null when no row matches', () => {
    expect(findTenantByVerifyToken('nope', [{ id: 'a', verify_token: 'enc:alpha' }], decrypt)).toBeNull()
  })

  it('skips rows with no token and rows that cannot be decrypted, and keeps looking', () => {
    const rows = [
      { id: 'none', verify_token: null },
      { id: 'broken', verify_token: 'BROKEN-xyz' },
      { id: 'good', verify_token: 'enc:alpha' },
    ]
    expect(findTenantByVerifyToken('alpha', rows, decrypt)?.id).toBe('good')
  })

  it('does not treat a row without a token as matching an empty provided token', () => {
    expect(findTenantByVerifyToken('', [{ id: 'none', verify_token: null }], decrypt)).toBeNull()
  })
})
