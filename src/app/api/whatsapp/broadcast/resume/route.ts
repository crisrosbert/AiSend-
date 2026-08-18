// src/app/api/whatsapp/broadcast/resume/route.ts
//
// Finishes a campaign that stopped part-way through.
//
// ── WHY CAMPAIGNS STOP ───────────────────────────────────────────────
// Sending runs in the browser. The dashboard walks the contact list and
// posts them to /api/whatsapp/broadcast ten at a time, pacing between
// batches. Close the tab, sleep the laptop, lose signal on a train, and
// the loop simply ends. Everyone it had not reached stays 'pending'
// with no way to continue — on a 5,000-contact campaign that can be
// most of the list, already paid for and never delivered.
//
// This route does the same work from the server, where nothing depends
// on a tab staying open.
//
// ── WHY IT CALLS THE SEND ROUTE RATHER THAN SENDING ──────────────────
// /api/whatsapp/broadcast already carries the opt-out guard, the credit
// deduction, Meta's phone-number variants and the recipient write-back.
// Reimplementing any of that here would mean two versions of the
// billing path, and they would drift. So this route decides WHO still
// needs a message and delegates HOW to the endpoint that already knows.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Stop before the platform does, so the response reports real progress. */
const TIME_BUDGET_MS = 45_000
/** Matches the dashboard's pacing, which Meta has been happy with. */
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 1000

interface PendingRow {
  id: string
  contact_id: string
  params: string[] | null
  contacts: { phone: string | null } | null
}

export async function POST(request: Request) {
  const startedAt = Date.now()

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const broadcastId = typeof body?.broadcast_id === 'string' ? body.broadcast_id : null
    if (!broadcastId) {
      return NextResponse.json({ error: 'broadcast_id is required' }, { status: 400 })
    }

    // Scoped by user_id as well as id: without it, anyone could resume
    // — and pay for — another tenant's campaign by guessing a uuid.
    const { data: broadcast } = await supabase
      .from('broadcasts')
      .select('id, template_name, template_language, status')
      .eq('id', broadcastId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!broadcast) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
    }

    // Only rows never attempted. Successes and failures are both
    // recorded by the send route, so 'pending' means exactly one thing
    // and resuming cannot message somebody a second time.
    const { data: pending, error: pendingError } = await supabase
      .from('broadcast_recipients')
      .select('id, contact_id, params, contacts(phone)')
      .eq('broadcast_id', broadcastId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .returns<PendingRow[]>()

    if (pendingError) {
      console.error('[resume] could not load recipients:', pendingError.message)
      return NextResponse.json({ error: 'Could not load recipients' }, { status: 500 })
    }

    const queue = (pending ?? []).filter((r) => r.contacts?.phone)
    if (queue.length === 0) {
      await markFinished(supabase, broadcastId)
      return NextResponse.json({ sent: 0, failed: 0, remaining: 0, complete: true })
    }

    const origin = originFor(request)
    // The send route authenticates the caller, so this request has to
    // carry the same session the dashboard used.
    const cookie = request.headers.get('cookie') ?? ''

    let sent = 0
    let failed = 0
    let processed = 0

    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
      // Out of time. Stop cleanly and report what is left rather than
      // being cut off mid-batch with nobody knowing where it got to.
      if (Date.now() - startedAt > TIME_BUDGET_MS) break

      const batch = queue.slice(i, i + BATCH_SIZE)

      const outcomes = await Promise.all(
        batch.map(async (row) => {
          try {
            const res = await fetch(`${origin}/api/whatsapp/broadcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', cookie },
              body: JSON.stringify({
                broadcast_id: broadcastId,
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
            console.error('[resume] send failed:', err)
            return false
          }
        }),
      )

      for (const ok of outcomes) {
        if (ok) sent++
        else failed++
      }
      processed += batch.length

      if (i + BATCH_SIZE < queue.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    const remaining = queue.length - processed
    if (remaining === 0) await markFinished(supabase, broadcastId)

    return NextResponse.json({
      sent,
      failed,
      remaining,
      // The caller posts again while this is false. Each call is bounded
      // by the time budget, so a large campaign finishes over several
      // rounds instead of one request that cannot complete.
      complete: remaining === 0,
    })
  } catch (err) {
    console.error('[resume] unhandled:', err)
    return NextResponse.json({ error: 'Resume failed' }, { status: 500 })
  }
}

/** Recount from the recipient rows — they are the record, not a tally. */
async function markFinished(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  broadcastId: string,
): Promise<void> {
  const { count: sentCount } = await supabase
    .from('broadcast_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('broadcast_id', broadcastId)
    .in('status', ['sent', 'delivered', 'read', 'replied'])

  const { count: failedCount } = await supabase
    .from('broadcast_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('broadcast_id', broadcastId)
    .eq('status', 'failed')

  await supabase
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

/**
 * How many recipients are still waiting. The dashboard uses this to
 * decide whether to offer a Resume button at all.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const broadcastId = new URL(request.url).searchParams.get('broadcast_id')
    if (!broadcastId) {
      return NextResponse.json({ error: 'broadcast_id is required' }, { status: 400 })
    }

    const { data: broadcast } = await supabase
      .from('broadcasts')
      .select('id')
      .eq('id', broadcastId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })

    const { count } = await supabase
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId)
      .eq('status', 'pending')

    return NextResponse.json({ remaining: count ?? 0 })
  } catch {
    return NextResponse.json({ error: 'Could not check' }, { status: 500 })
  }
}
