/**
 * OPT-OUT DETECTION
 *
 * Detects when an inbound message is an opt-out request.
 * Meta recommends honouring at minimum: STOP, STOPALL, UNSUBSCRIBE,
 * CANCEL, END, QUIT — plus common Indian variants.
 *
 * Returns { isOptOut: true, keyword } or { isOptOut: false }.
 */

const OPT_OUT_KEYWORDS = new Set([
  // Meta's recommended list (case-insensitive, full-word match)
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  // Common variants
  'opt out',
  'opt-out',
  'optout',
  'remove me',
  'no more',
  'don\'t message',
  'dont message',
  'block',
  'mujhe mat bhejo',   // Hindi: don't send me
  'band karo',          // Hindi: stop this
  'rokna',             // Hindi: stop
])

const OPT_IN_KEYWORDS = new Set([
  'start',
  'unstop',
  'subscribe',
  'yes',
  'optin',
  'opt in',
  'opt-in',
  'resume',
  'shuru karo',        // Hindi: start
])

export interface OptOutResult {
  isOptOut: boolean
  isOptIn: boolean
  keyword: string | null
}

/**
 * Checks whether a message text is an opt-out or opt-in command.
 * Normalises the text: trim, lowercase, collapse whitespace.
 */
export function detectOptOutKeyword(text: string | null | undefined): OptOutResult {
  if (!text) return { isOptOut: false, isOptIn: false, keyword: null }

  const normalised = text.trim().toLowerCase().replace(/\s+/g, ' ')

  // Full-message match first (most reliable — contact sent ONLY "STOP")
  if (OPT_OUT_KEYWORDS.has(normalised)) {
    return { isOptOut: true, isOptIn: false, keyword: normalised }
  }

  // Also catch "STOP please" or "Please STOP" — starts-with or ends-with
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
