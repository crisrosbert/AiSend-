import { MESSAGE_PRICE_INR } from '@/lib/billing/credits'

/** Price of one marketing template message, from the single source of truth in billing. */
export const MARKETING_PRICE = MESSAGE_PRICE_INR.marketing

export interface CostEstimate {
  /** First message to everyone. */
  firstMessage: number
  /** Worst case if every follow-up goes to everyone. */
  upperBound: number
}

export function estimateCost(contacts: number, followups: number): CostEstimate {
  const n = Math.max(0, Math.floor(contacts))
  const first = round2(n * MARKETING_PRICE)
  return { firstMessage: first, upperBound: round2(first * (1 + Math.max(0, followups))) }
}

const round2 = (v: number) => Math.round(v * 100) / 100
