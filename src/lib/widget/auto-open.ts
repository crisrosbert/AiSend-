// src/lib/widget/auto-open.ts
//
// Optional auto-open of the website chat window. Pure functions, no I/O.
// Used by the /widget dashboard page (clean values before saving, retry
// without the new columns) and by /api/widget/config (what the visitor gets).
// public/widget.js carries its own small copy of the path matcher;
// auto-open.test.ts runs BOTH copies against the same inputs.

/** The three widget_configs columns added by migration 044. */
export const AUTO_OPEN_COLUMNS = ['auto_open_enabled', 'auto_open_seconds', 'auto_open_exclude'] as const

export const AUTO_OPEN_SECONDS_DEFAULT = 5
export const AUTO_OPEN_SECONDS_MIN = 1
export const AUTO_OPEN_SECONDS_MAX = 120
const EXCLUDE_MAX_ENTRIES = 20
const EXCLUDE_MAX_LENGTH = 100

export function cleanAutoOpenSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return AUTO_OPEN_SECONDS_DEFAULT
  return Math.min(AUTO_OPEN_SECONDS_MAX, Math.max(AUTO_OPEN_SECONDS_MIN, Math.round(n)))
}

/** "/checkout\n/contact, form" -> ['/checkout','/contact','form'] (lowercase, trimmed, capped). */
export function parseExcludeList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const out: string[] = []
  for (const raw of value.split(/[\n,]+/)) {
    const s = raw.trim().toLowerCase().slice(0, EXCLUDE_MAX_LENGTH)
    if (s && !out.includes(s)) out.push(s)
    if (out.length >= EXCLUDE_MAX_ENTRIES) break
  }
  return out
}

/** What gets stored: the cleaned list joined by new lines ('' = none). */
export function cleanExcludeText(value: unknown): string {
  return parseExcludeList(value).join('\n')
}

/**
 * Is this page excluded? "/checkout" matches a path that STARTS with it
 * ("/checkout", "/checkout/step-2"); a trailing * is ignored. Without a leading
 * slash ("form") it matches a path that CONTAINS it.
 */
export function isPathExcluded(pathname: string, list: string[]): boolean {
  const path = (pathname || '/').toLowerCase()
  for (const item of list) {
    const p = item.replace(/\*+$/, '')
    if (!p) continue
    if (p.charAt(0) === '/') {
      if (path.indexOf(p) === 0) return true
    } else if (path.indexOf(p) !== -1) {
      return true
    }
  }
  return false
}

/** What the website visitor receives. A missing column or bad value can only mean "off". */
export function autoOpenView(config: Record<string, unknown>): {
  auto_open_enabled: boolean
  auto_open_seconds: number
  auto_open_exclude: string
} {
  return {
    auto_open_enabled: config.auto_open_enabled === true,
    auto_open_seconds: cleanAutoOpenSeconds(config.auto_open_seconds),
    auto_open_exclude: cleanExcludeText(config.auto_open_exclude),
  }
}

/** True when a database error means "one of the new columns does not exist yet". */
export function isMissingAutoOpenColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  const message = typeof e.message === 'string' ? e.message : ''
  if (code !== '42703' && code !== 'PGRST204') return false
  return AUTO_OPEN_COLUMNS.some((c) => message.includes(c))
}

/** The same row without the auto-open columns (used for the retry). */
export function withoutAutoOpenColumns<T extends Record<string, unknown>>(payload: T): Omit<T, (typeof AUTO_OPEN_COLUMNS)[number]> {
  const copy: Record<string, unknown> = { ...payload }
  for (const c of AUTO_OPEN_COLUMNS) delete copy[c]
  return copy as Omit<T, (typeof AUTO_OPEN_COLUMNS)[number]>
}
