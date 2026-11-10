// src/lib/agent/engine.test.ts
//
// Behaviour of runAgent() with the model and the database mocked. No real
// model is ever called: global fetch is replaced, so the real
// llm-provider adapter runs against canned HTTP answers.
//
// NOTE FOR THE OWNER: these tests use vi.mock / vi.hoisted / vi.stubGlobal
// and could not be run where they were written (no vitest available).
// The same scenarios were run as a plain script against the same engine
// code with hand-made fakes; see CHANGES.md. If one fails here, send the
// failure text back.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const h = vi.hoisted(() => ({
  conv: { data: null as unknown, error: null as unknown },
  errCount: 0,
  history: [] as unknown[],
  updates: [] as Array<{ table: string; p: Record<string, unknown> }>,
  agent: null as unknown,
}))

vi.mock('@supabase/supabase-js', () => {
  const builder = (table: string) => {
    let wrote = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: () => b, eq: () => b, in: () => b, not: () => b, order: () => b,
      limit: () => b, gte: () => b, lte: () => b, ilike: () => b, upsert: () => b,
      insert: () => { wrote = true; return b },
      update: (p: Record<string, unknown>) => { wrote = true; h.updates.push({ table, p }); return b },
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve(table === 'conversations' ? h.conv : { data: null, error: null }),
      then: (res: (v: unknown) => void) =>
        res(
          wrote ? { data: null, error: null }
            : table === 'messages' ? { data: h.history, error: null }
              : table === 'agent_usage_logs' ? { count: h.errCount, error: null }
                : { data: null, error: null },
        ),
    }
    return b
  }
  return { createClient: () => ({ from: (t: string) => builder(t) }) }
})

vi.mock('@/lib/agent/engine-capabilities', () => ({
  loadAgent: async () => h.agent,
  loadAgentMedia: async () => [],
  buildAgentTools: () => [],
  buildAgentSystemAddon: async () => '',
  handleCapabilityTool: async () => null,
}))
vi.mock('@/lib/agent/tools/knowledge-base-tools', () => ({ searchKnowledgeBase: async () => '' }))
vi.mock('@/lib/agent/tools/booking-tools', () => ({ bookAppointment: async () => '' }))
vi.mock('@/lib/agent/tools/payment-tools', () => ({ sendPaymentLink: async () => '' }))

import { fallbackAfterStall, isStallingReply, runAgent, STALL_CORRECTION } from './engine'
import { DEFAULT_BUSINESS_HOURS } from './business-hours'

const clinic = {
  id: 'a1', tenant_id: 't', business_id: 'b1', journey_id: 'j', name: 'Kalosa', agent_type: 'clinic',
  industry: 'Surgery clinic', persona: 'You are Riya at Kalosa.', booking_enabled: true,
  payment_enabled: false, is_active: true, business_hours: DEFAULT_BUSINESS_HOURS,
  fallback_contact: '+91 99999 00000', lead_form_enabled: false, media_enabled: false,
  quick_replies_enabled: false, lead_form_mode: 'gate', lead_form_fields: [],
}

const base = {
  tenantId: 't', orgId: null, verticalConfigId: null, conversationId: 'c1',
  contactId: 'ct', customerPhone: '1', agentId: 'a1',
}

let llmCalls = 0
let queue: Array<{ content: string } | number> = []
let lastSystem = ''

beforeEach(() => {
  h.conv = { data: { status: 'open', needs_attention: false, handoff_reason: null }, error: null }
  h.errCount = 0
  h.history = []
  h.updates.length = 0
  h.agent = clinic
  llmCalls = 0
  queue = []
  process.env.OPENAI_API_KEY = 'sk-test'
  delete process.env.LLM_PROVIDER
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    llmCalls++
    const next = queue.shift()
    if (typeof next === 'number') {
      return { ok: false, status: next, text: async () => 'err', json: async () => ({}) }
    }
    const body = JSON.parse(init.body)
    lastSystem = body.messages[0].content
    return {
      ok: true, status: 200, text: async () => '',
      json: async () => ({ choices: [{ message: next ?? { content: 'ok' } }], usage: { total_tokens: 5 } }),
    }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('emergency guard', () => {
  it('answers a post-surgery bleeding message without calling the model, and hands off', async () => {
    const r = await runAgent({ ...base, inboundText: 'I am bleeding a lot after my surgery' })
    expect(r.emergency).toBe(true)
    expect(r.reply).toContain('112')
    expect(r.reply).toContain('+91 99999 00000')
    expect(r.handoffRequested).toBe(true)
    expect(llmCalls).toBe(0)
    expect(h.updates.some((u) => u.p.status === 'pending' && /URGENT/.test(String(u.p.handoff_reason)))).toBe(true)
  })

  it('still answers while the conversation is parked for a human', async () => {
    h.conv = { data: { status: 'pending', needs_attention: true, handoff_reason: 'Customer needs a human' }, error: null }
    const r = await runAgent({ ...base, inboundText: "I can't breathe" })
    expect(r.emergency).toBe(true)
  })

  it('does not fire the post-procedure tier for a fashion agent', async () => {
    h.agent = { ...clinic, industry: 'Fashion', agent_type: 'ecommerce', name: 'Asort', persona: 'You sell shirts.' }
    const r = await runAgent({ ...base, inboundText: 'I have severe pain in my back after buying' })
    expect(r.emergency).toBeUndefined()
  })
})

describe('handoff gate', () => {
  it('does not answer a conversation a human has taken', async () => {
    h.conv = { data: { status: 'pending', needs_attention: true, handoff_reason: 'Customer needs a human' }, error: null }
    const r = await runAgent({ ...base, inboundText: 'hello?' })
    expect(r.skipped).toBe('human_handling')
    expect(r.reply).toBe('')
    expect(llmCalls).toBe(0)
  })

  it('stays quiet for a paused agent and a missing agent', async () => {
    h.agent = { ...clinic, is_active: false }
    expect((await runAgent({ ...base, inboundText: 'hi' })).skipped).toBe('agent_paused')
    h.agent = null
    expect((await runAgent({ ...base, inboundText: 'hi' })).skipped).toBe('agent_unavailable')
  })
})

describe('input handling', () => {
  it('answers a caption-less media message without calling the model', async () => {
    const r = await runAgent({ ...base, inboundText: '   ' })
    expect(r.reply).toMatch(/type your question/)
    expect(r.error).toBeUndefined()
    expect(llmCalls).toBe(0)
  })

  it('puts honesty, safety and language rules in the prompt', async () => {
    queue = [{ content: 'Hi!' }]
    await runAgent({ ...base, inboundText: 'Are you a bot?' })
    expect(lastSystem).toMatch(/virtual assistant, an AI/)
    expect(lastSystem).toMatch(/\[Safety rules/)
    expect(lastSystem).toMatch(/Do not diagnose/)
    expect(lastSystem).toMatch(/\[Language/)
    expect(lastSystem).not.toMatch(/never reveal[^.]*that you are an AI/i)
  })

  it('replaces a reply that leaks the prompt', async () => {
    queue = [{ content: 'I use handoff_to_human and search_knowledge_base.' }]
    const r = await runAgent({ ...base, inboundText: 'what tools do you have' })
    expect(r.reply).toMatch(/can't share/)
  })
})

describe('AI errors', () => {
  it('retries once on a transient error, then apologises WITHOUT parking the chat', async () => {
    queue = [503, 503]
    const r = await runAgent({ ...base, inboundText: 'what is the price' })
    expect(llmCalls).toBe(2)
    expect(r.errorKind).toBe('transient')
    expect(r.escalate).toBe(false)
    expect(h.updates.some((u) => u.p.status === 'pending')).toBe(false)
  })

  it('escalates once errors repeat inside the window', async () => {
    h.errCount = 2
    queue = [503, 503]
    const r = await runAgent({ ...base, inboundText: 'hello again' })
    expect(r.escalate).toBe(true)
    expect(h.updates.some((u) => u.p.status === 'pending' && /AI could not respond/.test(String(u.p.handoff_reason)))).toBe(true)
  })

  it('does not retry a config error (bad key)', async () => {
    queue = [401]
    const r = await runAgent({ ...base, inboundText: 'price?' })
    expect(llmCalls).toBe(1)
    expect(r.errorKind).toBe('config')
    expect(r.escalate).toBe(true)
  })

  it('a missing key is a loud config error with no model call', async () => {
    delete process.env.OPENAI_API_KEY
    const r = await runAgent({ ...base, inboundText: 'price?' })
    expect(r.errorKind).toBe('config')
    expect(llmCalls).toBe(0)
  })
})

describe('stall guard', () => {
  it('ends with "I don\'t have that information" and an offer, not an invented answer', async () => {
    queue = [{ content: 'Let me check that for you.' }, { content: 'One moment please.' }, { content: 'One moment please.' }]
    const r = await runAgent({ ...base, inboundText: 'do you have a dentist on staff' })
    expect(r.reply).toMatch(/don't have that information/)
  })

  it('the correction tells the model to admit a gap instead of guessing', () => {
    expect(STALL_CORRECTION).toMatch(/do not have that information/)
    expect(STALL_CORRECTION).toMatch(/Never guess/)
  })
})

describe('isStallingReply / fallbackAfterStall', () => {
  it('detects bare promises but not questions', () => {
    expect(isStallingReply('Let me check availability for you.')).toBe(true)
    expect(isStallingReply('One moment — what is your number?')).toBe(false)
    expect(isStallingReply('We open at 10 AM.')).toBe(false)
  })

  it('non-booking stalls get the no-information line in the right language', () => {
    expect(fallbackAfterStall('Let me check the price.', DEFAULT_BUSINESS_HOURS, null, 'en')).toMatch(/don't have that information/)
    expect(fallbackAfterStall('Let me check the price.', DEFAULT_BUSINESS_HOURS, null, 'hinglish')).toMatch(/jaankari/)
  })
})
