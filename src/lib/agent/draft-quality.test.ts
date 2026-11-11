import { describe, it, expect } from 'vitest'
import {
  hostStem, isDomainLikeName, recoverSpacedName, titleBrand, chooseBrandName,
  replaceDomainSpelling, normaliseDraft,
} from '@/lib/agent/draft-quality'

const HOST = 'www.kalosaaesthetics.com'
const ctx = {
  host: HOST,
  titles: ['Kalosa Aesthetics | Cosmetic Surgery in Gurgaon', 'Gynecomastia Surgery - Kalosa Aesthetics'],
  bodies: ['Welcome to Kalosa Aesthetics, a cosmetic surgery clinic in Gurgaon. Kalosa Aesthetics offers gynecomastia surgery.'],
}

describe('hostStem', () => {
  it.each([
    ['www.kalosaaesthetics.com', 'kalosaaesthetics'],
    ['kalosaaesthetics.com', 'kalosaaesthetics'],
    ['https://www.kalosaaesthetics.com/about', 'kalosaaesthetics'],
    ['shop.abc.co.in', 'abc'],
    ['hudle.in', 'hudle'],
    ['localhost', 'localhost'],
  ])('%s', (h, stem) => expect(hostStem(h)).toBe(stem))
})

describe('isDomainLikeName', () => {
  it('flags the Kalosa case', () => {
    expect(isDomainLikeName('kalosaaesthetics', HOST)).toBe(true)
    expect(isDomainLikeName('Kalosaaesthetics', HOST)).toBe(true)
    expect(isDomainLikeName('kalosaaesthetics.com', HOST)).toBe(true)
    expect(isDomainLikeName('www.kalosaaesthetics.com', HOST)).toBe(true)
  })
  it('does not flag real names', () => {
    expect(isDomainLikeName('Kalosa Aesthetics', HOST)).toBe(false)
    expect(isDomainLikeName('KalosaAesthetics', HOST)).toBe(false)
    expect(isDomainLikeName('Hudle Sports', 'hudle.in')).toBe(false)
    expect(isDomainLikeName('', HOST)).toBe(false)
    expect(isDomainLikeName(null, HOST)).toBe(false)
  })
})

describe('recoverSpacedName', () => {
  it('finds "Kalosa Aesthetics" in the page text', () => {
    expect(recoverSpacedName('kalosaaesthetics', ctx.titles)).toBe('Kalosa Aesthetics')
    expect(recoverSpacedName('kalosaaesthetics', ctx.bodies)).toBe('Kalosa Aesthetics')
  })
  it('returns null when the pages never write it spaced', () => {
    expect(recoverSpacedName('kalosaaesthetics', ['Cosmetic surgery in Gurgaon'])).toBeNull()
  })
  it('title-cases an all-lower-case match', () => {
    expect(recoverSpacedName('kalosaaesthetics', ['visit kalosa aesthetics today'])).toBe('Kalosa Aesthetics')
  })
})

describe('titleBrand', () => {
  it('takes the part before the separator', () => {
    expect(titleBrand('Kalosa Aesthetics | Cosmetic Surgery in Gurgaon')).toBe('Kalosa Aesthetics')
    expect(titleBrand('Kalosa Aesthetics - Home')).toBe('Kalosa Aesthetics')
    expect(titleBrand('')).toBeNull()
  })
})

describe('chooseBrandName', () => {
  it('repairs a domain-style name from the site text', () => {
    expect(chooseBrandName(['kalosaaesthetics', 'kalosaaesthetics'], ctx)).toBe('Kalosa Aesthetics')
  })
  it('keeps a good name from metadata', () => {
    expect(chooseBrandName(['Kalosa Aesthetics', 'kalosaaesthetics'], ctx)).toBe('Kalosa Aesthetics')
  })
  it('skips a domain-style first candidate for a good second one', () => {
    expect(chooseBrandName(['kalosaaesthetics.com', 'Kalosa Aesthetics Clinic'], { host: HOST, titles: [], bodies: [] })).toBe('Kalosa Aesthetics Clinic')
  })
  it('falls back to the page title brand', () => {
    expect(chooseBrandName([null, null], ctx)).toBe('Kalosa Aesthetics')
  })
  it('leaves the original when nothing better exists (never invents)', () => {
    expect(chooseBrandName(['kalosaaesthetics'], { host: HOST, titles: [], bodies: [] })).toBe('kalosaaesthetics')
  })
})

describe('replaceDomainSpelling', () => {
  it('fixes the exact Kalosa greeting', () => {
    expect(replaceDomainSpelling('Welcome to kalosaaesthetics! How can I help you today?', 'Kalosa Aesthetics', HOST))
      .toBe('Welcome to Kalosa Aesthetics! How can I help you today?')
  })
  it('replaces address forms', () => {
    expect(replaceDomainSpelling('Visit www.kalosaaesthetics.com or kalosaaesthetics.com/contact', 'Kalosa Aesthetics', HOST))
      .toBe('Visit Kalosa Aesthetics or Kalosa Aesthetics')
  })
  it('does not touch a correct name twice', () => {
    expect(replaceDomainSpelling('Welcome to Kalosa Aesthetics', 'Kalosa Aesthetics', HOST)).toBe('Welcome to Kalosa Aesthetics')
  })
  it('passes null through and ignores an empty brand', () => {
    expect(replaceDomainSpelling(null, 'X Y', HOST)).toBeNull()
    expect(replaceDomainSpelling('hello kalosaaesthetics', null, HOST)).toBe('hello kalosaaesthetics')
  })
})

describe('normaliseDraft: the Kalosa draft', () => {
  const facts = {
    business_name: 'kalosaaesthetics',
    what_they_do: 'Cosmetic surgery clinic',
    greeting: 'Welcome to kalosaaesthetics. How can I help?',
    suggested_questions: ['What does kalosaaesthetics offer?', 'How do I book?', 'Where are you?'],
    role: 'Chat agent for cosmetic surgery inquiries',
  }
  const out = normaliseDraft(facts, { name: 'kalosaaesthetics', logoUrl: null }, 'You are the assistant for kalosaaesthetics.', ctx)

  it('uses the written brand name everywhere', () => {
    expect(out.brand.name).toBe('Kalosa Aesthetics')
    expect(out.facts.business_name).toBe('Kalosa Aesthetics')
    expect(out.facts.greeting).toBe('Welcome to Kalosa Aesthetics. How can I help?')
    expect(out.facts.suggested_questions[0]).toBe('What does Kalosa Aesthetics offer?')
    expect(out.persona).toBe('You are the assistant for Kalosa Aesthetics.')
  })
  it('keeps the other fields and does not change its input', () => {
    expect(out.facts.role).toBe('Chat agent for cosmetic surgery inquiries')
    expect(facts.greeting).toContain('kalosaaesthetics')
  })
})
