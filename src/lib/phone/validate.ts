// src/lib/phone/validate.ts
//
// One place that decides "is this a phone number a person can be called on?"
// for the places a visitor TYPES a number: the AI booking tool and the
// website lead form.
//
// Why it exists: the booking tool saved whatever the model passed it, so an
// 11-digit number (76644354756) became a real appointment request, and the
// callback team found out only when they dialled it.
//
// Rules (kept small on purpose):
//   * Indian mobile = 10 digits starting 6-9. Accepted as 98765 43210,
//     098765 43210, 91 98765 43210, +91 98765 43210, 0091 ...
//   * Any other country must be written with "+" and its country code,
//     8 to 15 digits in total (the E.164 limit).
//   * "Junk" is rejected: all the same digit (000000000, 9999999999),
//     7 or more repeating digits in a row, long 12345678 / 87654321 style
//     runs (8 or more in a row), and a short block repeated over and over (9898989898).
//
// Pure function, no I/O, no imports. Used by:
//   src/lib/agent/tools/booking-tools.ts, src/app/api/widget/lead/route.ts

export type PhoneProblem =
  | 'empty'
  | 'letters'
  | 'too_short'
  | 'too_long'
  | 'indian_format'
  | 'needs_country_code'
  | 'junk'

export type PhoneCheck =
  | {
      ok: true
      /** "+919876543210" — the form to store and to dial. */
      e164: string
      /** "919876543210" — digits only, what WhatsApp links want. */
      digits: string
      country: 'IN' | 'OTHER'
    }
  | { ok: false; problem: PhoneProblem; message: string }

const MESSAGES: Record<PhoneProblem, string> = {
  empty: 'No phone number was given.',
  letters: 'The phone number has letters in it.',
  too_short: 'The phone number is too short.',
  too_long: 'The phone number is too long.',
  indian_format:
    'An Indian mobile number has 10 digits and starts with 6, 7, 8 or 9 (for example 98765 43210).',
  needs_country_code:
    'This number has no country code. An Indian number must be 10 digits; a number from another country must start with + and the country code.',
  junk: 'This does not look like a real phone number.',
}

function bad(problem: PhoneProblem): PhoneCheck {
  return { ok: false, problem, message: MESSAGES[problem] }
}

/** Obvious fakes: 0000000000, 9999999999, 1234567890, 9876543210, 9898989898. */
export function looksLikeJunkDigits(digits: string): boolean {
  if (!digits) return true
  if (/^(\d)\1+$/.test(digits)) return true // all the same digit
  if (/(\d)\1{6,}/.test(digits)) return true // 7+ of one digit in a row
  // Straight runs of 8+ going up or down (wrapping 9 -> 0). 8, not 7:
  // real numbers such as 98765 43201 contain a 7-run by chance.
  const up = '01234567890123456789'
  const down = '98765432109876543210'
  for (let i = 0; i + 8 <= digits.length; i++) {
    const part = digits.slice(i, i + 8)
    if (up.includes(part) || down.includes(part)) return true
  }
  // A 2-digit or 3-digit block repeated across the whole number.
  if (digits.length >= 8 && /^(\d{2,3})\1+\d?$/.test(digits)) return true
  return false
}

/**
 * Check a phone number typed by a person. Never throws.
 * `raw` may contain spaces, dashes, dots and brackets.
 */
export function checkPhone(raw: unknown): PhoneCheck {
  if (typeof raw !== 'string') return bad('empty')
  const text = raw.trim()
  if (!text) return bad('empty')

  // Letters mean it is not a number ("call me", "none"). Allow an
  // "ext"/"x" suffix? No: one number per field keeps this predictable.
  if (/[a-z]/i.test(text)) return bad('letters')

  const hadPlus = text.startsWith('+')
  let digits = text.replace(/\D/g, '')
  if (!digits) return bad('empty')

  // "00" is the other way of writing "+".
  let international = hadPlus
  if (!hadPlus && digits.startsWith('00')) {
    digits = digits.slice(2)
    international = true
  }
  if (!digits) return bad('empty')

  if (international) {
    if (digits.length < 8) return bad('too_short')
    if (digits.length > 15) return bad('too_long')
    if (digits.startsWith('0')) return bad('needs_country_code')
    if (digits.startsWith('91')) return indian(digits.slice(2))
    if (looksLikeJunkDigits(digits)) return bad('junk')
    return { ok: true, e164: `+${digits}`, digits, country: 'OTHER' }
  }

  // No "+": only an Indian number is accepted, written 10, 11 (0 + 10) or 12 (91 + 10) digits.
  if (digits.length === 10) return indian(digits)
  if (digits.length === 11 && digits.startsWith('0')) return indian(digits.slice(1))
  if (digits.length === 12 && digits.startsWith('91')) return indian(digits.slice(2))
  if (digits.length < 10) return bad('too_short')
  // 11 digits not starting with 0, 13+ digits, 12 digits not starting 91, ...
  return bad(digits.length > 12 ? 'too_long' : 'indian_format')
}

function indian(national: string): PhoneCheck {
  if (!/^[6-9]\d{9}$/.test(national)) return bad('indian_format')
  if (looksLikeJunkDigits(national)) return bad('junk')
  return { ok: true, e164: `+91${national}`, digits: `91${national}`, country: 'IN' }
}

/** A sentence the booking tool hands back to the model when the number is not usable. */
export function phoneProblemForModel(raw: unknown, check: Extract<PhoneCheck, { ok: false }>): string {
  const shown = typeof raw === 'string' ? raw.trim().slice(0, 30) : ''
  return [
    `PHONE_INVALID: the number "${shown}" cannot be used. ${check.message}`,
    'Do NOT book yet and do NOT say it was saved.',
    'Politely ask the customer to send their 10-digit mobile number again (a number from another country must start with + and the country code), then call book_appointment again.',
  ].join(' ')
}
