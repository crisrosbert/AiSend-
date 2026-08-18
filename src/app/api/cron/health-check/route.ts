// src/app/api/cron/health-check/route.ts
//
// Runs the health checks and records what they find.
//
// This is the query half; the judgement lives in lib/monitoring/checks.ts
// where it can be tested without a database.
//
// ── WHAT IT IS LOOKING FOR ───────────────────────────────────────────
// Not crashes. Every serious bug this product has had returned 200 OK:
// an agent booking midnight, replies that promised to come back and
// never did, media that never sent, a widget quietly ignoring its
// agent, delivery tracking recording nothing at all. Exception
// reporting would have caught none of them.
//
// So these ask what a careful operator would ask each morning: is
// anybody waiting for a reply, did we answer twice, is a campaign
// stuck, is anything booked when we are shut.
//
// Add to vercel.json:
//   { "path": "/api/cron/health-check", "schedule": "0 3 * * *" }

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseBusinessHours } from '@/lib/agent/business-hours'
import {
  findUnanswered,
  findDuplicateReplies,
  findOutOfHoursBookings,
  checkWhatsAppAgentAssigned,
  checkStalledBroadcasts,
  checkFailedMessages,
  checkAgentErrors,
  rankFindings,
  type Finding,
  type MessageStub,
} from '@/lib/monitoring/checks'

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

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** A customer waiting longer than this has been dropped, not delayed. */
const UNANSWERED_GRACE_MINUTES = 15
/** Identical replies closer together than this are one message twice. */
const DUPLICATE_WINDOW_SECONDS = 15
/** Failures below this in a day are ordinary; above it is a pattern. */
const FAILED_MESSAGE_THRESHOLD = 10

export async function POST(request: Request) { return handle(request) }
export async function GET(request: Request) { return handle(request) }

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[health-check] CRON_SECRET is not set — refusing to run')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    new URL(request.url).searchParams.get('secret')
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  try {
    // Every tenant with a WhatsApp connection. Others have nothing
    // running that could go quietly wrong.
    const { data: configs } = await db()
      .from('whatsapp_config')
      .select('user_id, status, whatsapp_agent_id')

    const tenants = configs ?? []
    let written = 0
    const summary: Array<{ tenant: string; findings: number }> = []

    for (const config of tenants) {
      const tenantId: string = config.user_id
      const findings: Finding[] = []

      findings.push(
        ...checkWhatsAppAgentAssigned(
          config.status === 'connected',
          config.whatsapp_agent_id ?? null,
        ),
      )

      // ── Conversations ──
      // Human-handled threads are excluded: 'pending' means a teammate
      // took it over, and a person taking their time is not a fault.
      const { data: conversations } = await db()
        .from('conversations')
        .select('id')
        .eq('user_id', tenantId)
        .neq('status', 'pending')
        .gte('updated_at', since)
        .limit(2000)

      const conversationIds = (conversations ?? []).map((c: { id: string }) => c.id)

      if (conversationIds.length > 0) {
        const messages: Array<MessageStub & { text: string | null }> = []

        // Chunked: an `in` filter carrying thousands of uuids builds a
        // URL long enough to be rejected.
        for (let i = 0; i < conversationIds.length; i += 50) {
          const { data: rows } = await db()
            .from('messages')
            .select('conversation_id, sender_type, content_text, created_at')
            .in('conversation_id', conversationIds.slice(i, i + 50))
            .gte('created_at', since)
            .order('created_at', { ascending: true })
            .limit(5000)

          for (const r of rows ?? []) {
            messages.push({
              conversationId: r.conversation_id,
              senderType: r.sender_type,
              createdAt: r.created_at,
              text: r.content_text,
            })
          }
        }

        findings.push(...findUnanswered(messages, now, UNANSWERED_GRACE_MINUTES))
        findings.push(...findDuplicateReplies(messages, DUPLICATE_WINDOW_SECONDS))
      }

      // ── Failed sends ──
      const { count: failedCount } = await db()
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', since)
      findings.push(...checkFailedMessages(failedCount ?? 0, FAILED_MESSAGE_THRESHOLD))

      // ── Agent errors ──
      const { data: usage } = await db()
        .from('agent_usage_logs')
        .select('error')
        .eq('tenant_id', tenantId)
        .not('error', 'is', null)
        .gte('created_at', since)
        .limit(500)
      findings.push(...checkAgentErrors(usage ?? []))

      // ── Appointments outside opening hours ──
      const { data: agents } = await db()
        .from('agents')
        .select('id, business_hours')
        .eq('tenant_id', tenantId)
      const hours = parseBusinessHours(agents?.[0]?.business_hours ?? null)

      const { data: appointments } = await db()
        .from('agent_appointments')
        .select('id, appointment_at, customer_name')
        .eq('tenant_id', tenantId)
        .gte('created_at', since)
        .limit(500)

      findings.push(
        ...findOutOfHoursBookings(
          (appointments ?? []).map((a: { id: string; appointment_at: string; customer_name: string | null }) => ({
            id: a.id,
            appointmentAt: a.appointment_at,
            customerName: a.customer_name,
          })),
          hours,
        ),
      )

      // ── Campaigns that stopped part-way ──
      const { data: sending } = await db()
        .from('broadcasts')
        .select('id, name')
        .eq('user_id', tenantId)
        .eq('status', 'sending')
        .limit(50)

      const stalled: Array<{ id: string; name: string | null; pending: number }> = []
      for (const b of sending ?? []) {
        const { count } = await db()
          .from('broadcast_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('broadcast_id', b.id)
          .eq('status', 'pending')
        if ((count ?? 0) > 0) stalled.push({ id: b.id, name: b.name, pending: count ?? 0 })
      }
      findings.push(...checkStalledBroadcasts(stalled))

      // ── Record ──
      //
      // Select-then-update-or-insert rather than upsert. The daily
      // uniqueness is enforced by an expression index (it casts
      // detected_at to a date), and PostgREST cannot target one of
      // those with onConflict — it answers 42P10, "no unique or
      // exclusion constraint matching the ON CONFLICT specification".
      // Doing it explicitly is longer and works.
      const dayStart = new Date(now)
      dayStart.setUTCHours(0, 0, 0, 0)

      for (const f of rankFindings(findings)) {
        const { data: existing } = await db()
          .from('health_findings')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('code', f.code)
          .gte('detected_at', dayStart.toISOString())
          .maybeSingle()

        const row = {
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          subject_id: f.subjectId ?? null,
          count: f.count,
          detected_at: now.toISOString(),
        }

        // A fault still present today refreshes today's row rather than
        // adding another copy, so a persistent problem does not bury the
        // morning it was first discovered under a hundred duplicates.
        const { error } = existing
          ? await db().from('health_findings').update(row).eq('id', existing.id)
          : await db()
              .from('health_findings')
              .insert({ ...row, tenant_id: tenantId, code: f.code })

        if (error) {
          console.error('[health-check] could not record finding:', error.message)
        } else {
          written++
        }
      }

      if (findings.length > 0) {
        summary.push({ tenant: tenantId, findings: findings.length })
      }
    }

    console.log(`[health-check] ${tenants.length} tenants, ${written} findings recorded`)

    return NextResponse.json({
      tenants: tenants.length,
      findings: written,
      summary,
    })
  } catch (err) {
    console.error('[health-check] unhandled:', err)
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 })
  }
}
