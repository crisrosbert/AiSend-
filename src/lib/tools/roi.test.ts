import { describe, expect, it } from 'vitest'
import {
  CHANNEL_IDS,
  DEFAULT_SETUP,
  EXAMPLE_SETUPS,
  breakEvenConversion,
  calculateChannel,
  compare,
  sanitizeChannel,
  sanitizeShared,
  type ChannelInputs,
  type SharedInputs,
} from './roi'

const SHARED: SharedInputs = { contacts: 1000, campaignsPerMonth: 2, orderValue: 1000, marginPercent: 40 }
const CHANNEL: ChannelInputs = {
  costPerMessage: 1,
  chargedOn: 'sent',
  deliveryPercent: 90,
  responsePercent: 10,
  conversionPercent: 5,
  fixedMonthlyCost: 500,
}

describe('sanitize', () => {
  it('turns negatives, NaN and Infinity into 0', () => {
    expect(sanitizeShared({ contacts: -5, campaignsPerMonth: Number.NaN, orderValue: Infinity, marginPercent: -1 })).toEqual({
      contacts: 0,
      campaignsPerMonth: 0,
      orderValue: 0,
      marginPercent: 0,
    })
  })

  it('keeps whole numbers of contacts and campaigns', () => {
    const s = sanitizeShared({ ...SHARED, contacts: 1234.9, campaignsPerMonth: 2.6 })
    expect(s.contacts).toBe(1234)
    expect(s.campaignsPerMonth).toBe(2)
  })

  it('holds percentages between 0 and 100', () => {
    const c = sanitizeChannel({ ...CHANNEL, deliveryPercent: 140, responsePercent: -3, conversionPercent: 100.5 })
    expect(c.deliveryPercent).toBe(100)
    expect(c.responsePercent).toBe(0)
    expect(c.conversionPercent).toBe(100)
  })

  it('never lets money go below zero', () => {
    const c = sanitizeChannel({ ...CHANNEL, costPerMessage: -2, fixedMonthlyCost: -100 })
    expect(c.costPerMessage).toBe(0)
    expect(c.fixedMonthlyCost).toBe(0)
  })

  it('falls back to charging on messages sent when the choice is not valid', () => {
    expect(sanitizeChannel({ ...CHANNEL, chargedOn: 'nonsense' as never }).chargedOn).toBe('sent')
  })
})

describe('very large numbers', () => {
  it('keep every result finite, however large the numbers typed in', () => {
    const huge = { contacts: 1e308, campaignsPerMonth: 1e308, orderValue: 1e308, marginPercent: 100 }
    const chan = { ...CHANNEL, costPerMessage: 1e308, fixedMonthlyCost: 1e308 }
    const c = compare(huge, { whatsapp: chan, sms: chan, email: chan })
    for (const id of CHANNEL_IDS) {
      for (const v of Object.values(c.results[id])) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
      expect(Number.isFinite(breakEvenConversion(huge, chan) ?? 0)).toBe(true)
    }
  })

  it('leave ordinary numbers alone', () => {
    expect(sanitizeShared({ contacts: 250_000_000, campaignsPerMonth: 30, orderValue: 5_000_000, marginPercent: 40 }).contacts).toBe(250_000_000)
  })
})

describe('calculateChannel', () => {
  it('follows the chain from messages to profit', () => {
    const r = calculateChannel(SHARED, CHANNEL)
    expect(r.messages).toBe(2000)
    expect(r.delivered).toBe(1800)
    expect(r.responses).toBe(180)
    expect(r.orders).toBe(9)
    expect(r.revenue).toBe(9000)
    expect(r.grossProfit).toBe(3600)
    expect(r.cost).toBe(2500)
    expect(r.netProfit).toBe(1100)
    expect(r.roiPercent).toBeCloseTo(44, 6)
    expect(r.roas).toBeCloseTo(3.6, 6)
    expect(r.costPerOrder).toBeCloseTo(277.7778, 3)
  })

  it('can charge for messages delivered instead of sent', () => {
    const r = calculateChannel(SHARED, { ...CHANNEL, chargedOn: 'delivered' })
    expect(r.cost).toBe(1800 + 500)
    expect(r.netProfit).toBe(3600 - 2300)
  })

  it('reports a loss as a negative return', () => {
    const r = calculateChannel(SHARED, { ...CHANNEL, conversionPercent: 1 })
    expect(r.netProfit).toBeLessThan(0)
    expect(r.roiPercent).toBeLessThan(0)
  })

  it('has no return or return on spend when nothing was spent', () => {
    const r = calculateChannel(SHARED, { ...CHANNEL, costPerMessage: 0, fixedMonthlyCost: 0 })
    expect(r.cost).toBe(0)
    expect(r.roiPercent).toBeNull()
    expect(r.roas).toBeNull()
  })

  it('has no cost per order when there were no orders', () => {
    const r = calculateChannel(SHARED, { ...CHANNEL, conversionPercent: 0 })
    expect(r.orders).toBe(0)
    expect(r.costPerOrder).toBeNull()
    expect(r.roiPercent).toBe(-100)
  })

  it('treats a bad input as zero instead of returning NaN', () => {
    const r = calculateChannel({ ...SHARED, contacts: Number.NaN }, CHANNEL)
    for (const v of Object.values(r)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
  })
})

describe('compare', () => {
  const shared: SharedInputs = { contacts: 1000, campaignsPerMonth: 1, orderValue: 1000, marginPercent: 100 }
  const channels = {
    whatsapp: { costPerMessage: 1, chargedOn: 'sent', deliveryPercent: 100, responsePercent: 20, conversionPercent: 10, fixedMonthlyCost: 0 },
    sms: { costPerMessage: 0.5, chargedOn: 'sent', deliveryPercent: 100, responsePercent: 10, conversionPercent: 12, fixedMonthlyCost: 0 },
    email: { costPerMessage: 0.01, chargedOn: 'sent', deliveryPercent: 100, responsePercent: 1, conversionPercent: 10, fixedMonthlyCost: 0 },
  } as const

  it('calculates every channel', () => {
    const c = compare(shared, channels)
    expect(CHANNEL_IDS.every((id) => c.results[id])).toBe(true)
    expect(c.results.whatsapp.netProfit).toBe(19000)
    expect(c.results.sms.netProfit).toBe(11500)
    expect(c.results.email.netProfit).toBe(990)
  })

  it('names the best channel for return and the best for profit separately', () => {
    const c = compare(shared, channels)
    expect(c.bestByRoi).toBe('email')
    expect(c.bestByNetProfit).toBe('whatsapp')
  })

  it('names nobody when nothing earns anything', () => {
    const none = compare({ ...shared, orderValue: 0 }, channels)
    expect(none.bestByRoi).toBeNull()
    expect(none.bestByNetProfit).toBeNull()
  })

  it('gives a tie to the first channel in the list', () => {
    const same = compare(shared, { whatsapp: channels.sms, sms: channels.sms, email: channels.sms })
    expect(same.bestByRoi).toBe('whatsapp')
    expect(same.bestByNetProfit).toBe('whatsapp')
  })

  it('ignores a channel that has no return figure when picking the best return', () => {
    const free = { ...channels.email, costPerMessage: 0 }
    const c = compare(shared, { ...channels, email: free })
    expect(c.results.email.roiPercent).toBeNull()
    expect(c.bestByRoi).toBe('sms')
  })
})

describe('breakEvenConversion', () => {
  it('is the conversion rate where profit just covers the cost', () => {
    // cost 2500, 180 responses, 1000 x 40% = 400 profit per order
    expect(breakEvenConversion(SHARED, CHANNEL)).toBeCloseTo((2500 / (180 * 400)) * 100, 6)
  })

  it('lands on zero profit when used as the conversion rate', () => {
    const rate = breakEvenConversion(SHARED, CHANNEL)!
    const r = calculateChannel(SHARED, { ...CHANNEL, conversionPercent: rate })
    expect(r.netProfit).toBeCloseTo(0, 6)
  })

  it('is null when nobody responds or an order earns nothing', () => {
    expect(breakEvenConversion(SHARED, { ...CHANNEL, responsePercent: 0 })).toBeNull()
    expect(breakEvenConversion({ ...SHARED, marginPercent: 0 }, CHANNEL)).toBeNull()
  })

  it('is null when there is nothing to recover', () => {
    expect(breakEvenConversion(SHARED, { ...CHANNEL, costPerMessage: 0, fixedMonthlyCost: 0 })).toBeNull()
  })
})

describe('example setups', () => {
  it('has a default and several named examples with unique ids', () => {
    expect(DEFAULT_SETUP.shared.contacts).toBeGreaterThan(0)
    expect(EXAMPLE_SETUPS.length).toBeGreaterThanOrEqual(4)
    const ids = EXAMPLE_SETUPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const setup of EXAMPLE_SETUPS) {
    it(`${setup.id} produces finite numbers for every channel`, () => {
      const c = compare(setup.shared, setup.channels)
      for (const id of CHANNEL_IDS) {
        const r = c.results[id]
        expect(r.cost).toBeGreaterThan(0)
        for (const v of Object.values(r)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
      }
    })
  }
})
