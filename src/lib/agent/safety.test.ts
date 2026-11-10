// src/lib/agent/safety.test.ts
import { describe, it, expect } from 'vitest'
import { buildSafetyRules, detectEmergency, emergencyHandoffReason, isHealthContext } from './safety'

describe('isHealthContext', () => {
  it('recognises clinics and surgery from industry, name or persona', () => {
    expect(isHealthContext(['Surgery clinic', null])).toBe(true)
    expect(isHealthContext([null, 'Kalosa aesthetics'])).toBe(true)
    expect(isHealthContext(['You are Riya, the receptionist at a dental clinic.'])).toBe(true)
  })
  it('does not treat shops and agencies as health', () => {
    expect(isHealthContext(['Fashion', 'Asort', 'You help customers pick skin-friendly cotton shirts'])).toBe(false)
    expect(isHealthContext(['Real estate', 'Skyline Properties'])).toBe(false)
    expect(isHealthContext([null, undefined])).toBe(false)
  })
})

describe('buildSafetyRules', () => {
  it('always has the generic rules', () => {
    const r = buildSafetyRules({ healthContext: false })
    expect(r).toContain('Never guarantee')
    expect(r).toContain('Never invent prices')
    expect(r).toContain('112')
    expect(r).toContain('Aadhaar')
    expect(r).toContain('investment advice')
  })
  it('adds the medical rules only for health businesses', () => {
    const generic = buildSafetyRules({ healthContext: false })
    const health = buildSafetyRules({ healthContext: true })
    expect(generic).not.toContain('Do not diagnose')
    expect(health).toContain('Do not diagnose')
    expect(health).toContain('dosage')
    expect(health).toContain('pregnancy')
  })
  it('appends business rules without dropping the base rules', () => {
    const r = buildSafetyRules({ healthContext: false, customRules: 'Never quote EMI.' })
    expect(r).toContain('Never quote EMI.')
    expect(r).toContain('Never guarantee')
  })
  it('names itself so a leak of the block is detectable', () => {
    expect(buildSafetyRules({ healthContext: false }).toLowerCase()).toContain('[safety rules')
  })
})

describe('detectEmergency — universal', () => {
  const yes = [
    "I can't breathe",
    'having chest pain right now',
    'he is unconscious',
    'heavy bleeding wont stop',
    'bleeding will not stop',
    'saans nahi aa rahi',
    'seene mein dard ho raha hai',
    'khoon nahi ruk raha',
    'मुझे सांस नहीं आ रही',
    'बहुत खून बह रहा है',
  ]
  for (const s of yes) {
    it(`flags without health context: ${s}`, () => {
      expect(detectEmergency(s, { healthContext: false }).matched).toBe(true)
    })
  }

  it("does not read \"Can't breathe?\" as a hypothetical question", () => {
    expect(detectEmergency("Can't breathe properly, help?", { healthContext: false }).matched).toBe(true)
  })

  it('ignores ordinary shop and property talk', () => {
    expect(detectEmergency('This shirt colour is bleeding in the wash', { healthContext: false }).matched).toBe(false)
    expect(detectEmergency('What is the price of a 2BHK?', { healthContext: false }).matched).toBe(false)
  })
})

describe('detectEmergency — health business', () => {
  const ctx = { healthContext: true }
  const yes = [
    'I am bleeding a lot after my surgery',
    'I have severe pain after the procedure',
    'fever after surgery since last night',
    'my stitches are swollen and there is pus',
    'mujhe bahut dard ho raha hai',
    'operation ke baad bleeding ho rahi hai',
    'मुझे बहुत दर्द हो रहा है',
    'सर्जरी के बाद बुखार है',
  ]
  for (const s of yes) {
    it(`flags: ${s}`, () => expect(detectEmergency(s, ctx).matched).toBe(true))
  }

  const no = [
    'How much does gynecomastia surgery cost?',
    'Will there be bleeding during the surgery?',
    'Is there severe pain after liposuction?',
    'What is the recovery time after surgery?',
    'I have a question about pain management',
    'Do you treat fever or infections?',
    'Hi, I want to book a consultation tomorrow',
    'ऑपरेशन की कीमत क्या है?',
  ]
  for (const s of no) {
    it(`does not flag: ${s}`, () => expect(detectEmergency(s, ctx).matched).toBe(false))
  }

  it('does not apply the post-procedure tier to a non-health business', () => {
    expect(detectEmergency('I have pain after my purchase', { healthContext: false }).matched).toBe(false)
  })

  it('empty text is not an emergency', () => {
    expect(detectEmergency('', ctx).matched).toBe(false)
  })
})

describe('emergencyHandoffReason', () => {
  it('starts with URGENT so the inbox shows it first', () => {
    expect(emergencyHandoffReason('bleeding')).toMatch(/^URGENT/)
    expect(emergencyHandoffReason()).toMatch(/^URGENT/)
  })
})
