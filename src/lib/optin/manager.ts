// src/lib/optin/manager.ts
//
// Opt-in / opt-out management — the compliance layer that keeps your
// number safe. Handles STOP/START keywords, records consent with an
// audit trail, and exposes helpers the broadcast sender uses to filter
// to ONLY opted-in contacts.

import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null
function db() {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _db
}

// Keywords a customer can send to opt out / opt back in.
const OPT_OUT_WORDS = ['stop', 'unsubscribe', 'opt out', 'optout', 'band karo', 'ruko']
const OPT_IN_WORDS = ['start', 'subscribe', 'yes', 'haan', 'ha', 'opt in', 'optin']

export type OptInStatus = 'opted_in' | 'opted_out' | 'pending' | 'unknown'

/** Record an opt-in or opt-out, updating the contact + writing an audit row. */
export async function recordConsent(params: {
  userId: string
  contactId: string
  phone?: string
  event: 'opt_in' | 'opt_out'
  source: string
  note?: string
}): Promise<void> {
  const { userId, contactId, phone, event, source, note } = params
  const now = new Date().toISOString()

  const patch =
    event === 'opt_in'
      ? { opt_in_status: 'opted_in', opt_in_source: source, opt_in_at: now, opt_out_at: null }
      : { opt_in_status: 'opted_out', opt_out_at: now }

  await db().from('contacts').update(patch).eq('id', contactId)

  await db().from('optin_events').insert({
    user_id: userId,
    contact_id: contactId,
    phone: phone ?? null,
    event,
    source,
    note: note ?? null,
    created_at: now,
  })
}

/**
 * Inspect an inbound message for STOP/START intent. Returns the detected
 * event (or null). Call this from the WhatsApp webhook on inbound text so
 * opt-outs are honored INSTANTLY (required by policy + protects rating).
 */
export function detectConsentKeyword(text: string): 'opt_in' | 'opt_out' | null {
  const t = (text || '').trim().toLowerCase()
  if (!t) return null
  if (OPT_OUT_WORDS.some((w) => t === w || t.startsWith(w))) return 'opt_out'
  if (OPT_IN_WORDS.some((w) => t === w)) return 'opt_in'
  return null
}

/**
 * Handle a consent keyword end-to-end from the webhook: record it and,
 * for opt-out, that's it (don't message them again). Returns true if a
 * keyword was handled (so the webhook can skip other processing).
 */
export async function handleInboundConsent(params: {
  userId: string
  contactId: string
  phone: string
  inboundText: string
}): Promise<boolean> {
  const event = detectConsentKeyword(params.inboundText)
  if (!event) return false
  await recordConsent({
    userId: params.userId,
    contactId: params.contactId,
    phone: params.phone,
    event,
    source: 'whatsapp_reply',
    note: `keyword: ${params.inboundText.slice(0, 40)}`,
  })
  return true
}

/**
 * SAFETY GUARD for broadcasts. Given a list of contactIds a user wants to
 * broadcast to, returns ONLY the ones that are opted in — plus a report
 * of who was filtered out and why. The broadcast sender MUST call this
 * and send only to `allowed`.
 */
export async function filterOptedInContacts(
  userId: string,
  contactIds: string[],
): Promise<{
  allowed: string[]
  blocked: { contactId: string; reason: string }[]
}> {
  if (contactIds.length === 0) return { allowed: [], blocked: [] }

  const { data: rows, error } = await db()
    .from('contacts')
    .select('id, opt_in_status')
    .eq('user_id', userId)
    .in('id', contactIds)

  if (error || !rows) {
    // Fail CLOSED — if we can't verify consent, send to no one.
    return { allowed: [], blocked: contactIds.map((c) => ({ contactId: c, reason: 'consent check failed' })) }
  }

  const allowed: string[] = []
  const blocked: { contactId: string; reason: string }[] = []
  for (const r of rows as { id: string; opt_in_status: string }[]) {
    if (r.opt_in_status === 'opted_in') {
      allowed.push(r.id)
    } else {
      blocked.push({ contactId: r.id, reason: `not opted in (${r.opt_in_status})` })
    }
  }
  return { allowed, blocked }
}
