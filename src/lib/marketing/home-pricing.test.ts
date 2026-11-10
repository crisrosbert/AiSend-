// src/lib/marketing/home-pricing.test.ts
import { describe, it, expect } from 'vitest'
import { PLANS } from '@/lib/billing/plans'
import { MESSAGE_PRICE_INR } from '@/lib/billing/credits'
import {
  buildPricingCards,
  formatCount,
  formatRupees,
  isPlaceholderPrice,
  limitHighlights,
  messagePriceRows,
} from './home-pricing'

describe('formatting', () => {
  it('groups thousands by hand', () => {
    expect(formatCount(100)).toBe('100')
    expect(formatCount(5000)).toBe('5,000')
    expect(formatCount(1234567)).toBe('1,234,567')
  })
  it('prints rupees without rounding the real price', () => {
    expect(formatRupees(1.09)).toBe('₹1.09')
    expect(formatRupees(0.145)).toBe('₹0.145')
    expect(formatRupees(0)).toBe('Free')
  })
})

describe('placeholder detection', () => {
  it('treats ₹1 as test data, ₹0 and real prices as real', () => {
    expect(isPlaceholderPrice({ priceMonthly: 1 })).toBe(true)
    expect(isPlaceholderPrice({ priceMonthly: 0 })).toBe(false)
    expect(isPlaceholderPrice({ priceMonthly: 999 })).toBe(false)
  })
})

describe('limitHighlights', () => {
  it('writes unlimited for -1 and plain numbers otherwise', () => {
    expect(limitHighlights({ contacts: -1, broadcastsPerMonth: -1, teamMembers: 10, automations: -1 })).toEqual([
      'Unlimited contacts',
      'Unlimited broadcasts',
      '10 team members',
      'Unlimited automations',
    ])
    expect(limitHighlights({ contacts: 100, broadcastsPerMonth: 2, teamMembers: 1, automations: 2 })).toEqual([
      '100 contacts',
      '2 broadcasts per month',
      '1 team member',
      '2 automations',
    ])
  })
})

describe('buildPricingCards with the real plans', () => {
  const cards = buildPricingCards(PLANS)
  it('has one card per plan, in order', () => {
    expect(cards.map((c) => c.id)).toEqual(PLANS.map((p) => p.id))
  })
  it('shows ₹0 for the free plan', () => {
    expect(cards[0]).toMatchObject({ priceLabel: '₹0', priceKnown: true, isFree: true })
    expect(cards.filter((c) => c.isFree)).toHaveLength(1)
  })
  it('never shows a placeholder price as a real price', () => {
    for (const c of cards) {
      if (!c.priceKnown) expect(c.priceLabel).toBe('Contact us')
      expect(c.priceLabel).not.toBe('₹1')
    }
  })
  it('shows a real price once plans.ts has one', () => {
    const real = buildPricingCards([{ ...PLANS[1], priceMonthly: 999, priceYearly: 9990 }])
    expect(real[0]).toMatchObject({ priceLabel: '₹999', priceNote: 'per month', priceKnown: true })
  })
})

describe('messagePriceRows with the real per-message prices', () => {
  const rows = messagePriceRows(MESSAGE_PRICE_INR)
  it('matches credits.ts exactly', () => {
    expect(rows.map((r) => r.price)).toEqual(['₹1.09', '₹0.145', '₹0.145', 'Free'])
    expect(MESSAGE_PRICE_INR.marketing).toBe(1.09)
    expect(MESSAGE_PRICE_INR.utility).toBe(0.145)
  })
})
