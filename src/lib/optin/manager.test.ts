// src/lib/optin/manager.test.ts
// Mocks only: @supabase/supabase-js is replaced by an in-memory fake.
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface FakeState {
  contactStatus: string | null
  lastOutbound: string | null
  contactUpdates: Record<string, unknown>[]
  events: Record<string, unknown>[]
  queries: string[]
  /** errors returned (in order) by successive contact updates */
  updateErrors: ({ code?: string; message: string } | null)[]
}
const state: FakeState = {
  contactStatus: null,
  lastOutbound: null,
  contactUpdates: [],
  events: [],
  queries: [],
  updateErrors: [],
}

function builder(table: string) {
  let isUpdate = false
  let updatePatch: Record<string, unknown> | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select: () => b,
    eq: () => b,
    in: () => b,
    order: () => b,
    limit: () => b,
    update: (patch: Record<string, unknown>) => {
      isUpdate = true
      updatePatch = patch
      return b
    },
    insert: async (row: Record<string, unknown>) => {
      if (table === 'optin_events') state.events.push(row)
      return { error: null }
    },
    maybeSingle: async () => {
      state.queries.push(table)
      if (table === 'contacts') return { data: { opt_in_status: state.contactStatus }, error: null }
      if (table === 'conversations') return { data: { id: 'conv-1' }, error: null }
      if (table === 'messages') {
        return { data: state.lastOutbound === null ? null : { content_text: state.lastOutbound }, error: null }
      }
      return { data: null, error: null }
    },
    // awaiting an update chain resolves like a promise
    then: (resolve: (v: unknown) => void) => {
      if (isUpdate && table === 'contacts' && updatePatch) {
        state.contactUpdates.push(updatePatch)
        resolve({ error: state.updateErrors.shift() ?? null })
        return
      }
      resolve({ error: null })
    },
  }
  return b
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (t: string) => builder(t) }),
}))

import {
  normalizeConsentText,
  detectConsentKeyword,
  isCasualOptInReply,
  looksLikeConsentRequest,
  decideConsentAction,
  handleInboundConsent,
  isMissingColumnError,
  recordConsent,
} from './manager'

const CONSENT_PROMPT = 'Acme Salon: reply YES to receive offers and updates on WhatsApp.'
const BOOKING_Q = 'Shall I confirm your 5pm haircut slot tomorrow? Reply yes to confirm.'

function run(text: string) {
  return handleInboundConsent({ userId: 'u1', contactId: 'c1', phone: '911234567890', inboundText: text })
}

beforeEach(() => {
  state.contactStatus = null
  state.lastOutbound = null
  state.contactUpdates = []
  state.events = []
  state.queries = []
  state.updateErrors = []
})

describe('normalizeConsentText', () => {
  it('strips punctuation, emoji, case and spaces', () => {
    expect(normalizeConsentText('  STOP. ')).toBe('stop')
    expect(normalizeConsentText('Opt-out!!')).toBe('opt out')
    expect(normalizeConsentText('yes 👍')).toBe('yes')
    expect(normalizeConsentText(null)).toBe('')
  })
})

describe('detectConsentKeyword (exact match only)', () => {
  it.each(['stop', 'STOP', 'STOP.', 'Stop!', ' stop ', 'unsubscribe', 'opt out', 'opt-out', 'band karo'])(
    '%s is opt_out',
    (t) => expect(detectConsentKeyword(t)).toBe('opt_out'),
  )
  it.each(['stop the booking', 'stopping', 'please stop sending', 'ruko', 'ruko ruko', 'bus stop kahan hai', 'stop kar do booking'])(
    '%s is NOT a keyword',
    (t) => expect(detectConsentKeyword(t)).toBeNull(),
  )
  it('explicit opt-in words are exact', () => {
    expect(detectConsentKeyword('START')).toBe('opt_in')
    expect(detectConsentKeyword('subscribe')).toBe('opt_in')
    expect(detectConsentKeyword('start the booking')).toBeNull()
  })
  it('casual words are never decided without context', () => {
    for (const w of ['yes', 'haan', 'ha', 'ok']) expect(detectConsentKeyword(w)).toBeNull()
  })
})

describe('isCasualOptInReply / looksLikeConsentRequest', () => {
  it('recognises casual replies incl. Hinglish', () => {
    for (const w of ['Yes', 'HAAN', 'ha', 'Ok.', 'haan ji']) expect(isCasualOptInReply(w)).toBe(true)
    expect(isCasualOptInReply('haan lekin kal aana')).toBe(false)
  })
  it('only consent prompts match', () => {
    expect(looksLikeConsentRequest(CONSENT_PROMPT)).toBe(true)
    expect(looksLikeConsentRequest('Reply START to subscribe to our updates')).toBe(true)
    expect(looksLikeConsentRequest(BOOKING_Q)).toBe(false)
    expect(looksLikeConsentRequest('Reply YES to know more.')).toBe(false)
    expect(looksLikeConsentRequest(null)).toBe(false)
  })
})

describe('decideConsentAction (pure)', () => {
  it('yes after a consent prompt, not opted in -> opt_in', () => {
    expect(decideConsentAction({ text: 'yes', optInStatus: 'pending', lastOutboundText: CONSENT_PROMPT })).toBe('opt_in')
    expect(decideConsentAction({ text: 'haan', optInStatus: null, lastOutboundText: CONSENT_PROMPT })).toBe('opt_in')
  })
  it('yes after a booking question -> null', () => {
    expect(decideConsentAction({ text: 'yes', optInStatus: null, lastOutboundText: BOOKING_Q })).toBeNull()
  })
  it('yes when already opted in -> null', () => {
    expect(decideConsentAction({ text: 'yes', optInStatus: 'opted_in', lastOutboundText: CONSENT_PROMPT })).toBeNull()
  })
  it('yes with no previous outbound -> null', () => {
    expect(decideConsentAction({ text: 'yes', optInStatus: null, lastOutboundText: null })).toBeNull()
  })
  it('stop wins regardless of context', () => {
    expect(decideConsentAction({ text: 'STOP.', optInStatus: 'opted_in', lastOutboundText: BOOKING_Q })).toBe('opt_out')
  })
})

describe('handleInboundConsent', () => {
  it('"yes" to a booking question falls through (false) and records nothing', async () => {
    state.lastOutbound = BOOKING_Q
    expect(await run('yes')).toBe(false)
    expect(state.events).toHaveLength(0)
    expect(state.contactUpdates).toHaveLength(0)
  })

  it('"haan" to a booking question falls through', async () => {
    state.lastOutbound = BOOKING_Q
    expect(await run('Haan')).toBe(false)
  })

  it('"yes" to an opt-in prompt records opt_in and is handled', async () => {
    state.lastOutbound = CONSENT_PROMPT
    expect(await run('yes')).toBe(true)
    expect(state.events).toHaveLength(1)
    expect(state.events[0]).toMatchObject({ event: 'opt_in', source: 'whatsapp_reply', contact_id: 'c1' })
    expect(state.contactUpdates[0]).toMatchObject({ opt_in_status: 'opted_in' })
  })

  it('"yes" from an already opted-in contact falls through', async () => {
    state.contactStatus = 'opted_in'
    state.lastOutbound = CONSENT_PROMPT
    expect(await run('yes')).toBe(false)
    expect(state.events).toHaveLength(0)
  })

  it('"stop" and "STOP." are opt-outs', async () => {
    expect(await run('stop')).toBe(true)
    expect(state.events[0]).toMatchObject({ event: 'opt_out' })
    state.events = []
    expect(await run('STOP.')).toBe(true)
    expect(state.events[0]).toMatchObject({ event: 'opt_out' })
  })

  it('"stop the booking" is NOT an opt-out', async () => {
    expect(await run('stop the booking')).toBe(false)
    expect(state.events).toHaveLength(0)
    expect(state.queries).toHaveLength(0) // fast path: no DB work
  })

  it('"ruko" is not an opt-out', async () => {
    expect(await run('ruko')).toBe(false)
    expect(await run('ruko ruko mujhe ek minute do')).toBe(false)
    expect(state.events).toHaveLength(0)
  })

  it('idempotent: STOP from an already opted-out contact writes nothing but is still swallowed', async () => {
    state.contactStatus = 'opted_out'
    expect(await run('stop')).toBe(true)
    expect(state.events).toHaveLength(0)
    expect(state.contactUpdates).toHaveLength(0)
  })

  it('idempotent: START from an already opted-in contact falls through', async () => {
    state.contactStatus = 'opted_in'
    expect(await run('start')).toBe(false)
    expect(state.events).toHaveLength(0)
  })

  it('ordinary text does no database work', async () => {
    expect(await run('what are your timings?')).toBe(false)
    expect(state.queries).toHaveLength(0)
  })

  it('empty text is ignored', async () => {
    expect(await run('')).toBe(false)
  })
})

describe('opted_out_at is written together with opt_out_at', () => {
  it('STOP writes opt_in_status, opt_out_at and opted_out_at (same timestamp)', async () => {
    expect(await run('stop')).toBe(true)
    expect(state.contactUpdates).toHaveLength(1)
    const p = state.contactUpdates[0]
    expect(p.opt_in_status).toBe('opted_out')
    expect(typeof p.opt_out_at).toBe('string')
    expect(p.opted_out_at).toBe(p.opt_out_at)
  })

  it('opt-in clears both opt_out_at and opted_out_at', async () => {
    state.lastOutbound = CONSENT_PROMPT
    expect(await run('yes')).toBe(true)
    const p = state.contactUpdates[0]
    expect(p.opt_in_status).toBe('opted_in')
    expect(p.opt_out_at).toBeNull()
    expect(p.opted_out_at).toBeNull()
  })

  it('column missing (Postgres 42703): retries once WITHOUT opted_out_at, other fields kept', async () => {
    state.updateErrors = [{ code: '42703', message: 'column "opted_out_at" of relation "contacts" does not exist' }]
    expect(await run('stop')).toBe(true)
    expect(state.contactUpdates).toHaveLength(2)
    expect('opted_out_at' in state.contactUpdates[0]).toBe(true)
    expect('opted_out_at' in state.contactUpdates[1]).toBe(false)
    expect(state.contactUpdates[1]).toMatchObject({ opt_in_status: 'opted_out' })
    expect(state.events).toHaveLength(1) // audit row still written
  })

  it('column missing (PostgREST PGRST204) also retries without it', async () => {
    state.updateErrors = [{ code: 'PGRST204', message: "Could not find the 'opted_out_at' column of 'contacts' in the schema cache" }]
    await recordConsent({ userId: 'u1', contactId: 'c1', event: 'opt_in', source: 'x' })
    expect(state.contactUpdates).toHaveLength(2)
    expect('opted_out_at' in state.contactUpdates[1]).toBe(false)
    expect(state.contactUpdates[1]).toMatchObject({ opt_in_status: 'opted_in', opt_out_at: null })
  })

  it('any other error is NOT retried', async () => {
    state.updateErrors = [{ code: '23505', message: 'duplicate key' }]
    await recordConsent({ userId: 'u1', contactId: 'c1', event: 'opt_out', source: 'x' })
    expect(state.contactUpdates).toHaveLength(1)
  })

  it('a missing OTHER column is not treated as opted_out_at', async () => {
    state.updateErrors = [{ code: '42703', message: 'column "opt_in_source" of relation "contacts" does not exist' }]
    await recordConsent({ userId: 'u1', contactId: 'c1', event: 'opt_in', source: 'x' })
    expect(state.contactUpdates).toHaveLength(1)
  })
})

describe('isMissingColumnError', () => {
  it('matches only the named column', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column "opted_out_at" does not exist' }, 'opted_out_at')).toBe(true)
    expect(isMissingColumnError({ code: '42703', message: 'column "x" does not exist' }, 'opted_out_at')).toBe(false)
    expect(isMissingColumnError({ code: '23505', message: 'opted_out_at duplicate' }, 'opted_out_at')).toBe(false)
    expect(isMissingColumnError(null, 'opted_out_at')).toBe(false)
  })
})
