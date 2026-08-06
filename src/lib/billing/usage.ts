// src/lib/billing/usage.ts
//
// Pure aggregation helpers behind the Billing & Usage screen.
//
// The wallet ledger (`wallet_transactions`) is the single honest record of
// what an org has spent: every send route debits it AFTER Meta accepts a
// message, writing one row per message. This module turns that raw ledger
// into the shapes the UI needs — daily buckets, per-category totals, spend
// deltas and a balance "runway" — without touching the network, so it can
// be unit-tested and reused by an export/report endpoint later.
//
// Nothing here invents numbers. If the ledger is empty the summaries come
// back as zeroes and the UI renders an empty state rather than a fake chart.

import { MESSAGE_PRICE_INR, type MessageCategory } from './credits'
import { localDayKey } from '@/lib/dashboard/date-utils'

/**
 * Categories we chart. `other` is the catch-all for ledger rows written by
 * flows that don't name a message category (manual adjustments, legacy
 * rows) — it keeps totals honest instead of silently dropping spend.
 */
export type UsageCategory = MessageCategory | 'other'

export const USAGE_CATEGORIES: UsageCategory[] = [
  'marketing',
  'utility',
  'authentication',
  'service',
  'other',
]

export interface LedgerEntry {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

/** Ledger row types that represent money leaving the wallet. */
const DEBIT_TYPES = new Set(['deduction', 'debit', 'usage', 'charge'])

export function isDebit(type: string | null | undefined): boolean {
  return DEBIT_TYPES.has((type ?? '').toLowerCase())
}

/**
 * Recover the message category from a ledger row's description.
 *
 * The send routes write "WhatsApp <category> message…", so a keyword scan
 * is reliable for rows they produce. Order matters: check the longer,
 * more specific words first so "authentication" never matches as "auth"
 * inside another phrase.
 */
export function categorizeLedgerEntry(
  description: string | null | undefined,
): UsageCategory {
  const text = (description ?? '').toLowerCase()
  if (text.includes('authentication') || /\bauth\b/.test(text)) return 'authentication'
  if (text.includes('marketing')) return 'marketing'
  if (text.includes('utility')) return 'utility'
  if (text.includes('service')) return 'service'
  return 'other'
}

/** Zeroed per-category tally — the starting point for every aggregate. */
function emptyTally(): Record<UsageCategory, number> {
  return { marketing: 0, utility: 0, authentication: 0, service: 0, other: 0 }
}

export interface UsageDay {
  /** Local calendar day key, YYYY-MM-DD. */
  day: string
  /** Total INR spent that day. */
  total: number
  /** INR spent per category. */
  spend: Record<UsageCategory, number>
  /** Number of billed messages per category. */
  count: Record<UsageCategory, number>
}

/**
 * Bucket debit rows into one entry per day key, in the order given.
 *
 * Callers pass the full list of day keys for the window (see
 * `lastNDayKeys`) so quiet days still render a zero column — a chart with
 * gaps reads as broken data, not as "nothing happened".
 */
export function buildUsageSeries(
  entries: LedgerEntry[],
  dayKeys: string[],
): UsageDay[] {
  const byDay = new Map<string, UsageDay>()
  for (const day of dayKeys) {
    byDay.set(day, { day, total: 0, spend: emptyTally(), count: emptyTally() })
  }

  for (const entry of entries) {
    if (!isDebit(entry.type)) continue
    const bucket = byDay.get(localDayKey(entry.created_at))
    if (!bucket) continue // outside the requested window
    const category = categorizeLedgerEntry(entry.description)
    // Ledgers may store debits as negative or positive depending on the
    // RPC that wrote them; spend is always an outflow, so normalise.
    const amount = Math.abs(Number(entry.amount) || 0)
    bucket.spend[category] += amount
    bucket.count[category] += 1
    bucket.total += amount
  }

  return dayKeys.map((day) => byDay.get(day)!)
}

export interface UsageSummary {
  /** Total INR spent across every category. */
  totalSpend: number
  /** Total billed messages. */
  totalCount: number
  spend: Record<UsageCategory, number>
  count: Record<UsageCategory, number>
  /** Total INR added to the wallet (recharges + bonuses) in the window. */
  totalTopUp: number
}

export function summarizeUsage(entries: LedgerEntry[]): UsageSummary {
  const summary: UsageSummary = {
    totalSpend: 0,
    totalCount: 0,
    spend: emptyTally(),
    count: emptyTally(),
    totalTopUp: 0,
  }

  for (const entry of entries) {
    const amount = Math.abs(Number(entry.amount) || 0)
    if (isDebit(entry.type)) {
      const category = categorizeLedgerEntry(entry.description)
      summary.spend[category] += amount
      summary.count[category] += 1
      summary.totalSpend += amount
      summary.totalCount += 1
    } else {
      summary.totalTopUp += amount
    }
  }

  return summary
}

/** Sum the debits that fall inside [from, to). */
export function spendBetween(entries: LedgerEntry[], from: Date, to: Date): number {
  const start = from.getTime()
  const end = to.getTime()
  let total = 0
  for (const entry of entries) {
    if (!isDebit(entry.type)) continue
    const at = new Date(entry.created_at).getTime()
    if (at >= start && at < end) total += Math.abs(Number(entry.amount) || 0)
  }
  return total
}

/**
 * Percentage change between two periods, rounded to a whole number.
 * Returns null when there is no baseline to compare against — showing
 * "+100%" for a first-ever message would be misleading.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * How many more messages of each category the current balance covers.
 * Free categories (service) return null — "unlimited" is the honest
 * answer there, and dividing by zero is not.
 */
export function estimateRunway(balance: number): Record<MessageCategory, number | null> {
  const safeBalance = Math.max(0, Number(balance) || 0)
  const out = {} as Record<MessageCategory, number | null>
  for (const [category, price] of Object.entries(MESSAGE_PRICE_INR)) {
    // Nudge before flooring: 109 / 1.09 is 99.999… in binary floating
    // point, and telling someone holding ₹109 that they can send 99
    // marketing messages instead of 100 is a bug they will notice.
    out[category as MessageCategory] =
      price > 0 ? Math.floor(safeBalance / price + 1e-9) : null
  }
  return out
}

/**
 * Average cost per billed message over the window — the number that
 * actually tells an operator whether their template mix is getting more
 * expensive. Returns 0 when nothing was sent.
 */
export function averageCostPerMessage(summary: UsageSummary): number {
  return summary.totalCount > 0 ? summary.totalSpend / summary.totalCount : 0
}

/** INR formatting with Indian digit grouping (1,00,000 not 100,000). */
export function formatINR(value: number, fractionDigits = 2): string {
  return `₹${(Number(value) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`
}

export function formatCount(value: number): string {
  return (Number(value) || 0).toLocaleString('en-IN')
}

/** `-1` in a plan's limits means unlimited. */
export function formatLimit(limit: number): string {
  return limit < 0 ? 'Unlimited' : formatCount(limit)
}

/** Clamped 0–100 fill percentage for a usage meter. */
export function meterPercent(used: number, limit: number): number {
  if (limit < 0) return 0 // unlimited — nothing to fill
  if (limit === 0) return 100
  return Math.min(100, Math.max(0, (used / limit) * 100))
}

/**
 * Ledger rows → CSV for the "Download report" action. Quotes every field
 * so descriptions containing commas survive the round-trip into Excel.
 */
export function ledgerToCsv(entries: LedgerEntry[]): string {
  const header = ['Date', 'Type', 'Category', 'Description', 'Amount (INR)', 'Balance after (INR)']
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const rows = entries.map((entry) => {
    const amount = Math.abs(Number(entry.amount) || 0)
    const signed = isDebit(entry.type) ? -amount : amount
    return [
      new Date(entry.created_at).toISOString(),
      entry.type ?? '',
      isDebit(entry.type) ? categorizeLedgerEntry(entry.description) : '—',
      entry.description ?? '',
      signed.toFixed(3),
      (Number(entry.balance_after) || 0).toFixed(2),
    ]
      .map((field) => escape(String(field)))
      .join(',')
  })
  return [header.map(escape).join(','), ...rows].join('\n')
}
