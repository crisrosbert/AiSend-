// src/lib/meta/tenant-lookup.test.ts
//
// The bug: Embedded Signup clients who registered with e-mail + password have
// no Facebook identity in Supabase auth, so Meta's deletion callback matched
// nobody and recorded "no_data" while their data stayed put. The Meta user id
// saved on whatsapp_config at signup must be enough to find them.

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { findTenantByFacebookId } from './tenant-lookup'

type ConfigRow = { user_id: string; meta_user_id: string | null }
type AuthUser = { id: string; identities?: Array<{ provider: string; id: string }> }

/** Just enough of the Supabase client for the two queries tenant-lookup makes. */
function fakeDb(opts: {
  configs?: ConfigRow[]
  configsError?: { message: string }
  users?: AuthUser[]
}) {
  const listUsers = vi.fn(async () => ({ data: { users: opts.users ?? [] }, error: null }))
  const tablesQueried: string[] = []

  const db = {
    from(table: string) {
      tablesQueried.push(table)
      const filters: Array<[string, unknown]> = []
      const query = {
        select: () => query,
        eq: (col: string, val: unknown) => {
          filters.push([col, val])
          return query
        },
        limit: () => query,
        then(resolve: (r: { data: unknown; error: unknown }) => unknown) {
          if (opts.configsError) return resolve({ data: null, error: opts.configsError })
          const rows = (opts.configs ?? []).filter((r) =>
            filters.every(([col, val]) => (r as Record<string, unknown>)[col] === val),
          )
          return resolve({ data: rows, error: null })
        },
      }
      return query
    },
    auth: { admin: { listUsers } },
  }
  return { db: db as unknown as SupabaseClient, listUsers, tablesQueried }
}

describe('findTenantByFacebookId', () => {
  it('finds an e-mail-signup client through the Meta user id saved at Embedded Signup', async () => {
    const { db, listUsers, tablesQueried } = fakeDb({
      configs: [
        { user_id: 'tenant-other', meta_user_id: '111' },
        { user_id: 'tenant-email-signup', meta_user_id: '222' },
      ],
      users: [{ id: 'tenant-email-signup', identities: [{ provider: 'email', id: 'abc' }] }],
    })

    expect(await findTenantByFacebookId(db, '222')).toBe('tenant-email-signup')
    expect(tablesQueried).toEqual(['whatsapp_config'])
    expect(listUsers).not.toHaveBeenCalled() // direct lookup, no scan of every account
  })

  it('still finds Facebook-login users by their auth identity when no connection row carries the id', async () => {
    const { db } = fakeDb({
      configs: [{ user_id: 'tenant-x', meta_user_id: '111' }],
      users: [
        { id: 'tenant-email', identities: [{ provider: 'email', id: '333' }] }, // same number, wrong provider
        { id: 'tenant-fb', identities: [{ provider: 'facebook', id: '333' }] },
      ],
    })
    expect(await findTenantByFacebookId(db, '333')).toBe('tenant-fb')
  })

  it('falls back to the identity scan instead of failing when the connection lookup errors', async () => {
    // e.g. the meta_user_id column has not been migrated yet
    const { db } = fakeDb({
      configsError: { message: 'column whatsapp_config.meta_user_id does not exist' },
      users: [{ id: 'tenant-fb', identities: [{ provider: 'facebook', id: '444' }] }],
    })
    expect(await findTenantByFacebookId(db, '444')).toBe('tenant-fb')
  })

  it('returns null when nobody matches', async () => {
    const { db } = fakeDb({
      configs: [{ user_id: 'tenant-x', meta_user_id: '111' }],
      users: [{ id: 'tenant-fb', identities: [{ provider: 'facebook', id: '555' }] }],
    })
    expect(await findTenantByFacebookId(db, '999')).toBeNull()
  })

  it('does not match connection rows that have no Meta user id when the id is empty', async () => {
    const { db, tablesQueried } = fakeDb({ configs: [{ user_id: 'tenant-x', meta_user_id: null }] })
    expect(await findTenantByFacebookId(db, '')).toBeNull()
    expect(tablesQueried).toEqual([])
  })
})
