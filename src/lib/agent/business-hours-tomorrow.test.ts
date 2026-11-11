// Kalosa live test: Wed 11 Nov 2026 20:28 IST, "Can I come tomorrow at 6 pm?"
// Fixed clock, so the result does not depend on the server time zone.
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_BUSINESS_HOURS,
  describeHoursForPrompt,
  resolveSlot,
  nextOpenSlot,
  localParts,
  parseBusinessHours,
} from '@/lib/agent/business-hours'

const NOW = new Date('2026-11-11T14:58:00Z') // 20:28 IST, Wednesday
const H = DEFAULT_BUSINESS_HOURS

describe('Kalosa case: asking for tomorrow 6 pm at 8:28 pm', () => {
  it('the clock reads Wednesday 20:28 in Kolkata', () => {
    const p = localParts(NOW, 'Asia/Kolkata')
    expect(p.weekday).toBe(3)
    expect(p.hour).toBe(20)
    expect(p.minute).toBe(28)
  })

  it('earliest slot is Thursday 12/11 10:00 IST (tomorrow)', () => {
    const next = nextOpenSlot(NOW, H)!
    expect(next.toISOString()).toBe('2026-11-12T04:30:00.000Z')
  })

  it('"tomorrow at 6 pm" is accepted as is (Thursday 18:00 IST)', () => {
    const r = resolveSlot('tomorrow at 6 pm', H, NOW)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.adjusted).toBe(false)
      expect(r.iso).toBe('2026-11-12T12:30:00.000Z')
      expect(r.label).toBe('Thursday 12/11 at 6 PM')
    }
  })

  it.each(['tomorrow 6pm', 'tomorrow 18:00', 'kal 6 pm', 'Thursday 6 pm', 'tmrw at 6.00 pm'])('%s resolves to Thursday 6 PM', (txt) => {
    const r = resolveSlot(txt, H, NOW)
    expect(r.ok && r.iso).toBe('2026-11-12T12:30:00.000Z')
  })

  it('the same answer when the server clock zone is not IST (uses the instant only)', () => {
    const r = resolveSlot('tomorrow at 6 pm', H, new Date('2026-11-11T14:58:00+00:00'))
    expect(r.ok && r.adjusted).toBe(false)
  })

  it('6:30 pm is the last slot that fits before 7 pm close; 6:45 pm is moved', () => {
    const ok = resolveSlot('tomorrow 6:30 pm', H, NOW)
    expect(ok.ok && ok.adjusted).toBe(false)
    const late = resolveSlot('tomorrow 7 pm', H, NOW)
    expect(late.ok && late.adjusted).toBe(true)
  })

  it('prompt block says "closed right now" but also tells the model that tomorrow is open', () => {
    const block = describeHoursForPrompt(H, NOW)
    expect(block).toContain('CLOSED right now')
    expect(block).toContain('Tomorrow is Thursday 12/11')
    expect(block).toContain('open 10 AM to 7 PM')
    expect(block).toMatch(/closed right now does not mean/i)
  })

  it('prompt block still has the old lines (no regression)', () => {
    const block = describeHoursForPrompt(H, NOW)
    expect(block).toContain('[Current time')
    expect(block).toContain('Weekly hours:')
    expect(block).toContain('Earliest appointment you may offer: Thursday 12/11 at 10 AM.')
  })

  it('Sunday is closed so tomorrow (Sunday) is stated as closed', () => {
    const sat = new Date('2026-11-14T08:00:00Z') // Saturday 13:30 IST
    const block = describeHoursForPrompt(H, sat)
    expect(block).toContain('Tomorrow is Sunday 15/11: closed all day')
  })

  it('saved hours in dashboard shape parse to the same values', () => {
    const saved = { timezone: 'Asia/Kolkata', slotMinutes: 30, minLeadMinutes: 60, days: [null,
      { open: '10:00', close: '19:00' }, { open: '10:00', close: '19:00' }, { open: '10:00', close: '19:00' },
      { open: '10:00', close: '19:00' }, { open: '10:00', close: '19:00' }, { open: '10:00', close: '17:00' }] }
    expect(parseBusinessHours(saved)).toEqual(H)
    expect(parseBusinessHours(JSON.stringify(saved))).toEqual(H)
  })
})
