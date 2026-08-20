// src/lib/agent/knowledge-scope.test.ts
//
// One tenant, several businesses. This file exists because that case
// broke in the most damaging way available: the fashion shop's agent
// started answering out of the surgery clinic's website.
//
// ── HOW IT HAPPENED ──────────────────────────────────────────────────
// Knowledge is filtered by journey_id. The widget route read that id
// from the widget_configs row — but an agent-scoped embed whose agent
// has no config row of its own deliberately falls back to the tenant's
// org-wide row. That row belongs to whichever site was set up first.
// So every agent inherited the first site's journey, and the retrieval
// filter pointed at the wrong Brain while the persona pointed at the
// right one. The agent sounded like Asort and answered like Kalosa.
//
// The second half was quieter and worse: when no journey could be
// found at all, the id was undefined, and undefined meant "no filter" —
// search everything the tenant owns. An untrained agent therefore had
// access to every other site's pages.
//
// Both halves are the same mistake: letting "I have no knowledge"
// collapse into "give me all knowledge". These tests keep them apart.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { knowledgeScope } from './engine'
import type { Agent } from './engine-capabilities'
import type { RunAgentArgs } from './engine'

/** Only the fields knowledgeScope reads; the rest is noise here. */
function agentWith(journeyId: string | null): Agent {
  return { id: 'agent-1', journey_id: journeyId } as Agent
}

function argsWith(journeyId?: string): RunAgentArgs {
  return { tenantId: 't1', journeyId } as RunAgentArgs
}

describe('knowledgeScope', () => {
  it("uses the AGENT's journey, not the caller's", () => {
    // The exact reported bug. The caller passes Kalosa's journey because
    // the widget config fell back to the org-wide row; Asort's agent must
    // still read Asort's Brain.
    const asort = agentWith('journey-asort')
    const fromKalosaConfig = argsWith('journey-kalosa')

    expect(knowledgeScope(asort, fromKalosaConfig)).toBe('journey-asort')
  })

  it('returns null — never undefined — for an untrained agent', () => {
    // null is the instruction "return nothing". undefined would drop the
    // filter and hand this agent every other site the tenant owns.
    const scope = knowledgeScope(agentWith(null), argsWith('journey-kalosa'))

    expect(scope).toBeNull()
    expect(scope).not.toBeUndefined()
  })

  it('ignores the caller even when the agent has no journey', () => {
    // Tempting shortcut: fall back to args.journeyId when the agent has
    // none. That is precisely how the clinic's pages reached the fashion
    // shop, so it must stay a hard no.
    expect(knowledgeScope(agentWith(null), argsWith('journey-kalosa'))).not.toBe(
      'journey-kalosa',
    )
  })

  it('honours the caller on the legacy no-agent path', () => {
    // WhatsApp flows and older embeds run without an agent row. They are
    // scoped by the journey they were started from, and that still works.
    expect(knowledgeScope(null, argsWith('journey-legacy'))).toBe('journey-legacy')
  })

  it('leaves the legacy path unscoped when it has no journey either', () => {
    // undefined here is the honest answer: this caller never had a scope
    // to begin with. Only the agent path can promise isolation.
    expect(knowledgeScope(null, argsWith(undefined))).toBeUndefined()
  })
})

// ── The other end of the same rule ───────────────────────────────────
//
// knowledgeScope deciding "null" is worth nothing if retrieve() then
// treats null the way it used to treat undefined. This checks the
// search never even runs.

const rpc = vi.fn()
const from = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc, from }),
}))

describe('retrieve() with an explicit null scope', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  it('returns nothing and does not query at all', async () => {
    const { retrieve } = await import('./rag/retrieve')

    const chunks = await retrieve({
      tenantId: 't1',
      journeyId: null,
      query: 'what are your prices?',
    })

    expect(chunks).toEqual([])
    // Not merely "returned empty": an empty result that still ran the
    // query would start passing the moment someone reordered the guard
    // below the search.
    expect(rpc).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
})

// ── The agent's voice ────────────────────────────────────────────────
//
// Knowledge scoping decides what the agent KNOWS. This decides who it
// SOUNDS LIKE, and it leaked the same way for the same reason: the
// persona was read from the widget config's journey, and a borrowed
// config row carries another business's journey.
//
// It also silently disabled a feature. An agent trained through the
// Agents drawer saves its drafted persona to `agents.persona`; nothing
// writes a `personas` row for it. So the override was usually
// undefined and the agent ran on the generic "warm, friendly
// assistant" fallback while its real persona sat unused in the row
// right next to the flags the engine had already loaded.

describe('persona precedence', () => {
  // Mirrors engine.ts: `agent?.persona?.trim() || args.systemPromptOverride`
  const chosen = (agentPersona: string | null, override?: string) =>
    (agentPersona?.trim() || override)

  it("uses the agent's own persona over the config's", () => {
    expect(chosen('You are Aarav from Skyline Properties.', 'You are Riya from Kalosa.'))
      .toBe('You are Aarav from Skyline Properties.')
  })

  it('falls back to the override only when the agent has none', () => {
    expect(chosen(null, 'You are Riya from Kalosa.')).toBe('You are Riya from Kalosa.')
  })

  it('treats a whitespace-only persona as none', () => {
    // An empty textarea saves "" or " ", not null. Without the trim the
    // agent would run on a blank prompt and lose its personality
    // entirely — worse than the fallback it was meant to replace.
    expect(chosen('   ', 'You are Riya from Kalosa.')).toBe('You are Riya from Kalosa.')
  })

  it('leaves the legacy no-agent path alone', () => {
    expect(chosen(null, undefined)).toBeUndefined()
  })
})
