/**
 * OPT-OUT KEYWORD DETECTION
 * Pure utility — no imports, no Supabase, no side effects.
 * Safe to import anywhere (client or server).
 */

const OPT_OUT_KEYWORDS = new Set([
  'stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit',
  'opt out', 'opt-out', 'optout', 'remove me', 'no more',
  "don't message", 'dont message', 'block',
  'mujhe mat bhejo', 'band karo', 'rokna',
])

const OPT_IN_KEYWORDS = new Set([
  'start', 'unstop', 'subscribe', 'yes', 'optin', 'opt in', 'opt-in',
  'resume', 'shuru karo',
])

export interface OptOutResult {
  isOptOut: boolean
  isOptIn: boolean
  keyword: string | null
}

export function detectOptOutKeyword(text: string | null | undefined): OptOutResult {
  if (!text) return { isOptOut: false, isOptIn: false, keyword: null }

  const normalised = text.trim().toLowerCase().replace(/\s+/g, ' ')

  if (OPT_OUT_KEYWORDS.has(normalised)) {
    return { isOptOut: true, isOptIn: false, keyword: normalised }
  }

  for (const kw of OPT_OUT_KEYWORDS) {
    if (normalised.startsWith(kw + ' ') || normalised.endsWith(' ' + kw)) {
      return { isOptOut: true, isOptIn: false, keyword: kw }
    }
  }

  if (OPT_IN_KEYWORDS.has(normalised)) {
    return { isOptOut: false, isOptIn: true, keyword: normalised }
  }

  return { isOptOut: false, isOptIn: false, keyword: null }
}
