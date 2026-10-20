// Server-side audience + recipient preparation for the Campaign Agent and for
// /api/broadcasts/send. Mirrors the dashboard's resolver (all / tags /
// exclude tags / created + last-seen recency / opt-out filter) so a send made
// here reaches the same people the wizard's estimate promised.
//
// Uses the service-role client, so EVERY query below is scoped by hand to the
// tenant (user_id, plus business_id when known). Do not remove those filters.

import type { SupabaseClient } from '@supabase/supabase-js'
import { isPermanentFailure, isRetryableFailure } from './retry'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

export interface RecencyFilter {
  preset?: '24h' | '7d' | '30d'
}

export interface CampaignAudience {
  type: 'all' | 'tags' | 'contacts'
  /** type 'contacts': hand-picked people. */
  contactIds?: string[]
  tagIds?: string[]
  excludeTagIds?: string[]
  createdWithin?: RecencyFilter
  lastSeenWithin?: RecencyFilter
}

export interface AudienceContact {
  id: string
  phone: string
  name: string | null
}

/** Accepts whatever the browser sends and returns a safe audience. */
export function cleanAudience(raw: unknown): CampaignAudience {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 50) : undefined)
  const preset = (v: unknown): RecencyFilter | undefined => {
    const p = (v as { preset?: string } | undefined)?.preset
    return p === '24h' || p === '7d' || p === '30d' ? { preset: p } : undefined
  }
  const picked = Array.isArray(r.contactIds)
    ? [...new Set(r.contactIds.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64))].slice(0, MAX_PICKED)
    : undefined
  return {
    type: r.type === 'tags' ? 'tags' : r.type === 'contacts' ? 'contacts' : 'all',
    contactIds: r.type === 'contacts' ? picked : undefined,
    tagIds: ids(r.tagIds),
    excludeTagIds: ids(r.excludeTagIds),
    createdWithin: preset(r.createdWithin),
    lastSeenWithin: preset(r.lastSeenWithin),
  }
}

export const MAX_PICKED = 1000

export type FollowupRule = 'not_read' | 'no_reply'

const PAGE = 1000

export function recencyFrom(f: RecencyFilter | undefined, now = new Date()): string | null {
  if (!f?.preset) return null
  const days = f.preset === '24h' ? 1 : f.preset === '7d' ? 7 : 30
  return new Date(now.getTime() - days * 24 * 3600_000).toISOString()
}

/** First name for {{1}}, with a polite fallback so a blank name never leaves a hole. */
export function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim().split(/\s+/)[0] ?? ''
  const clean = n.replace(/[^\p{L}\p{N}'’.-]/gu, '').slice(0, 30)
  return clean || 'there'
}

export function usablePhone(phone: string | null | undefined): boolean {
  if (!phone || /^web/i.test(phone)) return false
  const d = phone.replace(/\D/g, '')
  return d.length >= 8 && d.length <= 15
}

async function pageAll<T>(run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
    if (out.length > 200_000) throw new Error('Audience too large for one campaign.')
  }
  return out
}

interface ContactRow {
  id: string
  phone: string | null
  name: string | null
  created_at: string | null
  opted_out_at?: string | null
  opt_in_status?: string | null
}

export async function resolveAudience(
  db: Db,
  scope: { userId: string; businessId?: string | null },
  audience: CampaignAudience,
  now = new Date(),
): Promise<{ contacts: AudienceContact[]; skippedOptOut: number }> {
  let rows: ContactRow[] = []

  if (audience.type === 'contacts') {
    const ids = audience.contactIds ?? []
    for (let i = 0; i < ids.length; i += 200) {
      let q = db
        .from('contacts')
        .select('id, phone, name, created_at, opted_out_at, opt_in_status')
        .eq('user_id', scope.userId)
        .in('id', ids.slice(i, i + 200))
      if (scope.businessId) q = q.eq('business_id', scope.businessId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      rows.push(...((data ?? []) as ContactRow[]))
    }
  } else if (audience.type === 'tags') {
    const tagIds = audience.tagIds ?? []
    if (tagIds.length === 0) return { contacts: [], skippedOptOut: 0 }
    const links = await pageAll<{ contact_id: string }>((f, t) =>
      db.from('contact_tags').select('contact_id').in('tag_id', tagIds).range(f, t),
    )
    const ids = [...new Set(links.map((l) => l.contact_id))]
    for (let i = 0; i < ids.length; i += 200) {
      let q = db
        .from('contacts')
        .select('id, phone, name, created_at, opted_out_at, opt_in_status')
        .eq('user_id', scope.userId)
        .in('id', ids.slice(i, i + 200))
      if (scope.businessId) q = q.eq('business_id', scope.businessId)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      rows.push(...((data ?? []) as ContactRow[]))
    }
  } else {
    rows = await pageAll<ContactRow>((f, t) => {
      let q = db
        .from('contacts')
        .select('id, phone, name, created_at, opted_out_at, opt_in_status')
        .eq('user_id', scope.userId)
        .order('created_at', { ascending: true })
        .range(f, t)
      if (scope.businessId) q = q.eq('business_id', scope.businessId)
      return q
    })
  }

  if (audience.excludeTagIds?.length) {
    const ex = await pageAll<{ contact_id: string }>((f, t) =>
      db.from('contact_tags').select('contact_id').in('tag_id', audience.excludeTagIds!).range(f, t),
    )
    const exSet = new Set(ex.map((e) => e.contact_id))
    rows = rows.filter((r) => !exSet.has(r.id))
  }

  const createdFrom = recencyFrom(audience.createdWithin, now)
  if (createdFrom) rows = rows.filter((r) => !!r.created_at && r.created_at >= createdFrom)

  const seenFrom = recencyFrom(audience.lastSeenWithin, now)
  if (seenFrom && rows.length) {
    const active = new Set<string>()
    for (let i = 0; i < rows.length; i += 200) {
      const { data } = await db
        .from('conversations')
        .select('contact_id')
        .in('contact_id', rows.slice(i, i + 200).map((r) => r.id))
        .gte('last_message_at', seenFrom)
      for (const c of data ?? []) active.add(c.contact_id)
    }
    rows = rows.filter((r) => active.has(r.id))
  }

  // Compliance: opted-out contacts are never messaged, however they got here.
  const before = rows.length
  rows = rows.filter((r) => !r.opted_out_at && r.opt_in_status !== 'opted_out')
  const skippedOptOut = before - rows.length

  const seen = new Set<string>()
  const contacts: AudienceContact[] = []
  for (const r of rows) {
    if (!usablePhone(r.phone)) continue
    const key = (r.phone as string).replace(/\D/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    contacts.push({ id: r.id, phone: r.phone as string, name: r.name })
  }
  return { contacts, skippedOptOut }
}

export interface RecipientRow {
  contact_id: string | null
  status: string
  error_message?: string | null
}

const REACHED = ['sent', 'delivered', 'read', 'replied']

/**
 * Pure: which contacts a follow-up should go to.
 *  - not_read: reached, but never read or replied.
 *  - no_reply: reached (read or not), but never replied.
 *  - rollover: also people the message never reached (a failure that is not
 *    permanent, e.g. not a WhatsApp number), so they join the next step.
 */
export function selectFollowupIds(rows: RecipientRow[], rule: FollowupRule, rollover = false): string[] {
  const byContact = new Map<string, RecipientRow[]>()
  for (const r of rows) {
    if (!r.contact_id) continue
    byContact.set(r.contact_id, [...(byContact.get(r.contact_id) ?? []), r])
  }
  const stop = rule === 'not_read' ? ['read', 'replied'] : ['replied']
  const out: string[] = []
  for (const [id, list] of byContact) {
    const statuses = list.map((r) => r.status)
    if (statuses.some((s) => stop.includes(s))) continue
    if (statuses.some((s) => REACHED.includes(s))) { out.push(id); continue }
    if (rollover && !statuses.includes('pending') && list.some((r) => r.status === 'failed' && !isPermanentFailure(r.error_message))) out.push(id)
  }
  return out
}

/** Pure: contacts whose delivery failed for a temporary reason (worth one more try). */
export function selectRetryIds(rows: RecipientRow[]): string[] {
  const reached = new Set(rows.filter((r) => r.contact_id && REACHED.includes(r.status)).map((r) => r.contact_id as string))
  return [...new Set(rows.filter((r) => r.contact_id && r.status === 'failed' && !reached.has(r.contact_id) && isRetryableFailure(r.error_message)).map((r) => r.contact_id as string))]
}

async function contactsByIds(db: Db, userId: string, ids: string[]): Promise<AudienceContact[]> {
  const out: AudienceContact[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from('contacts')
      .select('id, phone, name, opted_out_at, opt_in_status')
      .eq('user_id', userId)
      .in('id', ids.slice(i, i + 200))
    if (error) throw new Error(error.message)
    for (const c of (data ?? []) as ContactRow[]) {
      // Opt-outs that arrived since the first message are removed here.
      if (c.opted_out_at || c.opt_in_status === 'opted_out' || !usablePhone(c.phone)) continue
      out.push({ id: c.id, phone: c.phone as string, name: c.name })
    }
  }
  return out
}

async function recipientRows(db: Db, broadcastIds: string[]): Promise<RecipientRow[]> {
  return pageAll<RecipientRow>((f, t) =>
    db.from('broadcast_recipients').select('contact_id, status, error_message').in('broadcast_id', broadcastIds).range(f, t),
  )
}

/** Who a follow-up goes to (see selectFollowupIds). */
export async function followupContacts(
  db: Db,
  scope: { userId: string },
  previousBroadcastIds: string[],
  rule: FollowupRule,
  rollover = false,
): Promise<AudienceContact[]> {
  if (previousBroadcastIds.length === 0) return []
  const rows = await recipientRows(db, previousBroadcastIds)
  return contactsByIds(db, scope.userId, selectFollowupIds(rows, rule, rollover))
}

/** Who failed for a temporary reason in this broadcast. */
export async function retryContacts(db: Db, scope: { userId: string }, broadcastId: string): Promise<AudienceContact[]> {
  const rows = await recipientRows(db, [broadcastId])
  return contactsByIds(db, scope.userId, selectRetryIds(rows))
}

/**
 * Writes the recipient rows (with their template params already resolved) and
 * hands the broadcast to the existing sender.
 *
 * Handing over: the sweep's phase 2 sends every 'sending' broadcast whose
 * updated_at is older than STALL_MINUTES (5), through /api/whatsapp/broadcast,
 * which owns opt-out, credits, phone variants and write-back. So the broadcast
 * is marked 'sending' with updated_at set 6 minutes back and the next sweep
 * picks it up. That keeps ONE billing path.
 *
 * Safe to call twice: if recipient rows already exist, it writes nothing.
 */
export async function prepareRecipients(
  db: Db,
  broadcastId: string,
  contacts: AudienceContact[],
  paramsFor: (c: AudienceContact) => string[],
): Promise<number> {
  const { count } = await db.from('broadcast_recipients').select('id', { count: 'exact', head: true }).eq('broadcast_id', broadcastId)
  if ((count ?? 0) === 0) {
    for (let i = 0; i < contacts.length; i += 200) {
      const { error } = await db.from('broadcast_recipients').insert(
        contacts.slice(i, i + 200).map((c) => ({
          broadcast_id: broadcastId,
          contact_id: c.id,
          status: 'pending',
          params: paramsFor(c),
        })),
      )
      if (error) throw new Error(`Could not queue recipients: ${error.message}`)
    }
  }
  const handoverAt = new Date(Date.now() - 6 * 60_000).toISOString()
  await db
    .from('broadcasts')
    .update({ status: 'sending', total_recipients: contacts.length, updated_at: handoverAt })
    .eq('id', broadcastId)
  return contacts.length
}
