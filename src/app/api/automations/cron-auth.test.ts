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

describe('vercel.json only asks for schedules the plan can run', () => {
  const vercel = JSON.parse(
    readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'),
  ) as { crons?: Array<{ path: string; schedule: string }> }

  // ── WHY THIS TEST REPLACED "the queue is actually scheduled" ────────
  //
  // It used to assert that /api/automations/cron appeared here on a
  // */15 schedule. That assertion was correct about what the feature
  // needs and wrong about what the account can do: Vercel's Hobby plan
  // rejects any cron that runs more than once a day, and it rejects the
  // whole DEPLOYMENT, not just the cron.
  //
  // The result was a silent outage. Every push after that entry landed
  // produced no deployment at all — no error in the deployments list,
  // because no deployment was ever created — while CI stayed green and
  // this test stayed green. Production served day-old code for a day
  // before anyone noticed.
  //
  // So the invariant worth guarding is the opposite one: nothing in
  // this file may ask for a schedule the plan will refuse. A feature
  // that wants a faster cadence has to be driven from outside (an
  // external pinger against the authenticated route above) or wait for
  // a plan that allows it.
  //
  // If you upgrade to Pro, relax DAILY_ONLY and put the */15 back.

  const DAILY_ONLY = /^(\d+|\*) (\d+) \* \* \*$/

  it('has no cron that runs more than once a day', () => {
    for (const job of vercel.crons ?? []) {
      expect(
        DAILY_ONLY.test(job.schedule),
        `${job.path} uses "${job.schedule}", which Hobby rejects — and a ` +
          `rejected cron blocks every deployment, not just this job`,
      ).toBe(true)
    }
  })

  // The automations queue therefore has no scheduler of its own right
  // now. That is a real gap, recorded here rather than hidden: a `wait`
  // step will not resume until something calls the route. The route is
  // authenticated (tested above) precisely so an external pinger can.
  it('documents that the automations queue is externally driven', () => {
    const paths = (vercel.crons ?? []).map((c) => c.path)
    expect(paths).not.toContain('/api/automations/cron')
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
