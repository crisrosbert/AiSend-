import { describe, expect, it } from 'vitest'
import { extractiveAnswer, toChunks, topChunks } from './knowledge'
import { buildProfile, sanitizeProfile } from './profile'
import { signSession, verifySession } from './session'

const pages = [
  { url: 'https://a.com/', title: 'Home', text: 'We sell handmade candles in Jaipur and ship across India within five days.\n\nOur candles use soy wax and cotton wicks for a clean burn.' },
  { url: 'https://a.com/contact', title: 'Contact', text: 'Call us on 98765 43210 or email hello@a.com. Our store is open every day from ten to eight.' },
]

describe('knowledge', () => {
  it('chunks and caps total size', () => {
    const c = toChunks(pages, 150)
    expect(c.length).toBeGreaterThan(0)
    expect(c.reduce((n, x) => n + x.text.length, 0)).toBeLessThanOrEqual(150)
  })
  it('finds the chunk that answers the question', () => {
    const c = toChunks(pages)
    expect(topChunks(c, 'how do I contact you by email?', 1)[0].url).toBe('https://a.com/contact')
    expect(topChunks(c, 'which wax do the candles use', 1)[0].url).toBe('https://a.com/')
  })
  it('extractive fallback quotes the page', () => {
    expect(extractiveAnswer(toChunks(pages), 'shipping to India')).toMatch(/ship across India/)
    expect(extractiveAnswer([], 'x')).toMatch(/contact/i)
  })
})

describe('profile', () => {
  const brand = { name: 'Aroma Co', logoUrl: 'http://x/y.png', description: null, themeColor: '#aa0000' }
  it('drafts a profile from the crawl', () => {
    const p = buildProfile(brand, [{ url: 'https://a.com/shop', title: 'Shop' }, { url: 'https://a.com/shipping', title: 'Shipping' }], 'https://a.com')
    expect(p.name).toBe('Aroma Co AI Assistant')
    expect(p.suggestions).toContain('Which products do you sell?')
    expect(p.color).toBe('#aa0000')
    expect(p.logoUrl).toBeNull() // http logos are dropped
  })
  it('sanitises edited fields', () => {
    const base = buildProfile(brand, [], 'https://a.com')
    const s = sanitizeProfile({ name: 'x'.repeat(99), tone: 'evil', color: 'red', suggestions: ['a', 5] }, base)
    expect(s.name.length).toBe(40)
    expect(s.tone).toBe('friendly')
    expect(s.color).toBe(base.color)
  })
})

describe('session', () => {
  const s = { site: 'a.com', chunks: toChunks(pages) }
  it('round-trips and rejects tampering or expiry', () => {
    const t = signSession(s, 1000)
    expect(verifySession(t, 2000)?.site).toBe('a.com')
    expect(verifySession(t.replace(/^./, (c) => (c === 'e' ? 'f' : 'e')), 2000)).toBeNull()
    expect(verifySession(t, 1000 + 3 * 60 * 60 * 1000)).toBeNull()
    expect(verifySession('nope')).toBeNull()
  })
})

import { parseDraft } from './draft'
describe('draft', () => {
  const ok = JSON.stringify({ site: 'Aroma.in', name: 'Aroma Bot', greeting: 'Hi', color: '#112233', savedAt: 1000 })
  it('reads a good draft and rejects stale or bad ones', () => {
    expect(parseDraft(ok, 2000)?.site).toBe('aroma.in')
    expect(parseDraft(ok, 1000 + 31 * 24 * 3600_000)).toBeNull()
    expect(parseDraft('{"site":"a b<script>","savedAt":1}', 2)).toBeNull()
    expect(parseDraft('not json')).toBeNull()
    expect(parseDraft(null)).toBeNull()
    expect(parseDraft(JSON.stringify({ site: 'a.com', color: 'red', savedAt: 5 }), 6)?.color).toBe('#1B6B4A')
  })
})

import { orderChunks, withinBudget } from './knowledge'
import { buildSystemPrompt } from './prompt'
import { buildProfile as bp } from './profile'

describe('full-context knowledge', () => {
  const chunks = toChunks(pages)
  it('does not cut a long paragraph off', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} about our service.`).join(' ')
    const c = toChunks([{ url: 'https://a.com/x', title: 'X', text: long }])
    expect(c.map((x) => x.text).join(' ')).toContain('Sentence number 59')
  })
  it('puts the best chunk first but keeps all of them', () => {
    const o = orderChunks(chunks, 'what is your email')
    expect(o[0].url).toBe('https://a.com/contact')
    expect(o).toHaveLength(chunks.length)
  })
  it('respects the budget by dropping what does not fit', () => {
    const o = withinBudget(chunks, 120)
    expect(o.reduce((n, x) => n + x.text.length, 0)).toBeLessThanOrEqual(120)
  })
  it('puts the facts in the prompt', () => {
    const profile = bp({ name: 'A', logoUrl: null, description: null, themeColor: null }, [], 'https://a.com')
    const p = buildSystemPrompt(profile, 'a.com', chunks, 'Phone: 98765 43210')
    expect(p).toMatch(/BUSINESS FACTS:\nPhone: 98765 43210/)
    expect(p).toMatch(/WEBSITE CONTENT/)
  })
  it('a big signed session round-trips', () => {
    const big = Array.from({ length: 40 }, (_, i) => ({ url: `https://a.com/${i}`, title: `P${i}`, text: `Paragraph ${i} `.repeat(90) }))
    const token = signSession({ site: 'a.com', chunks: big, facts: 'Phone: 1' })
    expect(token.length).toBeLessThan(150_000)
    expect(verifySession(token)?.chunks).toHaveLength(40)
    expect(verifySession(token)?.facts).toBe('Phone: 1')
    expect(verifySession(token.slice(0, -2) + 'xx')).toBeNull()
  })
})
