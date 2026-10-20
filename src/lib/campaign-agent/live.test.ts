import { describe, expect, it } from 'vitest'
import { budgetFigures, cleanLink, cleanLinkText, dayProgress } from './live'

describe('live figures', () => {
  it('counts days across the follow-up waits', () => {
    const launchedAt = '2026-10-20T00:00:00.000Z'
    const waits = [48, 24]
    expect(dayProgress({ launchedAt, followupWaitHours: waits, now: new Date('2026-10-20T10:00:00Z') })).toEqual({ current: 1, total: 4 })
    expect(dayProgress({ launchedAt, followupWaitHours: waits, now: new Date('2026-10-22T10:00:00Z') })).toEqual({ current: 3, total: 4 })
    expect(dayProgress({ launchedAt, followupWaitHours: waits, now: new Date('2026-11-30T00:00:00Z') }).current).toBe(4)
    expect(dayProgress({ launchedAt, followupWaitHours: [], finished: true })).toEqual({ current: 1, total: 1 })
  })
  it('works out spend and what is left', () => {
    const b = budgetFigures(10, [4, 2], 50)
    expect(b.spent).toBeGreaterThan(0)
    expect(b.remaining).toBeCloseTo(10 - b.spent, 2)
    expect(budgetFigures(1, [1000], null).remaining).toBe(0)
  })
  it('accepts only clean https links', () => {
    expect(cleanLink('https://shop.example.com/summer')).toBe('https://shop.example.com/summer')
    expect(cleanLink('http://x.com')).toBeNull()
    expect(cleanLink('javascript:alert(1)')).toBeNull()
    expect(cleanLink('https://user:pw@x.com')).toBeNull()
    expect(cleanLinkText('  ')).toBe('Know more')
  })
})
