import { describe, it, expect } from 'vitest'
import { extractSearchTerms, rankByTerms, termHits } from '@/lib/agent/rag/keywords'

describe('extractSearchTerms', () => {
  it('keeps the specific words from the Kalosa question', () => {
    const t = extractSearchTerms('What does gynecomastia surgery involve?')
    expect(t).toContain('gynecomastia')
    expect(t).toContain('surgery')
    expect(t).not.toContain('what')
    expect(t).not.toContain('does')
    expect(t).not.toContain('involv')
  })
  it('trims word endings so plurals and verb forms meet', () => {
    const t = extractSearchTerms('recovering from surgeries')
    expect(t).toContain('recover')
    expect(t).toContain('surgery')
  })
  it('returns only filter-safe characters', () => {
    const t = extractSearchTerms('price? (cost), "fees" 50% off')
    for (const w of t) expect(w).toMatch(/^[a-z0-9]+$/)
  })
  it('handles empty and filler-only questions', () => {
    expect(extractSearchTerms('')).toEqual([])
    expect(extractSearchTerms('what is it?')).toEqual([])
  })
  it('caps the number of terms', () => {
    expect(extractSearchTerms('alpha bravo charlie delta echo foxtrot golf hotel', 4)).toHaveLength(4)
  })
})

describe('rankByTerms', () => {
  const rows = [
    { id: 1, content: 'Our clinic is open Monday to Saturday.' },
    { id: 2, content: 'Gynecomastia surgery removes excess breast tissue through a small incision.' },
    { id: 3, content: 'Recovery after surgery usually takes a week.' },
  ]
  it('finds the FAQ that full-text AND search missed, best match first', () => {
    const terms = extractSearchTerms('What does gynecomastia surgery involve?')
    const ranked = rankByTerms(rows, terms, 5)
    expect(ranked[0].id).toBe(2)
    expect(ranked.map((r) => r.id)).toEqual([2, 3])
  })
  it('returns nothing when no term matches', () => {
    expect(rankByTerms(rows, ['parking'], 5)).toEqual([])
    expect(termHits('abc', [])).toBe(0)
  })
})
