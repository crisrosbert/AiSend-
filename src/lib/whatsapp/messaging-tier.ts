/**
 * Meta's WhatsApp messaging tiers — how many unique customers you can
 * message in a rolling 24 hours, before you need to earn the next tier
 * by sending quality messages with good delivery and low block rates.
 *
 * The Cloud API exposes this as `messaging_limit_tier` on the phone
 * number (see verifyPhoneNumber() in meta-api.ts). The dashboard used to
 * hardcode "1K" for every connected number — this is the real value.
 */

export interface MessagingTierInfo {
  /** Short label matching how AiSensy/Meta describe it, e.g. "Tier 1". */
  label: string
  /** Unique-recipient ceiling per rolling 24h, or null for unlimited. */
  limit: number | null
  /** Compact display for the limit, e.g. "1K", "10K", "Unlimited". */
  limitDisplay: string
}

const TIER_MAP: Record<string, MessagingTierInfo> = {
  TIER_50: { label: 'Tier 0', limit: 50, limitDisplay: '50' },
  TIER_250: { label: 'Tier 1', limit: 250, limitDisplay: '250' },
  TIER_1K: { label: 'Tier 1', limit: 1000, limitDisplay: '1K' },
  TIER_10K: { label: 'Tier 2', limit: 10000, limitDisplay: '10K' },
  TIER_100K: { label: 'Tier 3', limit: 100000, limitDisplay: '100K' },
  TIER_UNLIMITED: { label: 'Tier 4', limit: null, limitDisplay: 'Unlimited' },
}

/** Look up Meta's raw messaging_limit_tier string; unknown values pass through as-is rather than guessing. */
export function describeMessagingTier(raw?: string | null): MessagingTierInfo | null {
  if (!raw) return null
  return TIER_MAP[raw] ?? { label: raw, limit: null, limitDisplay: raw }
}

export interface QuotaStatus {
  used: number
  limit: number | null
  remaining: number | null
  /** used / limit, 0–1. Null when the tier is unlimited (no ceiling to divide by). */
  pctUsed: number | null
  /** True once usage crosses 80% of the ceiling — the point AiSensy's passive number doesn't warn you about. */
  isNearLimit: boolean
}

export function quotaStatus(used: number, limit: number | null): QuotaStatus {
  if (limit === null) {
    return { used, limit: null, remaining: null, pctUsed: null, isNearLimit: false }
  }
  const remaining = Math.max(0, limit - used)
  const pctUsed = limit > 0 ? used / limit : 0
  return { used, limit, remaining, pctUsed, isNearLimit: pctUsed >= 0.8 }
}
