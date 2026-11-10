// src/lib/optin/manager.ts
//
// Opt-in / opt-out management — the compliance layer that keeps your
// number safe. Handles STOP/START keywords, records consent with an
// audit trail, and exposes helpers the broadcast sender uses to filter
// to ONLY opted-in contacts.
//
// ── ISSUE-2 FIX (v3) ─────────────────────────────────────────────────
// Before: any message that STARTED with "stop" (e.g. "stop the booking")
// was an opt-out, and plain "yes" / "haan" / "ha" was always an opt-in.
// The webhook returns early on a handled consent message, so the
// customer got no answer at all.
//
// Now:
//   * Opt-out is an EXACT match of a small phrase set after normalising
//     (lower-case, punctuation/emoji stripped, spaces collapsed).
//     "STOP." and "stop!!" are opt-outs; "stop the booking" is not.
//     "ruko" (= "wait") is NOT an opt-out any more.
//   * Explicit opt-in words (start / subscribe / opt in) still work as an
//     exact match.
//   * Casual words (yes / haan / ha / ok ...) count as opt-in ONLY when
//     the contact is not already opted in AND our previous outbound
//     message looked like a consent request. Otherwise they fall through
//     to journeys / the agent like any other message.
//   * Repeating the same keyword does not write a second audit row.
//
// Policy note (verified on Meta's "Get Opt-in for WhatsApp" page): Meta
// requires clear opt-in that names the business, and says businesses
// should give clear opt-out instructions and honor them. It does not
// prescribe a keyword list, so the list below is a product decision.

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

// Whole-message phrases (already normalised) that mean "stop messaging me".
// "ruko" was removed on purpose: it means "wait / hold on" and is used
// mid-conversation all the time. "band karo" is kept: as a whole message
// it reads as "stop it".
const OPT_OUT_PHRASES: ReadonlySet<string> = new Set([
  'stop',
  'stop all',
  'stopall',
  'unsubscribe',
  'opt out',
  'optout',
  'band karo',
])

// Explicit opt-in words: valid as a whole message at any time.
const EXPLICIT_OPT_IN_PHRASES: ReadonlySet<string> = new Set([
  'start',
  'subscribe',
  'opt in',
  'optin',
])

// Casual agreement words: only an opt-in when answering a consent request.
const CASUAL_OPT_IN_PHRASES: ReadonlySet<string> = new Set([
  'yes',
  'y',
  'yes please',
  'haan',
  'haa',
  'han',
  'ha',
  'haan ji',
  'ok',
  'okay',
])

export type OptInStatus = 'opted_in' | 'opted_out' | 'pending' | 'unknown'

/**
 * Lower-case, NFKC-normalise, replace punctuation / emoji / symbols with
 * spaces and collapse whitespace. "STOP." -> "stop", "Opt-out!" -> "opt out".
 */
export function normalizeConsentText(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when a database error says column `column` does not exist
 * (Postgres 42703 "column ... does not exist", or PostgREST PGRST204
 * "Could not find the '...' column ... in the schema cache").
 */
export function isMissingColumnError(
  err: { code?: string | null; message?: string | null } | null | undefined,
  column: string,
): boolean {
  if (!err) return false
  const msg = (err.message ?? '').toLowerCase()
  if (!msg.includes(column.toLowerCase())) return false
  return err.code === '42703' || err.code === 'PGRST204' || /does not exist|could not find/.test(msg)
}

/**
 * Update the contact row. If the ONLY problem is that the optional
 * `opted_out_at` column is missing, retry once without it so the
 * essential fields (opt_in_status, opt_out_at) are still saved.
 * Any other error is returned unchanged.
 */
async function updateContactConsent(
  contactId: string,
  patch: Record<string, unknown>,
): Promise<{ error: { code?: string | null; message: string } | null }> {
  const first = await db().from('contacts').update(patch).eq('id', contactId)
  if (first.error && 'opted_out_at' in patch && isMissingColumnError(first.error, 'opted_out_at')) {
    console.warn('[optin] contacts.opted_out_at missing, retrying without it (run migration 040)')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { opted_out_at: _skip, ...rest } = patch
    return db().from('contacts').update(rest).eq('id', contactId)
  }
  return first
}

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

  // `opted_out_at` is the column the contacts page, resend-unread and the
  // campaign audience filters read. `opt_out_at` is the older column this
  // file always wrote. Write both so a WhatsApp STOP shows up everywhere.
  // `opted_out_at` is optional: if the database has no such column the
  // update is retried without it (see updateContactConsent).
  const patch: Record<string, unknown> =
    event === 'opt_in'
      ? {
          opt_in_status: 'opted_in',
          opt_in_source: source,
          opt_in_at: now,
          opt_out_at: null,
          opted_out_at: null,
        }
      : { opt_in_status: 'opted_out', opt_out_at: now, opted_out_at: now }

  const { error: updErr } = await updateContactConsent(contactId, patch)
  if (updErr) console.error('[optin] contact update failed:', updErr.message)

  const { error: evErr } = await db().from('optin_events').insert({
    user_id: userId,
    contact_id: contactId,
    phone: phone ?? null,
    event,
    source,
    note: note ?? null,
    created_at: now,
  })
  if (evErr) console.error('[optin] audit insert failed:', evErr.message)
}

/**
 * Inspect an inbound message for an UNAMBIGUOUS STOP/START intent.
 * Returns 'opt_out' for an exact stop phrase, 'opt_in' for an exact
 * explicit opt-in phrase (start / subscribe / opt in), else null.
 *
 * Casual words like "yes" / "haan" return null here on purpose: whether
 * they mean consent depends on context. See decideConsentAction().
 */
export function detectConsentKeyword(text: string): 'opt_in' | 'opt_out' | null {
  const t = normalizeConsentText(text)
  if (!t) return null
  if (OPT_OUT_PHRASES.has(t)) return 'opt_out'
  if (EXPLICIT_OPT_IN_PHRASES.has(t)) return 'opt_in'
  return null
}

/** True for a bare casual agreement word ("yes", "haan", "ha", "ok" ...). */
export function isCasualOptInReply(text: string): boolean {
  return CASUAL_OPT_IN_PHRASES.has(normalizeConsentText(text))
}

const CONSENT_TERMS =
  /\b(opt in|optin|subscribe|subscription|consent|permission|updates?|offers?|notifications?|alerts?|promotions?|newsletter)\b/
const ASK_TERMS =
  /\b(reply|send|type|text|say|respond|confirm|press|tap|likhein|likho|bhejein|bhejo)\b/

/**
 * Heuristic: does this OUTBOUND message look like a request for consent
 * to receive messages? Needs both a consent-ish word (updates, offers,
 * subscribe, opt in, ...) and a call to reply. A booking question such as
 * "Shall I confirm your 5pm slot? Reply yes" does NOT match.
 *
 * It is a heuristic because no code in this repo sends consent prompts
 * (merchants write their own template text). If the prompt text is not
 * stored in messages.content_text it will not match, and a casual "yes"
 * then simply falls through to the normal bot flow — the safe default.
 */
export function looksLikeConsentRequest(text: string | null | undefined): boolean {
  const t = normalizeConsentText(text)
  if (!t) return false
  return CONSENT_TERMS.test(t) && ASK_TERMS.test(t)
}

/**
 * Pure decision: given the inbound text, the contact's current consent
 * status and the previous outbound message, what consent event (if any)
 * should be recorded? null means "not a consent message, carry on".
 */
export function decideConsentAction(input: {
  text: string
  optInStatus: string | null | undefined
  lastOutboundText: string | null | undefined
}): 'opt_in' | 'opt_out' | null {
  const exact = detectConsentKeyword(input.text)
  if (exact) return exact
  if (!isCasualOptInReply(input.text)) return null
  if (input.optInStatus === 'opted_in') return null // already consented
  if (!looksLikeConsentRequest(input.lastOutboundText)) return null
  return 'opt_in'
}

/** Current opt_in_status of a contact, or undefined if it cannot be read. */
async function readContactStatus(contactId: string): Promise<string | null | undefined> {
  const { data, error } = await db()
    .from('contacts')
    .select('opt_in_status')
    .eq('id', contactId)
    .maybeSingle()
  if (error) {
    console.warn('[optin] status read failed:', error.message)
    return undefined
  }
  return (data?.opt_in_status as string | null | undefined) ?? null
}

/** Text of the most recent message WE sent to this contact, if any. */
async function readLastOutboundText(userId: string, contactId: string): Promise<string | null> {
  const { data: conv, error: convErr } = await db()
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (convErr || !conv) return null

  const { data: msg, error: msgErr } = await db()
    .from('messages')
    .select('content_text')
    .eq('conversation_id', conv.id)
    .in('sender_type', ['agent', 'bot', 'system'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (msgErr || !msg) return null
  return (msg.content_text as string | null) ?? null
}

/**
 * Handle a consent keyword end-to-end from the webhook: record it and,
 * for opt-out, that's it (don't message them again). Returns true ONLY
 * if the message was consumed as a consent message (so the webhook skips
 * journeys/agents); false means "treat it like any other message".
 */
export async function handleInboundConsent(params: {
  userId: string
  contactId: string
  phone: string
  inboundText: string
}): Promise<boolean> {
  const t = normalizeConsentText(params.inboundText)
  // Fast path: almost every message is neither a keyword nor a casual
  // reply, so no database query is made for them.
  if (!t || (!OPT_OUT_PHRASES.has(t) && !EXPLICIT_OPT_IN_PHRASES.has(t) && !CASUAL_OPT_IN_PHRASES.has(t))) {
    return false
  }

  const status = await readContactStatus(params.contactId)
  const exact = detectConsentKeyword(params.inboundText)

  let event: 'opt_in' | 'opt_out' | null
  if (exact) {
    event = exact
  } else {
    // Casual word. If we cannot read the status, do NOT guess: fall through.
    if (status === undefined) return false
    const lastOutbound = status === 'opted_in' ? null : await readLastOutboundText(params.userId, params.contactId)
    event = decideConsentAction({
      text: params.inboundText,
      optInStatus: status,
      lastOutboundText: lastOutbound,
    })
  }
  if (!event) return false

  // Idempotency.
  //  - STOP from someone already opted out: nothing to write, but still
  //    swallow it (never message them again).
  //  - START from someone already opted in: nothing to do, let the normal
  //    flow answer it.
  if (event === 'opt_out' && status === 'opted_out') return true
  if (event === 'opt_in' && status === 'opted_in') return false

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

/**
 * PHONE-based broadcast guard (for routes that work with phone numbers
 * rather than contactIds, like the WhatsApp broadcast route).
 *
 * Given the phones a user wants to broadcast to, returns which are
 * allowed vs blocked. Strictness:
 *   - mode 'block_opted_out' (default): blocks ONLY phones whose contact
 *     is opted_out. Honors STOP (legally required) without breaking
 *     sends to not-yet-tagged contacts.
 *   - mode 'require_opted_in': allows ONLY phones whose contact is
 *     opted_in. Strictest — use once your warm contacts are tagged.
 *
 * Matching is done on the raw phone plus its digits, to tolerate small
 * format differences between the broadcast list and the contacts table.
 */
export async function filterBroadcastPhones(
  userId: string,
  phones: string[],
  mode: 'block_opted_out' | 'require_opted_in' = 'block_opted_out',
): Promise<{
  allowed: string[]
  blocked: { phone: string; reason: string }[]
}> {
  if (phones.length === 0) return { allowed: [], blocked: [] }

  // Pull this user's contacts with their opt-in status.
  const { data: rows, error } = await db()
    .from('contacts')
    .select('phone, opt_in_status')
    .eq('user_id', userId)

  if (error) {
    // Fail closed only for the strict mode; for block_opted_out we can't
    // safely block, so allow (STOP handling still happened at inbound).
    if (mode === 'require_opted_in') {
      return { allowed: [], blocked: phones.map((p) => ({ phone: p, reason: 'consent check failed' })) }
    }
    return { allowed: phones, blocked: [] }
  }

  const digits = (s: string) => (s || '').replace(/\D/g, '')
  // Build a status map keyed by digit-only phone.
  const statusByDigits = new Map<string, string>()
  for (const r of (rows || []) as { phone: string; opt_in_status: string }[]) {
    statusByDigits.set(digits(r.phone), r.opt_in_status)
  }

  const allowed: string[] = []
  const blocked: { phone: string; reason: string }[] = []
  for (const p of phones) {
    const status = statusByDigits.get(digits(p)) // may be undefined (not a known contact)
    if (mode === 'require_opted_in') {
      if (status === 'opted_in') allowed.push(p)
      else blocked.push({ phone: p, reason: `not opted in (${status ?? 'unknown'})` })
    } else {
      // block_opted_out
      if (status === 'opted_out') blocked.push({ phone: p, reason: 'opted out' })
      else allowed.push(p)
    }
  }
  return { allowed, blocked }
}
