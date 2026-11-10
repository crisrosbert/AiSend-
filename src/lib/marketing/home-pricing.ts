// src/lib/marketing/home-pricing.ts
//
// Turns the real plan list (src/lib/billing/plans.ts) and the real
// per-message prices (src/lib/billing/credits.ts) into what the home page
// pricing section shows.
//
// Rule: show only what is certain.
//  - A plan whose monthly price is a few rupees is treated as TEST DATA,
//    not a real price (plans.ts has a TODO saying Starter and Growth are
//    both ₹1 as placeholders). Those plans show "Contact us" instead of a
//    price. The day plans.ts holds a real price it shows up automatically.
//  - Plan features are shown only from the numeric `limits`, never from the
//    free-text `features` list, which has vague marketing lines.
//  - "Most popular" is NOT shown: it is a claim nobody has verified.

import type { Plan } from '@/lib/billing/plans'

/** A paid plan priced below this many rupees a month is placeholder data. */
export const PLACEHOLDER_PRICE_BELOW_INR = 10

export interface PricingCard {
  id: string
  name: string
  tagline: string
  /** Big text: "₹0", "₹999" or "Contact us". */
  priceLabel: string
  /** Small text under the price, or null. */
  priceNote: string | null
  /** True when priceLabel is a real number the owner has set. */
  priceKnown: boolean
  /** True for the ₹0 plan. */
  isFree: boolean
  highlights: string[]
}

export interface MessagePriceRow {
  label: string
  price: string
}

/** 5000 -> "5,000". Done by hand so server and browser always agree. */
export function formatCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 1.09 -> "₹1.09", 0.145 -> "₹0.145", 0 -> "Free". */
export function formatRupees(n: number): string {
  if (n === 0) return 'Free'
  return `₹${n}`
}

export function isPlaceholderPrice(plan: Pick<Plan, 'priceMonthly'>): boolean {
  return plan.priceMonthly > 0 && plan.priceMonthly < PLACEHOLDER_PRICE_BELOW_INR
}

export function limitHighlights(limits: Plan['limits']): string[] {
  const out: string[] = []
  out.push(limits.contacts === -1 ? 'Unlimited contacts' : `${formatCount(limits.contacts)} contacts`)
  out.push(
    limits.broadcastsPerMonth === -1
      ? 'Unlimited broadcasts'
      : `${formatCount(limits.broadcastsPerMonth)} broadcasts per month`,
  )
  out.push(limits.teamMembers === 1 ? '1 team member' : `${formatCount(limits.teamMembers)} team members`)
  out.push(limits.automations === -1 ? 'Unlimited automations' : `${formatCount(limits.automations)} automations`)
  return out
}

export function buildPricingCards(plans: readonly Plan[]): PricingCard[] {
  return plans.map((p) => {
    const free = p.priceMonthly === 0
    const placeholder = isPlaceholderPrice(p)
    return {
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      priceLabel: free ? '₹0' : placeholder ? 'Contact us' : `₹${formatCount(p.priceMonthly)}`,
      priceNote: free ? 'Free forever' : placeholder ? 'Pricing shared on request' : 'per month',
      priceKnown: free || !placeholder,
      isFree: free,
      highlights: limitHighlights(p.limits),
    }
  })
}

/** Order the rows the way a customer thinks about them. */
export function messagePriceRows(prices: {
  marketing: number
  utility: number
  authentication: number
  service: number
}): MessagePriceRow[] {
  return [
    { label: 'Marketing message (offers, promotions)', price: formatRupees(prices.marketing) },
    { label: 'Utility message (order and booking updates)', price: formatRupees(prices.utility) },
    { label: 'Authentication message (OTP and login codes)', price: formatRupees(prices.authentication) },
    { label: 'Reply to a message your customer sent you', price: formatRupees(prices.service) },
  ]
}
