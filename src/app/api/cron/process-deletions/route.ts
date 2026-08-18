// src/app/api/cron/process-deletions/route.ts
//
// Carries out the deletions recorded by /api/meta/data-deletion.
//
// Separated from the callback because deleting a tenant can mean
// removing hundreds of thousands of rows, and Meta's callback has to
// answer in seconds. This runs on a schedule, takes one request at a
// time, and records what it removed.
//
// ── ON DOING THIS AT ALL ─────────────────────────────────────────────
// This is the most destructive code in the product. Three things keep
// it honest:
//
//   • It only ever acts on rows that a verified Meta signature created.
//     Nothing here trusts a URL parameter.
//   • It deletes one tenant per request, by id, never by filter.
//   • It records counts before and after, so a deletion can be shown to
//     have happened and to have been limited to one account.
//
// Add to vercel.json:
//   { "path": "/api/cron/process-deletions", "schedule": "0 * * * *" }

import { NextResponse } from 'next/server'
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

/**
 * Tables holding this tenant's data, keyed by the column naming them.
 *
 * Listed explicitly rather than relying on cascades. Most of the
 * original schema does cascade from auth.users, but the tables added
 * later — agents, leads, widget configs — were created outside the
 * migrations and their constraints cannot be assumed. Deleting them by
 * name means a missing cascade leaves no orphaned personal data.
 */
const TENANT_TABLES: Array<{ table: string; column: string }> = [
  // Agent-side data
  { table: 'agent_usage_logs', column: 'tenant_id' },
  { table: 'agent_appointments', column: 'tenant_id' },
  { table: 'agent_kb_chunks', column: 'tenant_id' },
  { table: 'agent_media', column: 'tenant_id' },
  { table: 'leads', column: 'tenant_id' },
  { table: 'agents', column: 'tenant_id' },
  // Widget
  { table: 'widget_configs', column: 'org_user_id' },
  // Messaging and CRM
  { table: 'automation_logs', column: 'user_id' },
  { table: 'automation_pending_executions', column: 'user_id' },
  { table: 'automations', column: 'user_id' },
  { table: 'broadcasts', column: 'user_id' },
  { table: 'canned_replies', column: 'user_id' },
  { table: 'contact_notes', column: 'user_id' },
  { table: 'conversations', column: 'user_id' },
  { table: 'contacts', column: 'user_id' },
  { table: 'deals', column: 'user_id' },
  { table: 'pipelines', column: 'user_id' },
  { table: 'custom_fields', column: 'user_id' },
  { table: 'tags', column: 'user_id' },
  { table: 'message_templates', column: 'user_id' },
  { table: 'whatsapp_config', column: 'user_id' },
  { table: 'profiles', column: 'user_id' },
]

export async function POST(request: Request) {
  return handle(request)
}

export async function GET(request: Request) {
  return handle(request)
}

async function handle(request: Request) {
  // Same guard the other cron routes use. Without it this is a public
  // endpoint that deletes accounts.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[process-deletions] CRON_SECRET is not set — refusing to run')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    new URL(request.url).searchParams.get('secret')
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // One at a time. A batch that fails halfway is far harder to reason
    // about than a queue that drains an item per run.
    const { data: pending } = await db()
      .from('data_deletion_requests')
      .select('id, tenant_id, confirmation_code')
      .eq('status', 'received')
      .not('tenant_id', 'is', null)
      .order('requested_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!pending) {
      return NextResponse.json({ processed: 0, message: 'Nothing to delete' })
    }

    await db()
      .from('data_deletion_requests')
      .update({ status: 'processing' })
      .eq('id', pending.id)

    const counts: Record<string, number> = {}
    const failures: string[] = []

    for (const { table, column } of TENANT_TABLES) {
      try {
        const { data, error } = await db()
          .from(table)
          .delete()
          .eq(column, pending.tenant_id)
          .select('id')

        if (error) {
          // A table that does not exist in this deployment is not a
          // failure — the schema has grown unevenly. Anything else is.
          if (/does not exist|schema cache/i.test(error.message)) continue
          failures.push(`${table}: ${error.message}`)
          continue
        }
        if (data?.length) counts[table] = data.length
      } catch (err) {
        failures.push(`${table}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // The login itself goes last, so a failure above leaves the account
    // reachable rather than orphaning data behind a deleted user.
    if (failures.length === 0) {
      const { error } = await db().auth.admin.deleteUser(pending.tenant_id)
      if (error && !/not found/i.test(error.message)) {
        failures.push(`auth user: ${error.message}`)
      } else {
        counts['auth_user'] = 1
      }
    }

    const succeeded = failures.length === 0
    await db()
      .from('data_deletion_requests')
      .update({
        status: succeeded ? 'completed' : 'failed',
        deleted_counts: counts,
        failure_reason: succeeded ? null : failures.join(' | ').slice(0, 2000),
        completed_at: succeeded ? new Date().toISOString() : null,
      })
      .eq('id', pending.id)

    if (!succeeded) {
      console.error('[process-deletions] failures:', failures)
    }

    return NextResponse.json({
      processed: 1,
      confirmation_code: pending.confirmation_code,
      status: succeeded ? 'completed' : 'failed',
      deleted: counts,
    })
  } catch (err) {
    console.error('[process-deletions] unhandled:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
