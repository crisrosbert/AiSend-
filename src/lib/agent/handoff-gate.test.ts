// src/lib/agent/handoff-gate.test.ts
import { describe, it, expect } from 'vitest'
import {
  AI_ERROR_REASON,
  AUTO_RESUME_MS,
  checkBotGate,
  countRecentErrors,
  decideGate,
  isAiErrorReason,
  isParked,
  shouldEscalateErrors,
  type GateFacts,
} from './handoff-gate'

const NOW = new Date('2026-08-12T10:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms)

function facts(over: Partial<GateFacts>): GateFacts {
  return {
    status: 'open',
    needsAttention: false,
    handoffReason: null,
    lastErrorAt: null,
    lastHumanAt: null,
    now: NOW,
    ...over,
  }
}

describe('decideGate', () => {
  it('allows an open conversation', () => {
    expect(decideGate(facts({}))).toBe('allow')
  })

  it('blocks a pending conversation handed off by the customer or the model', () => {
    expect(decideGate(facts({ status: 'pending', needsAttention: true, handoffReason: 'Customer needs a human' }))).toBe('block')
  })

  it('blocks on needs_attention with a handoff reason even when status is open', () => {
    expect(decideGate(facts({ needsAttention: true, handoffReason: 'Complaint' }))).toBe('block')
  })

  it('does NOT block on needs_attention alone (widget lead form raises it without a handoff)', () => {
    // /api/widget/lead sets needs_attention = true and no handoff_reason.
    expect(decideGate(facts({ needsAttention: true, handoffReason: null }))).toBe('allow')
    expect(decideGate(facts({ needsAttention: true, handoffReason: '  ' }))).toBe('allow')
  })

  it('isParked: pending always parks; the flag needs a reason', () => {
    expect(isParked('pending', false, null)).toBe(true)
    expect(isParked('open', true, 'Complaint')).toBe(true)
    expect(isParked('open', true, null)).toBe(false)
    expect(isParked('open', false, 'stale reason')).toBe(false)
    expect(isParked(undefined, undefined, undefined)).toBe(false)
  })

  it('return-to-bot (open, flags cleared) allows again', () => {
    expect(decideGate(facts({ status: 'open', needsAttention: false, handoffReason: null }))).toBe('allow')
  })

  it('never auto-resumes an emergency or a human handoff, however old', () => {
    const f = facts({ status: 'pending', needsAttention: true, handoffReason: 'URGENT: bleeding', lastErrorAt: ago(10 * AUTO_RESUME_MS) })
    expect(decideGate(f)).toBe('block')
  })

  it('keeps blocking an AI-error park until a quiet period has passed', () => {
    const f = facts({ status: 'pending', needsAttention: true, handoffReason: AI_ERROR_REASON, lastErrorAt: ago(5 * 60_000) })
    expect(decideGate(f)).toBe('block')
  })

  it('resumes an AI-error park after the quiet period', () => {
    const f = facts({ status: 'pending', needsAttention: true, handoffReason: AI_ERROR_REASON, lastErrorAt: ago(AUTO_RESUME_MS + 1000) })
    expect(decideGate(f)).toBe('resume')
  })

  it('resumes an AI-error park that has no error rows at all', () => {
    const f = facts({ status: 'pending', needsAttention: true, handoffReason: AI_ERROR_REASON })
    expect(decideGate(f)).toBe('resume')
  })

  it('does not resume once a human has written after the error', () => {
    const f = facts({
      status: 'pending', needsAttention: true, handoffReason: AI_ERROR_REASON,
      lastErrorAt: ago(AUTO_RESUME_MS + 60_000), lastHumanAt: ago(AUTO_RESUME_MS),
    })
    expect(decideGate(f)).toBe('block')
  })

  it('resumes when the human message is older than the error', () => {
    const f = facts({
      status: 'pending', needsAttention: true, handoffReason: AI_ERROR_REASON,
      lastErrorAt: ago(AUTO_RESUME_MS + 1000), lastHumanAt: ago(AUTO_RESUME_MS + 600_000),
    })
    expect(decideGate(f)).toBe('resume')
  })
})

describe('helpers', () => {
  it('isAiErrorReason matches only the exact reason', () => {
    expect(isAiErrorReason(AI_ERROR_REASON)).toBe(true)
    expect(isAiErrorReason(`  ${AI_ERROR_REASON} `)).toBe(true)
    expect(isAiErrorReason('Customer needs a human')).toBe(false)
    expect(isAiErrorReason(null)).toBe(false)
  })

  it('one error apologises, two escalate', () => {
    expect(shouldEscalateErrors(0)).toBe(false)
    expect(shouldEscalateErrors(1)).toBe(false)
    expect(shouldEscalateErrors(2)).toBe(true)
    expect(shouldEscalateErrors(5)).toBe(true)
  })
})

// A tiny fake of the Supabase query builder: every call returns the
// builder, awaiting it yields the canned result for that table.
function fakeDb(tables: Record<string, unknown>, updates: Array<Record<string, unknown>> = []) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const make = (table: string): any => {
    let isUpdate = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b, eq: () => b, not: () => b, order: () => b, limit: () => b, gte: () => b,
      maybeSingle: () => Promise.resolve(tables[table] ?? { data: null, error: null }),
      update: (patch: Record<string, unknown>) => { isUpdate = true; updates.push(patch); return b },
      then: (res: (v: unknown) => void) => res(isUpdate ? { data: null, error: null } : (tables[table] ?? { data: null, error: null })),
    }
    return b
  }
  return { from: make }
}

describe('checkBotGate', () => {
  it('allows when the conversation is open', async () => {
    const db = fakeDb({ conversations: { data: { status: 'open', needs_attention: false, handoff_reason: null }, error: null } })
    expect(await checkBotGate(db, 'c1', NOW)).toEqual({ allowed: true, resumed: false })
  })

  it('blocks a pending conversation', async () => {
    const db = fakeDb({ conversations: { data: { status: 'pending', needs_attention: true, handoff_reason: 'Customer needs a human' }, error: null } })
    expect(await checkBotGate(db, 'c1', NOW)).toEqual({ allowed: false, resumed: false })
  })

  it('auto-resumes a stale AI-error park and clears the flags', async () => {
    const updates: Array<Record<string, unknown>> = []
    const db = fakeDb(
      {
        conversations: { data: { status: 'pending', needs_attention: true, handoff_reason: AI_ERROR_REASON }, error: null },
        agent_usage_logs: { data: { created_at: ago(2 * AUTO_RESUME_MS).toISOString() }, error: null },
        messages: { data: null, error: null },
      },
      updates,
    )
    expect(await checkBotGate(db, 'c1', NOW)).toEqual({ allowed: true, resumed: true })
    expect(updates[0]).toMatchObject({ status: 'open', needs_attention: false, handoff_reason: null })
  })

  it('fails open when the read errors', async () => {
    const db = fakeDb({ conversations: { data: null, error: { message: 'boom' } } })
    expect(await checkBotGate(db, 'c1', NOW)).toEqual({ allowed: true, resumed: false })
  })

  it('fails open when the client throws', async () => {
    const db = { from: () => { throw new Error('down') } }
    expect(await checkBotGate(db, 'c1', NOW)).toEqual({ allowed: true, resumed: false })
  })
})

describe('countRecentErrors', () => {
  it('returns the count', async () => {
    const db = fakeDb({ agent_usage_logs: { count: 3, error: null } })
    expect(await countRecentErrors(db, 'c1', NOW)).toBe(3)
  })
  it('returns 0 on error', async () => {
    const db = fakeDb({ agent_usage_logs: { count: null, error: { message: 'x' } } })
    expect(await countRecentErrors(db, 'c1', NOW)).toBe(0)
  })
})
