// src/app/api/analytics/route.ts
//
// One query pass, one shaped answer, for the Analytics page.
//
// ── WHY A ROUTE AND NOT CLIENT-SIDE QUERIES ──────────────────────────
// The obvious build is four Supabase calls from the page and some
// reduce() in React. That works until a tenant has 50,000 messages in
// the range: every row crosses the wire so the browser can count them.
// Counting is the whole job here, so it belongs next to the data.
//
// ── WHAT IS COUNTED, AND FROM WHAT ───────────────────────────────────
// `messages.sender_type` already separates the three parties, which is
// exactly the split worth charting:
//
//   customer → User messages     — what visitors said
//   bot      → Chatbot messages  — what the AI answered
//   agent    → Business messages — what a human on the team typed
//   system   → not charted; these are internal notices, not conversation
//
// Agent activity is derived rather than stored:
//
//   closed      — conversations whose status is 'closed' in the range
//   intervened  — conversations where a human sent at least one message.
//                 There is no "handoff happened" column, so this is
//                 measured from what was actually typed. It is also the
//                 more honest definition: a handoff nobody answered is
//                 not an intervention.
//
// ── THE NUMBER THAT ACTUALLY MATTERS ─────────────────────────────────
// Deflection: conversations the AI handled end to end, with no human
// message at all. That is the reason a business buys an AI agent, and
// it is the one figure that says whether it is working. AiSensy has no
// equivalent because it has no AI to measure.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Guard-rail on the range, so one request cannot scan a year of rows. */
const MAX_DAYS = 180

export interface DayPoint {
  /** YYYY-MM-DD, the bucket's local date. */
  date: string
  user: number
  bot: number
  business: number
  closed: number
  intervened: number
}

export interface AnalyticsResponse {
  from: string
  to: string
  days: DayPoint[]
  totals: {
    user: number
    bot: number
    business: number
    closed: number
    intervened: number
    conversations: number
    /** Conversations with no human message: the AI handled them alone. */
    deflected: number
    /** deflected / conversations, 0–100, null when there is nothing to divide. */
    deflectionRate: number | null
    leads: number
    /** Median seconds from a customer message to the next reply. */
    medianResponseSeconds: number | null
  }
  broadcasts: {
    sent: number
    delivered: number
    read: number
    replied: number
    failed: number
  }
}

/** YYYY-MM-DD for a timestamp, in UTC — matches how rows are stored. */
export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * Roll recipient statuses into a funnel.
 *
 * Each status is terminal in the database — a row that was read says
 * 'read', not 'sent' and 'delivered' and 'read'. Counting them as-is
 * would draw a funnel where "delivered" is smaller than "read", which
 * is impossible and reads as a bug in the product rather than in the
 * chart. So each stage counts every row that reached it or beyond.
 */
export function rollUpFunnel(
  statuses: string[],
): { sent: number; delivered: number; read: number; replied: number; failed: number } {
  const out = { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 }
  for (const status of statuses) {
    // Failed rows never reached the handset, so they are not part of
    // the funnel at all — they are reported beside it.
    if (status === 'failed') { out.failed++; continue }
    if (['sent', 'delivered', 'read', 'replied'].includes(status)) out.sent++
    if (['delivered', 'read', 'replied'].includes(status)) out.delivered++
    if (['read', 'replied'].includes(status)) out.read++
    if (status === 'replied') out.replied++
  }
  return out
}

/** Every date from..to inclusive, so a quiet day is a zero, not a gap. */
export function eachDay(from: Date, to: Date): string[] {
  const out: string[] = []
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  while (cursor.getTime() <= end) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)

    // Default to the last 7 days, which is what the page opens on.
    const toParam = searchParams.get('to')
    const fromParam = searchParams.get('from')

    const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date()
    const from = fromParam
      ? new Date(`${fromParam}T00:00:00.000Z`)
      : new Date(to.getTime() - 6 * 86_400_000)

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }
    if (from > to) {
      return NextResponse.json({ error: 'The start date is after the end date.' }, { status: 400 })
    }

    const spanDays = Math.ceil((to.getTime() - from.getTime()) / 86_400_000)
    if (spanDays > MAX_DAYS) {
      return NextResponse.json(
        { error: `Ranges are limited to ${MAX_DAYS} days.` },
        { status: 400 },
      )
    }

    const fromIso = from.toISOString()
    const toIso = to.toISOString()

    // ── Messages ──
    //
    // Scoped through conversations to this tenant. Selecting only the
    // three columns needed keeps the payload small even on busy ranges.
    const { data: messages, error: msgErr } = await supabase
      .from('messages')
      .select('sender_type, created_at, conversation_id, conversations!inner(user_id)')
      .eq('conversations.user_id', user.id)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })

    if (msgErr) {
      console.error('[analytics] messages:', msgErr.message)
      return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 })
    }

    // ── Conversations closed in the range ──
    const { data: closedRows, error: convErr } = await supabase
      .from('conversations')
      .select('id, updated_at, status')
      .eq('user_id', user.id)
      .eq('status', 'closed')
      .gte('updated_at', fromIso)
      .lte('updated_at', toIso)

    if (convErr) {
      console.error('[analytics] conversations:', convErr.message)
    }

    // ── Website leads ──
    //
    // tenant_id, not user_id: the widget writes leads keyed by the
    // tenant that owns the embed (see api/widget/lead). Same value,
    // different column name, and getting it wrong returns a silent zero
    // rather than an error — which is the worst kind of wrong number.
    const { count: leadCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', user.id)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)

    // ── Broadcast delivery in the range ──
    const { data: recipients } = await supabase
      .from('broadcast_recipients')
      .select('status, broadcasts!inner(user_id, created_at)')
      .eq('broadcasts.user_id', user.id)
      .gte('broadcasts.created_at', fromIso)
      .lte('broadcasts.created_at', toIso)

    /* ── Shape the day buckets ─────────────────────────────────────── */

    const buckets = new Map<string, DayPoint>()
    for (const date of eachDay(from, to)) {
      buckets.set(date, { date, user: 0, bot: 0, business: 0, closed: 0, intervened: 0 })
    }

    // Per conversation: who spoke, and when the first customer message
    // of each unanswered turn was — enough for both deflection and
    // response time in a single pass.
    const sawHuman = new Set<string>()
    const allConversations = new Set<string>()
    const responseTimes: number[] = []
    const pendingCustomerAt = new Map<string, number>()

    for (const row of messages ?? []) {
      const m = row as unknown as {
        sender_type: string
        created_at: string
        conversation_id: string | null
      }
      const key = dayKey(m.created_at)
      const bucket = buckets.get(key)
      const at = new Date(m.created_at).getTime()

      if (m.conversation_id) {
        allConversations.add(m.conversation_id)
      }

      if (m.sender_type === 'customer') {
        if (bucket) bucket.user++
        // Only the FIRST unanswered customer message counts, so a
        // visitor sending five lines in a row is one wait, not five.
        if (m.conversation_id && !pendingCustomerAt.has(m.conversation_id)) {
          pendingCustomerAt.set(m.conversation_id, at)
        }
      } else if (m.sender_type === 'bot') {
        if (bucket) bucket.bot++
      } else if (m.sender_type === 'agent') {
        if (bucket) bucket.business++
        if (m.conversation_id) sawHuman.add(m.conversation_id)
      } else {
        // 'system' and anything added later: not part of the
        // conversation, so deliberately uncounted rather than lumped in.
        continue
      }

      if (m.sender_type !== 'customer' && m.conversation_id) {
        const waitingSince = pendingCustomerAt.get(m.conversation_id)
        if (waitingSince !== undefined) {
          responseTimes.push(Math.round((at - waitingSince) / 1000))
          pendingCustomerAt.delete(m.conversation_id)
        }
      }
    }

    // Intervened is counted on the day the human first replied, which is
    // why it is derived here rather than inside the loop above: the set
    // is only complete once every message has been seen.
    const firstHumanDay = new Map<string, string>()
    for (const row of messages ?? []) {
      const m = row as unknown as {
        sender_type: string
        created_at: string
        conversation_id: string | null
      }
      if (m.sender_type !== 'agent' || !m.conversation_id) continue
      if (!firstHumanDay.has(m.conversation_id)) {
        firstHumanDay.set(m.conversation_id, dayKey(m.created_at))
      }
    }
    for (const date of firstHumanDay.values()) {
      const bucket = buckets.get(date)
      if (bucket) bucket.intervened++
    }

    for (const row of closedRows ?? []) {
      const c = row as { updated_at: string }
      const bucket = buckets.get(dayKey(c.updated_at))
      if (bucket) bucket.closed++
    }

    const days = [...buckets.values()]

    const totals = days.reduce(
      (acc, d) => ({
        user: acc.user + d.user,
        bot: acc.bot + d.bot,
        business: acc.business + d.business,
        closed: acc.closed + d.closed,
        intervened: acc.intervened + d.intervened,
      }),
      { user: 0, bot: 0, business: 0, closed: 0, intervened: 0 },
    )

    const conversations = allConversations.size
    const deflected = [...allConversations].filter((id) => !sawHuman.has(id)).length

    const broadcastTotals = rollUpFunnel(
      (recipients ?? []).map((row) => (row as { status: string }).status),
    )

    const payload: AnalyticsResponse = {
      from: fromIso.slice(0, 10),
      to: toIso.slice(0, 10),
      days,
      totals: {
        ...totals,
        conversations,
        deflected,
        deflectionRate: conversations > 0 ? Math.round((deflected / conversations) * 100) : null,
        leads: leadCount ?? 0,
        medianResponseSeconds: median(responseTimes),
      },
      broadcasts: broadcastTotals,
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('[analytics] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
