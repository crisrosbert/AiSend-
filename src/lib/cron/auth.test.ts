import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cronSecret, suppliedSecret, verifyCron } from './auth'

const SECRET = 'test-cron-secret'

function req(headers: Record<string, string> = {}, url = 'https://x/api/cron/sweep') {
  return new Request(url, { headers })
}

describe('cron auth', () => {
  let saved: Record<string, string | undefined>

  beforeEach(() => {
    saved = {
      AUTOMATION_CRON_SECRET: process.env.AUTOMATION_CRON_SECRET,
      CRON_SECRET: process.env.CRON_SECRET,
    }
    delete process.env.AUTOMATION_CRON_SECRET
    process.env.CRON_SECRET = SECRET
  })

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  describe('cronSecret', () => {
    it('prefers the automation-specific name, falls back to the shared one', () => {
      expect(cronSecret()).toBe(SECRET)
      process.env.AUTOMATION_CRON_SECRET = 'specific'
      expect(cronSecret()).toBe('specific')
    })

    it('is null when neither is set', () => {
      delete process.env.CRON_SECRET
      expect(cronSecret()).toBeNull()
    })
  })

  describe('suppliedSecret', () => {
    // The bug this file exists to prevent: the automations queue read
    // only x-cron-secret, and Vercel Cron sends Authorization: Bearer.
    // All three sources are read so a scheduler cannot silently miss.
    it('reads a Bearer authorization header', () => {
      expect(suppliedSecret(req({ authorization: `Bearer ${SECRET}` }))).toBe(SECRET)
    })

    it('accepts a bare authorization header without the Bearer prefix', () => {
      expect(suppliedSecret(req({ authorization: SECRET }))).toBe(SECRET)
    })

    it('is case-insensitive about the Bearer prefix', () => {
      expect(suppliedSecret(req({ authorization: `bearer ${SECRET}` }))).toBe(SECRET)
    })

    it('reads the x-cron-secret header', () => {
      expect(suppliedSecret(req({ 'x-cron-secret': SECRET }))).toBe(SECRET)
    })

    it('reads a secret query parameter', () => {
      expect(suppliedSecret(req({}, `https://x/api/cron/sweep?secret=${SECRET}`))).toBe(SECRET)
    })

    it('returns null when nothing is supplied', () => {
      expect(suppliedSecret(req())).toBeNull()
    })

    it('ignores an empty Bearer header rather than returning an empty string', () => {
      // '' must not later compare equal to a missing env var.
      expect(suppliedSecret(req({ authorization: 'Bearer ' }))).toBeNull()
    })
  })

  describe('verifyCron', () => {
    it('accepts a matching secret', () => {
      expect(verifyCron(req({ authorization: `Bearer ${SECRET}` }))).toEqual({ ok: true })
    })

    it('rejects a wrong secret with 401', () => {
      const result = verifyCron(req({ authorization: 'Bearer nope' }))
      expect(result).toMatchObject({ ok: false, status: 401 })
    })

    it('rejects a missing secret with 401', () => {
      expect(verifyCron(req())).toMatchObject({ ok: false, status: 401 })
    })

    // 503, not 401: the caller did nothing wrong, the deployment is
    // incomplete, and from outside those need to look different.
    it('reports 503 when no secret is configured at all', () => {
      delete process.env.CRON_SECRET
      const result = verifyCron(req({ authorization: 'Bearer anything' }))
      expect(result).toMatchObject({ ok: false, status: 503 })
    })

    // The dangerous case: unset env var and unset header must not be
    // read as "they match".
    it('does not treat two absent values as a match', () => {
      delete process.env.CRON_SECRET
      expect(verifyCron(req())).toMatchObject({ ok: false })
    })
  })
})
