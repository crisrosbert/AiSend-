// src/lib/business/server.ts
//
// The server side of business resolution: read what the user owns, then
// apply the rules in resolve.ts.
//
// Kept separate from resolve.ts so the rules stay pure and testable and
// this file stays a thin database call. Every API route that touches
// tenant data should start with currentBusiness() and scope on what it
// returns.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveBusiness,
  businessFromCookieHeader,
  type BusinessRef,
} from './resolve'

// Re-exported so server callers have one import for business questions.
// The rule itself lives in parent.ts because it is not server-only.
export { businessIdForAgent, businessIdForJourney } from './parent'

/** Every business this user owns, default first. */
export async function listBusinesses(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<BusinessRef[]> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, is_default, logo_url')
    .eq('owner_user_id', userId)
    // Default first so resolve.ts's last-resort fallback (owned[0])
    // lands somewhere sensible even if the flag is missing entirely.
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[business] list failed:', error.message)
    return []
  }
  return (data ?? []) as BusinessRef[]
}

/**
 * Which business is this request acting on?
 *
 * Reads the cookie the switcher writes, checks it against what the user
 * actually owns, and falls back to their default. Returns null only
 * when the user owns nothing at all — which callers must handle rather
 * than assume away, because it is the state of every brand-new account
 * until migration 030 or the first sign-up flow creates one.
 */
export async function currentBusiness(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  request?: Request,
): Promise<BusinessRef | null> {
  const owned = await listBusinesses(supabase, userId)
  const requested = businessFromCookieHeader(request?.headers.get('cookie'))
  return resolveBusiness(requested, owned)
}

/** Id-only convenience, for the common `.eq('business_id', …)` case. */
export async function currentBusinessId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  request?: Request,
): Promise<string | null> {
  return (await currentBusiness(supabase, userId, request))?.id ?? null
}

/**
 * Get this user's business, creating one if they have none.
 *
 * For sign-up and for accounts that predate migration 030. Named
 * "ensure" rather than "get" because it writes — a caller should be
 * able to see that from the call site.
 *
 * Not used on read paths: a GET that silently creates rows makes a
 * bug's blast radius the whole table.
 */
export async function ensureBusiness(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  opts: { name?: string; orgId?: string | null } = {},
): Promise<BusinessRef | null> {
  const owned = await listBusinesses(supabase, userId)
  if (owned.length > 0) return resolveBusiness(null, owned)

  const { data, error } = await supabase
    .from('businesses')
    .insert({
      owner_user_id: userId,
      account_id: opts.orgId ?? null,
      name: opts.name?.trim() || 'My Business',
      is_default: true,
    })
    .select('id, name, is_default, logo_url')
    .single()

  if (error) {
    // The unique index on (owner_user_id) where is_default means a race
    // between two requests loses here rather than creating a second
    // default. Re-read instead of failing: the other request already
    // did the work.
    console.warn('[business] create failed, re-reading:', error.message)
    return resolveBusiness(null, await listBusinesses(supabase, userId))
  }

  return data as BusinessRef
}
