// Numbers for the live campaign screen. Pure, so they are unit-tested.

import { MARKETING_PRICE } from './estimate'

/** "Day 2 of 4": the journey is day 1 plus every follow-up wait. */
export function dayProgress(input: { launchedAt: string; followupWaitHours: number[]; now?: Date; finished?: boolean }): { current: number; total: number } {
  const total = 1 + Math.ceil(input.followupWaitHours.reduce((a, b) => a + b, 0) / 24)
  if (input.finished) return { current: total, total }
  const ms = (input.now ?? new Date()).getTime() - new Date(input.launchedAt).getTime()
  const day = Math.floor(Math.max(0, ms) / 86_400_000) + 1
  return { current: Math.min(total, day), total }
}

/** What has been spent so far (the wallet is charged per message actually sent), against the planned maximum. */
export function budgetFigures(plannedMax: number, sentCounts: number[], balance: number | null) {
  const sent = sentCounts.reduce((a, b) => a + b, 0)
  const spent = Math.round(sent * MARKETING_PRICE * 100) / 100
  return { plannedMax, spent, remaining: Math.max(0, Math.round((plannedMax - spent) * 100) / 100), balance }
}

/** Only https links, no credentials, a sane length. Returns the clean URL or null. */
export function cleanLink(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const t = url.trim()
  if (t.length === 0 || t.length > 500) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:' || u.username || u.password) return null
    return u.toString()
  } catch {
    return null
  }
}

export function cleanLinkText(text: unknown): string {
  const t = typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 25) : ''
  return t || 'Know more'
}
