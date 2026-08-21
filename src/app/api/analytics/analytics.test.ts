// src/app/api/analytics/analytics.test.ts
//
// Analytics is the one screen where a bug does not announce itself. A
// broken chart still draws a line; a miscounted funnel still renders
// four neat bars. Nobody files a ticket — they just make a decision on
// a number that was never true.
//
// These cover the arithmetic that has somewhere to hide.

import { describe, it, expect } from 'vitest'
import { rollUpFunnel, eachDay, median, dayKey } from './route'

describe('rollUpFunnel', () => {
  it('counts each stage cumulatively', () => {
    // Statuses are terminal in the database: a row that was read says
    // 'read', never 'sent' AND 'delivered' AND 'read'. Counting them
    // literally would draw delivered < read — impossible, and it reads
    // as a bug in the product rather than in the chart.
    const out = rollUpFunnel(['sent', 'delivered', 'read', 'replied'])

    expect(out.sent).toBe(4)
    expect(out.delivered).toBe(3)
    expect(out.read).toBe(2)
    expect(out.replied).toBe(1)
  })

  it('never lets a later stage exceed an earlier one', () => {
    // The invariant, stated directly. Any future status added to the
    // arrays above without thought will break this.
    const out = rollUpFunnel([
      'replied', 'replied', 'read', 'delivered', 'sent', 'read', 'replied',
    ])

    expect(out.sent).toBeGreaterThanOrEqual(out.delivered)
    expect(out.delivered).toBeGreaterThanOrEqual(out.read)
    expect(out.read).toBeGreaterThanOrEqual(out.replied)
  })

  it('keeps failures out of the funnel entirely', () => {
    // A failed send never reached a handset, so counting it as "sent"
    // would inflate the denominator and quietly depress every rate
    // below it — the delivery rate would look worse the more numbers
    // were invalid, which is backwards.
    const out = rollUpFunnel(['failed', 'failed', 'delivered'])

    expect(out.failed).toBe(2)
    expect(out.sent).toBe(1)
    expect(out.delivered).toBe(1)
  })

  it('ignores statuses it does not recognise', () => {
    // 'pending' and 'queued' exist mid-send. Counting them as sent
    // would make a campaign look complete while it is still going out.
    const out = rollUpFunnel(['pending', 'queued', 'delivered'])

    expect(out.sent).toBe(1)
    expect(out.delivered).toBe(1)
  })

  it('returns all zeros for an empty campaign', () => {
    expect(rollUpFunnel([])).toEqual({
      sent: 0, delivered: 0, read: 0, replied: 0, failed: 0,
    })
  })
})

describe('eachDay', () => {
  it('includes both ends of the range', () => {
    const days = eachDay(new Date('2026-08-14T00:00:00Z'), new Date('2026-08-21T23:59:59Z'))

    expect(days[0]).toBe('2026-08-14')
    expect(days[days.length - 1]).toBe('2026-08-21')
    expect(days).toHaveLength(8)
  })

  it('emits a bucket for a single-day range', () => {
    const days = eachDay(new Date('2026-08-21T09:00:00Z'), new Date('2026-08-21T18:00:00Z'))
    expect(days).toEqual(['2026-08-21'])
  })

  it('crosses a month boundary', () => {
    const days = eachDay(new Date('2026-07-30T00:00:00Z'), new Date('2026-08-02T00:00:00Z'))
    expect(days).toEqual(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02'])
  })

  it('crosses a leap day', () => {
    // Off-by-one territory, and it only breaks once every four years —
    // which is exactly long enough for nobody to remember why.
    const days = eachDay(new Date('2028-02-27T00:00:00Z'), new Date('2028-03-01T00:00:00Z'))
    expect(days).toEqual(['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01'])
  })

  it('produces every day so a quiet day is a zero, not a gap', () => {
    // The chart draws straight from point to point. A missing Sunday
    // would join Saturday to Monday and hide the drop entirely.
    const days = eachDay(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-31T00:00:00Z'))
    expect(days).toHaveLength(31)
  })
})

describe('median', () => {
  it('is null when nothing was measured', () => {
    // Distinct from 0. Zero seconds would claim instant replies; null
    // renders as "—", which is the truth.
    expect(median([])).toBeNull()
  })

  it('takes the middle of an odd-length set', () => {
    expect(median([5, 1, 3])).toBe(3)
  })

  it('averages the two middles of an even-length set', () => {
    expect(median([1, 2, 3, 4])).toBe(3) // (2+3)/2 = 2.5, rounded
  })

  it('resists the outlier that would wreck a mean', () => {
    // One conversation answered the next morning should not turn a
    // 30-second median into a nine-minute average. This is exactly why
    // the figure on the page is a median.
    const withOutlier = [30, 32, 28, 31, 29, 3600]
    expect(median(withOutlier)).toBeLessThan(60)
  })
})

describe('dayKey', () => {
  it('buckets a timestamp by its UTC date', () => {
    expect(dayKey('2026-08-21T18:45:03.221Z')).toBe('2026-08-21')
  })

  it('matches the format eachDay produces', () => {
    // These two must agree or every bucket lookup misses and the chart
    // silently flatlines at zero while the totals look right.
    const [first] = eachDay(new Date('2026-08-21T00:00:00Z'), new Date('2026-08-21T00:00:00Z'))
    expect(dayKey('2026-08-21T13:00:00Z')).toBe(first)
  })
})
