// src/lib/tools/lead-form.ts
//
// The "request a call back" form on the free-tool pages. Pure logic only —
// validation, the request to /api/leads/capture, and the WhatsApp hand-off —
// so each piece can be tested without a browser.
//
// Leads go through the same door every other source uses (see
// src/app/api/leads/capture/route.ts): one lead per phone number, linked to
// the CRM, rate-limited, with a hidden honeypot field for bots.

import { buildWhatsAppLink } from './wa-link'

export const LEAD_INTERESTS = [
  'WhatsApp broadcasts',
  'Chatbot and auto-replies',
  'WhatsApp Business API setup',
  'Shared team inbox',
  'Just exploring',
] as const

export interface LeadFormInput {
  name: string
  countryCode: string
  phone: string
  email: string
  interest: string
  message: string
  consent: boolean
}

export interface CleanLead {
  name: string
  /** Country code + number, digits only. */
  phone: string
  email: string | null
  interest: string | null
  message: string | null
}

export type LeadFormErrors = Partial<Record<'name' | 'phone' | 'email' | 'consent', string>>

export type ValidationResult =
  | { ok: true; value: CleanLead }
  | { ok: false; errors: LeadFormErrors }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateLeadForm(input: LeadFormInput): ValidationResult {
  const errors: LeadFormErrors = {}

  const name = input.name.trim()
  if (name.length < 2) errors.name = 'Enter your name'

  const number = buildWhatsAppLink({ countryCode: input.countryCode, phone: input.phone })
  if (!number.ok) {
    errors.phone =
      number.reason === 'empty'
        ? 'Enter your mobile number'
        : number.reason === 'too-short'
          ? 'That number looks too short — check the country code and digits'
          : 'That number looks too long — check the country code and digits'
  }

  const email = input.email.trim()
  if (email && !EMAIL.test(email)) errors.email = 'Enter a valid email, or leave it blank'

  if (!input.consent) errors.consent = 'Please agree so we can contact you'

  if (Object.keys(errors).length > 0 || !number.ok) return { ok: false, errors }

  return {
    ok: true,
    value: {
      name,
      phone: number.number,
      email: email || null,
      interest: input.interest.trim() || null,
      message: input.message.trim() || null,
    },
  }
}

export type SubmitResult = { ok: true } | { ok: false; error: string }

export async function submitLead(opts: {
  lead: CleanLead
  /** Value of the hidden "website" field. Humans never see it; bots fill it. */
  honeypot: string
  /** Public lead-source key (pk_…). Safe to ship in page source. */
  key: string
  pageUrl: string
  form: string
  /** Extra attribution (utm_*, referrer, …). Empty values are dropped. */
  extra?: Record<string, string | undefined>
  fetchFn?: typeof fetch
}): Promise<SubmitResult> {
  const { lead, honeypot, key, pageUrl, form, extra = {}, fetchFn = fetch } = opts

  // A bot that filled the trap field is told it worked, so it moves on
  // without learning which field gave it away.
  if (honeypot.trim()) return { ok: true }

  const body: Record<string, string> = {
    key,
    name: lead.name,
    phone: `+${lead.phone}`,
    form,
    page_url: pageUrl,
  }
  if (lead.email) body.email = lead.email
  if (lead.interest) body.interest = lead.interest
  if (lead.message) body.message = lead.message
  for (const [k, v] of Object.entries(extra)) if (v) body[k] = v

  const generic = 'We could not send that just now. Please try again, or message us on WhatsApp.'
  try {
    const res = await fetchFn('/api/leads/capture', {
      method: 'POST',
      // text/plain keeps this a "simple" request: no CORS preflight, and the
      // lead still goes out if the visitor navigates away right after tapping.
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    })
    const reply = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (res.ok && reply?.ok) return { ok: true }
    return { ok: false, error: reply?.error || generic }
  } catch {
    return { ok: false, error: generic }
  }
}

/**
 * A WhatsApp chat to the team, pre-filled with the visitor's details. Used
 * when no capture key is configured, and as the "prefer to chat?" option next
 * to the form — the message itself is the lead, and says where it came from.
 */
export function buildWhatsAppLeadLink(opts: { to: string; lead: CleanLead; source: string }): string {
  const { to, lead, source } = opts
  const lines = [
    `Hi, I'm ${lead.name} (+${lead.phone}).`,
    lead.interest ? `I'm interested in: ${lead.interest}.` : null,
    lead.message,
    lead.email ? `Email: ${lead.email}` : null,
    '',
    `Sent from the ${source}`,
  ].filter((l): l is string => l !== null)

  const result = buildWhatsAppLink({ countryCode: '', phone: `+${to}`, message: lines.join('\n') })
  // `to` is our own constant; an invalid one is a programming error.
  if (!result.ok) throw new Error(`Invalid WhatsApp number for lead hand-off: ${to}`)
  return result.link
}
