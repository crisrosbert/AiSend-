// src/lib/agent/tools/booking-logic.test.ts
import { describe, it, expect } from 'vitest'
import { findRequestToUpdate, namesCompatible, overlaps, pickFreeSlot, RECENT_REQUEST_MS } from './booking-logic'
import { DEFAULT_BUSINESS_HOURS, parseBusinessHours, localParts } from '@/lib/agent/business-hours'

describe('namesCompatible', () => {
  it('matches the same person written two ways', () => {
    expect(namesCompatible('Amit', 'Amit Shah')).toBe(true)
    expect(namesCompatible('amit  shah', 'Amit Shah')).toBe(true)
  })
  it('does not match a different person (booking for someone else)', () => {
    expect(namesCompatible('Amit Shah', 'Neetu')).toBe(false)
    expect(namesCompatible('Amit', 'Amitabh')).toBe(false)
  })
  it('does not match when a name is missing', () => {
    expect(namesCompatible('', 'Amit')).toBe(false)
    expect(namesCompatible(null, null)).toBe(false)
  })
})

describe('findRequestToUpdate', () => {
  const now = new Date('2026-08-12T10:00:00Z')
  const fresh = new Date(now.getTime() - 60_000).toISOString()
  const stale = new Date(now.getTime() - RECENT_REQUEST_MS - 1000).toISOString()

  it('updates a recent request for the same person', () => {
    const c = [{ id: 'a1', customer_name: 'Amit Shah', created_at: fresh }]
    expect(findRequestToUpdate(c, 'Amit Shah', now)?.id).toBe('a1')
  })
  it('creates a new request for a different person in the same chat', () => {
    const c = [{ id: 'a1', customer_name: 'Amit Shah', created_at: fresh }]
    expect(findRequestToUpdate(c, 'Neetu', now)).toBeNull()
  })
  it('treats an old request as a different booking', () => {
    const c = [{ id: 'a1', customer_name: 'Amit Shah', created_at: stale }]
    expect(findRequestToUpdate(c, 'Amit Shah', now)).toBeNull()
  })
  it('picks the newest compatible one', () => {
    const c = [
      { id: 'new', customer_name: 'Amit', created_at: fresh },
      { id: 'old', customer_name: 'Amit', created_at: fresh },
    ]
    expect(findRequestToUpdate(c, 'Amit', now)?.id).toBe('new')
  })
  it('returns null with no candidates', () => {
    expect(findRequestToUpdate([], 'Amit', now)).toBeNull()
  })
})

describe('overlaps', () => {
  it('same start overlaps', () => {
    expect(overlaps('2026-08-12T05:00:00Z', '2026-08-12T05:00:00Z', 30)).toBe(true)
  })
  it('15 minutes apart overlaps a 30 minute slot', () => {
    expect(overlaps('2026-08-12T05:00:00Z', '2026-08-12T05:15:00Z', 30)).toBe(true)
  })
  it('exactly one slot apart does not', () => {
    expect(overlaps('2026-08-12T05:00:00Z', '2026-08-12T05:30:00Z', 30)).toBe(false)
  })
  it('bad dates never overlap', () => {
    expect(overlaps('nope', '2026-08-12T05:00:00Z', 30)).toBe(false)
  })
})

describe('pickFreeSlot', () => {
  // Wednesday 2026-08-12 04:30Z = 10:00 IST, inside Mon-Fri 10-19.
  const start = '2026-08-12T04:30:00.000Z'

  it('keeps the slot when nothing is confirmed there', () => {
    expect(pickFreeSlot(start, DEFAULT_BUSINESS_HOURS, [])).toEqual({ iso: start, moved: false })
  })

  it('ignores a confirmed appointment far away', () => {
    expect(pickFreeSlot(start, DEFAULT_BUSINESS_HOURS, ['2026-08-12T08:30:00.000Z'])).toEqual({ iso: start, moved: false })
  })

  it('moves to the next slot when the requested one is confirmed', () => {
    const r = pickFreeSlot(start, DEFAULT_BUSINESS_HOURS, [start])
    expect(r).not.toBeNull()
    expect(r!.moved).toBe(true)
    expect(r!.iso).toBe('2026-08-12T05:00:00.000Z') // 10:30 IST
  })

  it('walks past several consecutive confirmed slots', () => {
    const taken = ['2026-08-12T04:30:00.000Z', '2026-08-12T05:00:00.000Z', '2026-08-12T05:30:00.000Z']
    const r = pickFreeSlot(start, DEFAULT_BUSINESS_HOURS, taken)
    expect(r!.iso).toBe('2026-08-12T06:00:00.000Z') // 11:30 IST
  })

  it('stays inside opening hours when rolling over to the next day', () => {
    const hours = parseBusinessHours({
      timezone: 'Asia/Kolkata',
      days: [null, { open: '10:00', close: '11:00' }, { open: '10:00', close: '11:00' }, { open: '10:00', close: '11:00' }, { open: '10:00', close: '11:00' }, { open: '10:00', close: '11:00' }, null],
      slotMinutes: 30,
      minLeadMinutes: 0,
    })
    // Wed 10:00 and 10:30 IST both taken -> must roll to Thu 10:00 IST, not 11:00 Wed.
    const taken = ['2026-08-12T04:30:00.000Z', '2026-08-12T05:00:00.000Z']
    const r = pickFreeSlot(start, hours, taken)
    expect(r).not.toBeNull()
    const p = localParts(new Date(r!.iso), hours.timezone)
    expect(p.weekday).toBe(4)
    expect(p.hour).toBe(10)
    expect(p.minute).toBe(0)
  })
})
