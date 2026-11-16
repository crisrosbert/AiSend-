// src/lib/widget/wa-redirect.ts
//
// Optional "Direct to WhatsApp" mode of the website chat widget. Pure functions.
// ON = the send arrow opens WhatsApp (wa.me) with the visitor's message, on the
// owner's number, instead of asking the AI.

import { checkPhone } from '@/lib/phone/validate'

/** The two widget_configs columns added by migration 045. */
export const WA_REDIRECT_COLUMNS = ['wa_redirect_enabled', 'wa_redirect_number'] as const

export type WaRedirectCheck =
  | { ok: true; number: string }
  | { ok: false; message: string }

/**
 * Check before saving. Switch ON: the redirect number (or, if empty, the
 * business number) must be a valid number, stored as digits. Switch OFF: an
 * odd number is kept as typed and never blocks saving.
 */
export function checkWaRedirect(input: {
  enabled: boolean
  number: unknown
  fallback: unknown
}): WaRedirectCheck {
  const raw = typeof input.number === 'string' ? input.number.trim() : ''
  const fb = typeof input.fallback === 'string' ? input.fallback.trim() : ''
  const use = raw || fb
  if (!use) {
    return input.enabled
      ? { ok: false, message: 'Add the WhatsApp number that should receive the chats.' }
      : { ok: true, number: '' }
  }
  const c = checkPhone(use)
  if (c.ok) return { ok: true, number: raw ? c.digits : '' }
  return input.enabled ? { ok: false, message: c.message } : { ok: true, number: raw }
}

/** What the website visitor receives: ON only with the switch on AND a valid number. */
export function waRedirectView(config: Record<string, unknown>): {
  wa_redirect_enabled: boolean
  wa_redirect_number: string
} {
  const raw = typeof config.wa_redirect_number === 'string' ? config.wa_redirect_number.trim() : ''
  const use = raw || (typeof config.business_phone === 'string' ? config.business_phone : '')
  const c = use ? checkPhone(use) : null
  const on = config.wa_redirect_enabled === true && !!c && c.ok
  return { wa_redirect_enabled: on, wa_redirect_number: on && c && c.ok ? c.digits : '' }
}

export function isMissingWaRedirectColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  const message = typeof e.message === 'string' ? e.message : ''
  if (code !== '42703' && code !== 'PGRST204') return false
  return WA_REDIRECT_COLUMNS.some((c) => message.includes(c))
}

export function withoutWaRedirectColumns<T extends Record<string, unknown>>(payload: T): Omit<T, (typeof WA_REDIRECT_COLUMNS)[number]> {
  const copy: Record<string, unknown> = { ...payload }
  for (const c of WA_REDIRECT_COLUMNS) delete copy[c]
  return copy as Omit<T, (typeof WA_REDIRECT_COLUMNS)[number]>
}
