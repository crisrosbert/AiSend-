// src/app/api/cron/broadcast-sweep/route.ts
//
// Finishes campaigns that stopped, without anyone having to notice.
//
// ── THE PROBLEM THIS SOLVES ──────────────────────────────────────────
// Sending runs in the browser tab. The dashboard walks the contact list
// ten at a time and pauses between batches, so a 5,000-contact campaign
// needs that tab open and awake for about eight minutes. Close it, sleep
// the laptop, lose signal on a train, and the loop simply ends.
// Everyone it had not reached stays 'pending'.
//
// A resume route already existed for this — and nothing ever called it
// except a button, which only helps the person who thinks to look. The
// campaign reports itself as sending, forever, while most of a paid-for
// list is never delivered.
//
// This sweeps every tenant on a schedule, which is what makes the
// difference between "sending happens while you watch" and "sending
// happens".
//
// ── WHY IT DOES NOT SEND ANYTHING ITSELF ─────────────────────────────
// It delegates to /api/whatsapp/broadcast, which carries the opt-out
// guard, the credit deduction, Meta's phone-number variants and the
// recipient write-back. A second copy of that is a second billing path,
// and the copy that drifts is always the one nobody is watching.
//
// ── SCHEDULING ───────────────────────────────────────────────────────
// Hobby plans cannot run a cron more than once a day, and a cron that
// asks for more blocks the whole deployment — so this is not listed in
// vercel.json. Drive it from an external pinger every 10-15 minutes:
//
//   GET https://<host>/api/cron/broadcast-sweep
//   Authorization: Bearer <CRON_SECRET>
//
// On a plan that allows it, add it to vercel.json instead.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { verifyCron, cronSecret } from '@/lib/cron/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Leave room to write results and answer before the platform cuts us off. */
const TIME_BUDGET_MS = 45_000
/** Matches the dashboard's pacing, which Meta has been happy with. */
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 1000

/**
 * Ignore campaigns that are still actively being sent from a tab.
 *
 * Without this the sweep and an open dashboard would work the same
 * queue at once and send some people two copies. Five minutes is longer
 * than the dashboard's own gap between batches, so a tab that is still
 * working is never mistaken for one that stopped.
 */
const STALL_MINUTES = 5

interface PendingRow {
  id: string
  contact_id: string
  params: string[] | null
  broadcast_id: string
  contacts: { phone: string | null } | null
}

interface StalledBroadcast {
  id: string
  user_id: string
  template_name: string
  template_language: string | null
}

export async function GET(request: Request) {
  const startedAt = Date.now()

  const auth = verifyCron(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const admin = supabaseAdmin()
  const stalledBefore = new Date(Date.now() - STALL_MINUTES * 60_000).toISOString()

  // Campaigns that say they are sending but have not been touched
  // recently. Ordered oldest first so a backlog drains in the order
  // people were promised their messages.
  const { data: broadcasts, error } = await admin
    .from('broadcasts')
    .select('id, user_id, template_name, template_language')
    .eq('status', 'sending')
    .lt('updated_at', stalledBefore)
    .order('updated_at', { ascending: true })
    .limit(20)
    .returns<StalledBroadcast[]>()

  if (error) {
    console.error('[sweep] could not list broadcasts:', error.message)
    return NextResponse.json({ error: 'Could not list broadcasts' }, { status: 500 })
  }

  if (!broadcasts || broadcasts.length === 0) {
    return NextResponse.json({ swept: 0, sent: 0, failed: 0, note: 'nothing stalled' })
  }

  const origin = originFor(request)
  const secret = cronSecret()!

  let sent = 0
  let failed = 0
  let swept = 0

  for (const broadcast of broadcasts) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break

    const { data: pending } = await admin
      .from('broadcast_recipients')
      .select('id, contact_id, params, broadcast_id, contacts(phone)')
      .eq('broadcast_id', broadcast.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(500)
      .returns<PendingRow[]>()

    const queue = (pending ?? []).filter((r) => r.contacts?.phone)

    if (queue.length === 0) {
      // Nothing left — the campaign is done and only its status is
      // stale. Recount from the recipient rows, which are the record.
      await markFinished(admin, broadcast.id)
      swept++
      continue
    }

    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break

      const batch = queue.slice(i, i + BATCH_SIZE)

      const outcomes = await Promise.all(
        batch.map(async (row) => {
          try {
            const res = await fetch(`${origin}/api/whatsapp/broadcast`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                authorization: `Bearer ${secret}`,
              },
              body: JSON.stringify({
                broadcast_id: broadcast.id,
                // Names the tenant this send belongs to. The send route
                // accepts it only alongside the cron secret.
                internal_user_id: broadcast.user_id,
                recipients: [
                  {
                    phone: row.contacts!.phone,
                    params: row.params ?? [],
                    contact_id: row.contact_id,
                  },
                ],
                template_name: broadcast.template_name,
                template_language: broadcast.template_language ?? 'en_US',
              }),
            })
            const data = await res.json().catch(() => ({}))
            return res.ok && data?.sent > 0
          } catch (err) {
            console.error('[sweep] send failed:', err)
            return false
          }
        }),
      )

      for (const ok of outcomes) {
        if (ok) sent++
        else failed++
      }

      // Touch the campaign so a second sweep starting while this one is
      // still running sees it as active and leaves it alone.
      await admin
        .from('broadcasts')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', broadcast.id)

      if (i + BATCH_SIZE < queue.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    swept++

    // Only close it out when nothing is waiting. A campaign larger than
    // one sweep's budget stays 'sending' and the next run continues it.
    const { count: stillPending } = await admin
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcast.id)
      .eq('status', 'pending')

    if ((stillPending ?? 0) === 0) {
      await markFinished(admin, broadcast.id)
    }
  }

  console.log(`[sweep] ${swept} campaign(s), ${sent} sent, ${failed} failed`)
  return NextResponse.json({ swept, sent, failed })
}

/** Recount from the recipient rows — they are the record, not a tally. */
async function markFinished(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  broadcastId: string,
): Promise<void> {
  const { count: sentCount } = await admin
    .from('broadcast_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('broadcast_id', broadcastId)
    .in('status', ['sent', 'delivered', 'read', 'replied'])

  const { count: failedCount } = await admin
    .from('broadcast_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('broadcast_id', broadcastId)
    .eq('status', 'failed')

  await admin
    .from('broadcasts')
    .update({
      status: (sentCount ?? 0) === 0 ? 'failed' : 'sent',
      sent_count: sentCount ?? 0,
      failed_count: failedCount ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', broadcastId)
}

/** Public origin from the proxy headers; request.url is internal. */
function originFor(request: Request): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  return new URL(request.url).origin
}
