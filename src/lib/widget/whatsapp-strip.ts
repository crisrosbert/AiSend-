// src/lib/widget/whatsapp-strip.ts
//
// The optional "WhatsApp strip" inside the website chat widget: one slim line
// under the chat header that opens WhatsApp with the business.
//
// Pure functions, no I/O. Used by:
//   src/app/(dashboard)/widget/page.tsx     (check before saving, retry without
//                                            the new columns if they are missing)
//   src/app/api/widget/config/route.ts      (decide what the website visitor gets)
//
// public/widget.js is plain browser JavaScript and cannot import this file, so
// it carries its own small copy of the text/number/link helpers. whatsapp-strip.test.ts
// runs BOTH copies against the same inputs so they cannot drift apart.
//
// One number, one place: the strip uses widget_configs.business_phone, the same
// value the AI hand-off "Continue on WhatsApp" button already uses.

import { checkPhone } from '@/lib/phone/validate'

export const WA_BUTTON_TEXT_DEFAULT = 'Talk to the clinic team directly'
export const WA_BUTTON_TEXT_MAX = 50

/** The two new widget_configs columns (migration 043). */
export const WA_COLUMNS = ['whatsapp_button_enabled', 'whatsapp_button_text'] as const

/** Replace control characters (tabs, new lines, etc.) with a space. */
function stripControl(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    out += c < 32 || (c >= 127 && c <= 159) || c === 0x2028 || c === 0x2029 ? ' ' : s.charAt(i)
  }
  return out
}

/** Cut to `max` characters without leaving half of an emoji at the end. */
function cutSafe(s: string, max: number): string {
  if (s.length <= max) return s
  let t = s.slice(0, max)
  const last = t.charCodeAt(t.length - 1)
  if (last >= 0xd800 && last <= 0xdbff) t = t.slice(0, -1)
  return t.trim()
}

/**
 * Plain text for the strip. No angle brackets, one line, at most 50 characters.
 * Returns '' when nothing usable is left (the caller then uses the default).
 */
export function cleanButtonText(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const s = stripControl(raw).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
  return cutSafe(s, WA_BUTTON_TEXT_MAX)
}

/** What the visitor sees: the owner's text, or the default. */
export function buttonTextOrDefault(raw: unknown): string {
  return cleanButtonText(raw) || WA_BUTTON_TEXT_DEFAULT
}

export type WaSettingsInput = {
  enabled: boolean
  phone: string | null | undefined
  text: string | null | undefined
}

export type WaSettingsCheck =
  | {
      ok: true
      /** What to store in widget_configs.business_phone ('' when empty). */
      phone: string
      /** What to store in widget_configs.whatsapp_button_text (null = use the default). */
      text: string | null
      /** Only when the button is OFF and the saved number does not look right. Never blocks saving. */
      warning?: string
    }
  | { ok: false; field: 'phone'; message: string }

/**
 * Check the owner's WhatsApp settings before saving.
 *  - Button ON: the number must pass checkPhone. It is stored as digits only
 *    (no plus), e.g. "+91 98201 23987" becomes "919820123987". Otherwise saving is blocked.
 *  - Button OFF: the number is only a hand-off number. A good number is cleaned
 *    to digits; an odd one is kept exactly as typed (we never destroy a saved
 *    number) and a soft warning is returned.
 */
export function checkWhatsappSettings(input: WaSettingsInput): WaSettingsCheck {
  const raw = typeof input.phone === 'string' ? input.phone.trim() : ''
  const text = cleanButtonText(input.text) || null

  if (!raw) {
    if (input.enabled) {
      return { ok: false, field: 'phone', message: 'Add your WhatsApp number to switch the button on.' }
    }
    return { ok: true, phone: '', text }
  }

  const check = checkPhone(raw)
  if (check.ok) return { ok: true, phone: check.digits, text }

  if (input.enabled) return { ok: false, field: 'phone', message: check.message }
  return {
    ok: true,
    phone: raw,
    text,
    warning: `${check.message} The hand-off button may not work until you fix it.`,
  }
}

/**
 * What the public config endpoint tells the website. The strip is ON only when
 * BOTH the owner switched it on AND a valid number is saved. Anything else
 * (column missing, null, "false", a bad number) means OFF.
 */
export function whatsappStripView(config: Record<string, unknown>): {
  whatsapp_button_enabled: boolean
  whatsapp_button_text: string
} {
  const enabled =
    config.whatsapp_button_enabled === true && checkPhone(config.business_phone).ok
  return {
    whatsapp_button_enabled: enabled,
    whatsapp_button_text: buttonTextOrDefault(config.whatsapp_button_text),
  }
}

/**
 * True when a database error means "one of the new columns does not exist yet"
 * (Postgres 42703, or PostgREST PGRST204 "could not find the column ... in the
 * schema cache"). Same idea as the opted_out_at retry in the opt-out code.
 */
export function isMissingWhatsappColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  const message = typeof e.message === 'string' ? e.message : ''
  if (code !== '42703' && code !== 'PGRST204') return false
  return WA_COLUMNS.some((c) => message.includes(c))
}

/** The same row without the two new columns (used for the retry). */
export function withoutWhatsappColumns<T extends Record<string, unknown>>(payload: T): Omit<T, (typeof WA_COLUMNS)[number]> {
  const copy: Record<string, unknown> = { ...payload }
  for (const c of WA_COLUMNS) delete copy[c]
  return copy as Omit<T, (typeof WA_COLUMNS)[number]>
}
