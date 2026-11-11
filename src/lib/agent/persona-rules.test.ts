// Kalosa test: "What does gynecomastia surgery involve?" was refused because
// the clinic persona said "never give medical advice ... for any medical
// question say the doctor will answer". These tests hold the new line in
// place: general information from the clinic's own knowledge is allowed,
// personal medical advice is not, emergencies still go to the phone / 112.
import { describe, it, expect } from 'vitest'
import { healthPersonaRules, finishHealthPersona, HEALTH_RULES_MARKER } from '@/lib/agent/persona-rules'
import { getTemplate } from '@/lib/agent/templates'
import { buildSafetyRules } from '@/lib/agent/safety'
import { OPERATIONAL_RULES } from '@/lib/agent/system-prompt'
import { buildQuickSetupPersona } from '@/lib/quick-setup/prompt'
import { emptyFacts } from '@/lib/quick-setup/facts'

const REFUSES_EVERYTHING = /never give medical advice|for any medical question|can'?t provide (?:specific )?details/i

describe('healthPersonaRules', () => {
  const rules = healthPersonaRules()
  it('allows general information from the knowledge base', () => {
    expect(rules).toMatch(/You MAY explain, in general terms/)
    expect(rules).toContain('search_knowledge_base')
    expect(rules).toMatch(/Do not refuse a general question/)
  })
  it('forbids personal advice, diagnosis, medicines, price guesses and result guarantees', () => {
    expect(rules).toMatch(/NEVER give personal medical advice/)
    expect(rules).toMatch(/do not diagnose/)
    expect(rules).toMatch(/suggest, start, stop or change any medicine/)
    expect(rules).toMatch(/do not guess prices/)
    expect(rules).toMatch(/Never promise or guarantee results/)
  })
  it('sends emergencies to the clinic phone or 112', () => {
    expect(healthPersonaRules()).toContain('contact the clinic directly or call 112')
    expect(healthPersonaRules('0124 4567890')).toContain('call the clinic on 0124 4567890 or 112')
  })
  it('does not contain the old blanket refusal', () => {
    expect(rules).not.toMatch(REFUSES_EVERYTHING)
  })
})

describe('Clinic Front Desk template', () => {
  const persona = getTemplate('clinic-front-desk')!.persona
  it('carries the new rules and not the old blanket refusal', () => {
    expect(persona).toContain(HEALTH_RULES_MARKER)
    expect(persona).toMatch(/You MAY explain, in general terms/)
    expect(persona).toMatch(/NEVER give personal medical advice/)
    expect(persona).not.toMatch(REFUSES_EVERYTHING)
    expect(persona).not.toContain('A&E')
    expect(persona).toContain('112')
  })
})

describe('Quick Setup clinic preset', () => {
  const persona = buildQuickSetupPersona({
    ownerText: 'Kalosa Aesthetics, cosmetic surgery clinic in Gurgaon. Consultation is free.',
    facts: { ...emptyFacts(), business_kind: 'clinic', phone: '98100 55123' },
  })
  it('allows general information and still forbids personal advice', () => {
    expect(persona).toMatch(/You MAY explain in general terms/)
    expect(persona).toContain('Give NO medical advice about the patient')
    expect(persona).toContain('call 98100 55123 or 112')
    expect(persona).not.toMatch(REFUSES_EVERYTHING)
  })
})

describe('finishHealthPersona (train-from-url output)', () => {
  const drafted = [
    'You are the assistant for Kalosa Aesthetics, a cosmetic surgery clinic in Gurgaon.',
    'Always:',
    '- Be warm and brief.',
    'Never:',
    '- Never give medical advice. For any medical question say the doctor will answer.',
    '- Never state a price, delivery time or policy that is not in your knowledge base - offer to check with the team instead.',
  ].join('\n')

  it('drops the blanket refusal lines and keeps the rest', () => {
    const out = finishHealthPersona(drafted)
    expect(out).not.toMatch(REFUSES_EVERYTHING)
    expect(out).toContain('Be warm and brief.')
    expect(out).toContain('Never state a price')
  })
  it('adds the standard block once, with the clinic phone', () => {
    const out = finishHealthPersona(drafted, { phone: '0124 4567890' })
    expect(out).toContain(HEALTH_RULES_MARKER)
    expect(out).toContain('0124 4567890')
    expect(out.split(HEALTH_RULES_MARKER)).toHaveLength(2)
  })
  it('is idempotent', () => {
    const once = finishHealthPersona(drafted)
    expect(finishHealthPersona(once)).toBe(once)
  })
  it('leaves an empty draft empty (a failed draft must not replace the owner\'s text)', () => {
    expect(finishHealthPersona('')).toBe('')
    expect(finishHealthPersona('   ')).toBe('')
  })
})

describe('engine-level rules agree with the persona', () => {
  const health = buildSafetyRules({ healthContext: true })
  it('safety.ts allows general information and still blocks diagnosis', () => {
    expect(health).toContain('General information is allowed and expected')
    expect(health).toContain('Do not diagnose')
    expect(health).toContain('outranks any persona line')
  })
  it('a non-health business does not get the medical block', () => {
    expect(buildSafetyRules({ healthContext: false })).not.toContain('General information is allowed')
  })
  it('system-prompt.ts has no blanket medical refusal', () => {
    expect(OPERATIONAL_RULES).not.toMatch(REFUSES_EVERYTHING)
  })
})
