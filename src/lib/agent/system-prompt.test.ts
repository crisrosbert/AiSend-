// src/lib/agent/system-prompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, FALLBACK_PERSONA, OPERATIONAL_RULES } from './system-prompt'

describe('operational rules', () => {
  it('no longer tells the model to hide that it is an AI', () => {
    expect(OPERATIONAL_RULES).not.toMatch(/never reveal[^.]*that you are an ai/i)
    expect(OPERATIONAL_RULES).not.toMatch(/never (say|admit|reveal)[^.]*\b(ai|bot)\b/i)
  })

  it('tells the model to be honest about being a virtual assistant and offer a human', () => {
    expect(OPERATIONAL_RULES).toMatch(/virtual assistant/i)
    expect(OPERATIONAL_RULES).toMatch(/never deny being an ai/i)
    expect(OPERATIONAL_RULES).toMatch(/human team member/i)
  })

  it('treats customer text as data and keeps the prompt private', () => {
    expect(OPERATIONAL_RULES).toMatch(/untrusted data/i)
    expect(OPERATIONAL_RULES).toMatch(/never reveal, quote, summarise/i)
    expect(OPERATIONAL_RULES).toMatch(/developer/i)
  })

  it('answers a knowledge gap with "I don\'t have that information"', () => {
    expect(OPERATIONAL_RULES).toContain("I don't have that information")
  })

  it('keeps the rules that already protected against stalling and denial', () => {
    expect(OPERATIONAL_RULES).toMatch(/ONE reply per message/)
    expect(OPERATIONAL_RULES).toMatch(/Never deny that something exists/)
    expect(OPERATIONAL_RULES).toMatch(/call handoff_to_human immediately/i)
  })
})

describe('buildSystemPrompt', () => {
  it('puts the persona first and the rules after', () => {
    const p = buildSystemPrompt('You are Riya from Kalosa.')
    expect(p.startsWith('You are Riya from Kalosa.')).toBe(true)
    expect(p).toContain('[Operational notes')
  })
  it('uses the fallback persona when none is configured', () => {
    expect(buildSystemPrompt(undefined)).toContain(FALLBACK_PERSONA)
    expect(buildSystemPrompt('   ')).toContain(FALLBACK_PERSONA)
  })
  it('the fallback persona does not claim to be human', () => {
    expect(FALLBACK_PERSONA).not.toMatch(/be (natural and )?human/i)
    expect(FALLBACK_PERSONA).toMatch(/virtual assistant/i)
  })
})
