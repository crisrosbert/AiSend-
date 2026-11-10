// src/lib/agent/input-guard.ts
//
// Pure helpers that sit between untrusted customer text and the model.
//
//   • sanitizeInboundText  — length cap + control/invisible character strip
//   • detectInjectionAttempt — cheap heuristic, used for logging and an
//                              extra reminder, never to block a message
//   • replyLeaksPrompt     — last line of defence on the way OUT
//   • dedupeTrailingUserTurn — the inbound message was stored before the
//                              engine ran, so history already contains it
//
// None of this replaces the prompt rules; it only removes the cheap ways
// to waste money (huge inputs) or leak the prompt (verbatim echo).

/** Longest visitor message the website widget accepts after trimming. */
export const MAX_WIDGET_MESSAGE_CHARS = 1000
/**
 * Above this the widget route rejects the request outright (400) instead
 * of truncating. A person does not type 4,000 characters into a chat bubble.
 */
export const MAX_WIDGET_RAW_CHARS = 4000
/** Longest inbound text the ENGINE will send to the model (any channel). */
export const MAX_INBOUND_CHARS = 2000
/** Longest single history turn sent to the model. */
export const MAX_HISTORY_TURN_CHARS = 2000

export interface SanitizedText {
  text: string
  truncated: boolean
  originalLength: number
}

// C0 controls except \t \n, DEL, and invisible formatting characters used
// to smuggle instructions or fake line breaks. U+200C/U+200D (ZWNJ/ZWJ)
// are KEPT: Hindi and emoji sequences need them.
const STRIP =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​‎‏‪-‮⁠-⁤⁦-⁩﻿]/g

/**
 * Clean and cap untrusted text. Never throws; non-strings become ''.
 * Truncation never splits a surrogate pair (emoji) in half.
 */
export function sanitizeInboundText(input: unknown, max: number): SanitizedText {
  if (typeof input !== 'string') return { text: '', truncated: false, originalLength: 0 }

  const originalLength = input.length
  let text = input.replace(/\r\n?/g, '\n').replace(STRIP, '').replace(/\n{3,}/g, '\n\n').trim()

  let truncated = false
  if (text.length > max) {
    truncated = true
    text = text.slice(0, max)
    // A cut in the middle of a surrogate pair leaves a lone high surrogate.
    const last = text.charCodeAt(text.length - 1)
    if (last >= 0xd800 && last <= 0xdbff) text = text.slice(0, -1)
    text = text.trim()
  }
  return { text, truncated, originalLength }
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all |any |the |your )?(?:previous|prior|above|earlier|preceding) (?:instructions?|prompts?|rules?|messages?)/i,
  /disregard (?:all |any |the |your )?(?:previous |prior )?(?:instructions?|rules?|prompts?|guidelines?)/i,
  /forget (?:everything|all|your (?:instructions?|rules?|prompt))/i,
  /(?:reveal|show|print|repeat|display|output|leak|tell me|give me|share)\s+(?:me\s+)?(?:your|the)\s+(?:system\s+|initial\s+|hidden\s+|original\s+)?(?:prompt|instructions?|rules?)/i,
  /\bsystem prompt\b/i,
  /\byou are now\b/i,
  /\bpretend (?:to be|you are|you're)\b/i,
  /\b(?:developer|debug|admin|god) mode\b/i,
  /\bjailbreak\b/i,
  /\bdo anything now\b/i,
  /\bnew instructions?\s*:/i,
  /^\s*(?:system|assistant)\s*:/im,
  /<\/?(?:system|instructions?)>/i,
  // Hinglish / Hindi
  /(?:pichle|purane|saare|sare)\s+(?:instructions?|nirdesh|rules?)\s+(?:bhool|ignore|mat maan)/i,
  /apna\s+(?:system\s+)?prompt\s+(?:dikha|bata|print)/i,
  /पिछले (?:सभी )?निर्देश/,
]

/** Heuristic only. A true result adds a reminder and a log line, nothing more. */
export function detectInjectionAttempt(text: string): boolean {
  if (!text) return false
  return INJECTION_PATTERNS.some((re) => re.test(text))
}

// Strings that only ever appear in our own prompt or tool wiring. A reply
// containing one of them is a leak, whatever the customer asked.
const LEAK_MARKERS = [
  '[operational notes',
  '[safety rules',
  '[language — follow silently',
  '[current time — this is real',
  '[lead capture',
  'search_knowledge_base',
  'handoff_to_human',
  'book_appointment',
  'send_payment_link',
  'tag_contact',
  'submit_lead',
  'send_media',
]

/**
 * Did the model print its own instructions?
 *
 * `protectedText` is the STATIC rule text only (never the persona or the
 * business's own facts, which the model may legitimately quote). A reply
 * leaks if it contains a marker above, or repeats a 70-character run of
 * the protected text verbatim.
 */
export function replyLeaksPrompt(reply: string, protectedText: string = ''): boolean {
  const r = (reply || '').toLowerCase()
  if (!r) return false
  if (LEAK_MARKERS.some((m) => r.includes(m))) return true

  const p = protectedText.replace(/\s+/g, ' ').toLowerCase()
  const flat = r.replace(/\s+/g, ' ')
  const WINDOW = 70
  for (let i = 0; i + WINDOW <= p.length; i += 35) {
    if (flat.includes(p.slice(i, i + WINDOW))) return true
  }
  return false
}

/**
 * The webhook and widget store the customer's message BEFORE the engine
 * runs, so history already ends with it and the engine appended it a
 * second time: the model saw every question twice. Drop the stored copy.
 */
export function dedupeTrailingUserTurn<T extends { role: string; text: string }>(
  history: T[],
  inbound: string,
): T[] {
  const last = history[history.length - 1]
  if (last && last.role === 'user' && last.text.trim() === inbound.trim()) {
    return history.slice(0, -1)
  }
  return history
}
