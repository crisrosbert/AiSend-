// src/lib/meta/tenant-lookup.ts
//
// Maps a Meta user id back to the AiSend account it belongs to.
//
// Both Meta callbacks need this — Data Deletion to know whose data to
// remove, Deauthorize to know whose connection to close — and getting
// it wrong in either means acting on the wrong business's account. One
// implementation, used twice, is the version that can be fixed once.

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Find the tenant behind a Facebook user id.
 *
 * Supabase keeps OAuth identities in the `auth` schema, which PostgREST
 * does not expose, so this goes through the admin API and pages until
 * it finds a match.
 *
 * Honest about its limits: this is fine for the scale the product
 * launches at and linear in the number of accounts. Past a few thousand
 * users, store the provider id on `profiles` at sign-up and look it up
 * directly — the callback is on a clock, and Meta retries a slow one.
 *
 * Returns null when nobody matches, which is a legitimate outcome: a
 * person may have used Facebook Login once and never finished creating
 * an account. Callers must treat null as "nothing to do", never as an
 * error worth failing the request over.
 */
export async function findTenantByFacebookId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  metaUserId: string,
): Promise<string | null> {
  if (!metaUserId) return null

  try {
    const PER_PAGE = 1000
    const MAX_PAGES = 20 // 20,000 accounts; a bound, not a target

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: PER_PAGE })
      if (error) {
        console.error('[meta/tenant-lookup] listUsers failed:', error.message)
        return null
      }

      const users = data?.users ?? []
      for (const user of users) {
        for (const identity of user.identities ?? []) {
          // `identity.id` is the provider's own id for the person —
          // exactly what Meta puts in the signed request.
          if (identity.provider === 'facebook' && String(identity.id) === metaUserId) {
            return user.id
          }
        }
      }

      // A short page means the last page.
      if (users.length < PER_PAGE) break
    }

    return null
  } catch (err) {
    console.error('[meta/tenant-lookup] failed:', err)
    return null
  }
}
