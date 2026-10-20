import { describe, expect, it } from 'vitest'
import { checkBody, extractJson, fallbackPlan, templateName, validatePlan } from './plan'

describe('checkBody', () => {
  it('flags variable placement and unknown variables', () => {
    expect(checkBody('{{1}} we have an offer for you today')).toContain('A message cannot start with a variable. Add a greeting before {{1}}.')
    expect(checkBody('Hi there, great offer for you now {{1}}')).toContain('A message cannot end with a variable.')
    expect(checkBody('Hi {{1}}, offer {{2}} just for you today')).toContain('Only {{1}} (customer name) can be used as a variable.')
    expect(checkBody('Hi {{1}}, flat 20% off on every pair till Sunday.')).toEqual([])
  })
})

describe('validatePlan', () => {
  it('repairs a leading variable and clamps follow-up timing', () => {
    const r = validatePlan({
      name: 'Diwali',
      variants: [{ label: 'A', body: '{{1}}, flat 20% off on every pair till Sunday night.' }],
      followups: [{ label: 'R', waitHours: 99999, rule: 'weird', body: 'Hi {{1}}, last day of the sale is tomorrow.' }],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.plan.variants[0].body.startsWith('Hi {{1}}')).toBe(true)
      expect(r.plan.followups[0].waitHours).toBe(24 * 14)
      expect(r.plan.followups[0].rule).toBe('no_reply')
    }
  })
  it('caps variants and follow-ups, drops unusable ones', () => {
    const body = 'Hi {{1}}, flat 20% off on every pair till Sunday night.'
    const r = validatePlan({ variants: Array(5).fill({ body }), followups: [{ body: 'x' }, { body }, { body }, { body }] })
    expect(r.ok && r.plan.variants.length).toBe(3)
    expect(r.ok && r.plan.followups.length).toBe(1)
  })
  it('rejects garbage', () => {
    expect(validatePlan(null).ok).toBe(false)
    expect(validatePlan({ variants: [{ body: 'hi' }] }).ok).toBe(false)
  })
})

describe('extractJson', () => {
  it('reads fenced and wrapped JSON', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('Here you go: {"a":2} thanks')).toEqual({ a: 2 })
    expect(extractJson('no json')).toBeNull()
  })
})

describe('fallbackPlan / templateName', () => {
  it('produces a valid plan', () => {
    const p = fallbackPlan('Diwali sale 20% off till Sunday')
    expect(validatePlan(p).ok).toBe(true)
  })
  it('makes Meta-safe names', () => {
    expect(templateName('ABCD-1234-ef', 'v', 1)).toMatch(/^[a-z0-9_]+$/)
  })
})
