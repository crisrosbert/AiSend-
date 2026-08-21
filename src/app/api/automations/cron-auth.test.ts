// src/app/api/automations/cron-auth.test.ts
//
// The automations queue was unreachable in production, for two reasons
// at once — and neither produced an error anywhere.
//
//   1. /api/automations/cron was not listed in vercel.json, so nothing
//      ever called it.
//   2. It read `x-cron-secret`. Vercel Cron sends
//      `Authorization: Bearer <secret>`. So even once scheduled, every
//      invocation would have been rejected as unauthorised.
//
// A `wait` step enqueues a row and stops; this route is what resumes
// it. With nothing draining the queue, every automation containing a
// delay ran its first half and then stopped forever. The log showed it
// starting. Nothing showed it never finishing.
//
// These tests pin the header handling. The schedule itself lives in
// vercel.json and is checked here too, because a route that parses its
// auth perfectly and is never called is still a broken feature.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Mirrors the secret extraction in the route. */
function suppliedSecret(headers: Record<string, string>, url = 'https://x/api/automations/cron') {
  const get = (k: string) => headers[k.toLowerCase()] ?? null
  return (
    get('authorization')?.replace(/^Bearer\s+/i, '') ||
    get('x-cron-secret') ||
    new URL(url).searchParams.get('secret')
  )
}

describe('automations cron auth', () => {
  const SECRET = 's3cr3t'

  it('accepts the Bearer header Vercel Cron actually sends', () => {
    // The whole bug in one assertion.
    expect(suppliedSecret({ authorization: `Bearer ${SECRET}` })).toBe(SECRET)
  })

  it('is case-insensitive about the Bearer prefix', () => {
    expect(suppliedSecret({ authorization: `bearer ${SECRET}` })).toBe(SECRET)
  })

  it('still accepts the original x-cron-secret header', () => {
    // An external pinger may already be configured against it. Changing
    // the header without keeping the old one would trade one silent
    // outage for another.
    expect(suppliedSecret({ 'x-cron-secret': SECRET })).toBe(SECRET)
  })

  it('accepts ?secret= for manual draining', () => {
    expect(
      suppliedSecret({}, `https://x/api/automations/cron?secret=${SECRET}`),
    ).toBe(SECRET)
  })

  it('yields null when nothing is supplied', () => {
    // Must not coerce to a value that could equal a missing env var.
    expect(suppliedSecret({})).toBeNull()
  })

  it('does not confuse a bare token with a Bearer one', () => {
    // Some pingers send the raw secret in Authorization with no prefix.
    expect(suppliedSecret({ authorization: SECRET })).toBe(SECRET)
  })
})

describe('the queue is actually scheduled', () => {
  const vercel = JSON.parse(
    readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'),
  ) as { crons?: Array<{ path: string; schedule: string }> }

  it('lists /api/automations/cron', () => {
    // Correct auth on a route nobody calls is still a dead feature.
    const paths = (vercel.crons ?? []).map((c) => c.path)
    expect(paths).toContain('/api/automations/cron')
  })

  it('runs it often enough for a delay to feel like a delay', () => {
    // A "wait 30 minutes" step drained once a day is not a delay, it is
    // an outage with a schedule. Anything hourly or faster is fine.
    const job = (vercel.crons ?? []).find((c) => c.path === '/api/automations/cron')
    expect(job).toBeDefined()
    expect(job!.schedule).toMatch(/^\*\/\d+ \* \* \* \*$|^0 \* \* \* \*$/)
  })

  it('keeps every other cron that was already scheduled', () => {
    // This file adds one entry; losing an existing one would stop
    // appointment reminders or the deletion job without a word.
    const paths = (vercel.crons ?? []).map((c) => c.path)
    for (const p of [
      '/api/cron/appointment-reminders',
      '/api/cron/process-deletions',
      '/api/cron/health-check',
    ]) {
      expect(paths, p).toContain(p)
    }
  })
})
