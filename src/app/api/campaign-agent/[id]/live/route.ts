// GET → the live picture of one campaign: day X of Y, money spent and left,
// link clicks, and the people who need a human (replied and waiting, or
// unreachable). Ownership is checked as the signed-in user (row-level
// security); the extra lookups use the service role and stay scoped to this
// campaign's own broadcasts and this user's contacts.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { getOrgBalance, getOrgIdForUser } from '@/lib/billing/credits'
import { budgetFigures, dayProgress } from '@/lib/campaign-agent/live'
import { isPermanentFailure } from '@/lib/campaign-agent/retry'

export const dynamic = 'force-dynamic'

const CAP = 25

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: c } = await supabase
    .from('campaign_agents')
    .select('id, status, est_cost, launched_at, link_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const db = supabaseAdmin()
  const { data: stepRows } = await db
    .from('campaign_steps')
    .select('grp, kind, wait_hours, broadcast_id, template_name, template_language')
    .eq('campaign_id', id)
  const steps = stepRows ?? []
  const broadcastIds = steps.map((s) => s.broadcast_id).filter((x): x is string => !!x)

  // Day X of Y
  const finished = ['completed', 'cancelled', 'failed'].includes(c.status)
  const day = dayProgress({
    launchedAt: c.launched_at,
    followupWaitHours: steps.filter((s) => s.kind === 'main' && s.grp > 0).map((s) => Number(s.wait_hours) || 0),
    finished,
  })

  // Money
  let sentCounts: number[] = []
  if (broadcastIds.length) {
    const { data: b } = await db.from('broadcasts').select('sent_count').in('id', broadcastIds)
    sentCounts = (b ?? []).map((x) => Number(x.sent_count) || 0)
  }
  const orgId = await getOrgIdForUser(db, user.id)
  const balance = orgId ? await getOrgBalance(db, orgId) : null
  const budget = budgetFigures(Number(c.est_cost) || 0, sentCounts, balance)

  // Clicks (counted per template; every template of this campaign shares the one link)
  let clicks: number | null = null
  if (c.link_url) {
    const names = [...new Set(steps.map((s) => s.template_name).filter(Boolean))]
    const { data: tpls } = await db.from('message_templates').select('id').eq('user_id', user.id).in('name', names)
    const ids = (tpls ?? []).map((t) => t.id)
    clicks = 0
    if (ids.length) {
      const { count } = await db.from('template_link_clicks').select('id', { count: 'exact', head: true }).in('template_id', ids)
      clicks = count ?? 0
    }
  }

  // Needs attention
  type Person = { contactId: string; name: string | null; phone: string; reason: 'waiting' | 'unreachable'; detail: string }
  const attention: Person[] = []
  if (broadcastIds.length) {
    const { data: recips } = await db
      .from('broadcast_recipients')
      .select('contact_id, status, error_message')
      .in('broadcast_id', broadcastIds)
      .not('contact_id', 'is', null)
      .limit(5000)
    const rows = recips ?? []
    const contactIds = [...new Set(rows.map((r) => r.contact_id as string))]

    const reached = new Set(rows.filter((r) => ['sent', 'delivered', 'read', 'replied'].includes(r.status)).map((r) => r.contact_id as string))
    const unreachable = new Map<string, string>()
    for (const r of rows) {
      if (r.status === 'failed' && !reached.has(r.contact_id as string) && isPermanentFailure(r.error_message)) unreachable.set(r.contact_id as string, String(r.error_message).slice(0, 120))
    }

    // Replied and still waiting for an answer: an unread conversation.
    const waiting = new Set<string>()
    for (let i = 0; i < contactIds.length; i += 200) {
      const { data: convs } = await db
        .from('conversations')
        .select('contact_id')
        .eq('user_id', user.id)
        .in('contact_id', contactIds.slice(i, i + 200))
        .gt('unread_count', 0)
      for (const cv of convs ?? []) waiting.add(cv.contact_id as string)
    }

    const wanted = [...new Set([...[...waiting].slice(0, CAP), ...[...unreachable.keys()].slice(0, CAP)])]
    if (wanted.length) {
      const { data: contacts } = await db.from('contacts').select('id, name, phone').eq('user_id', user.id).in('id', wanted)
      const byId = new Map((contacts ?? []).map((x) => [x.id as string, x]))
      for (const cid of wanted) {
        const ct = byId.get(cid)
        if (!ct) continue
        if (waiting.has(cid)) attention.push({ contactId: cid, name: ct.name, phone: ct.phone, reason: 'waiting', detail: 'Replied and is waiting for your answer' })
        else attention.push({ contactId: cid, name: ct.name, phone: ct.phone, reason: 'unreachable', detail: unreachable.get(cid) ?? 'Could not be reached' })
      }
    }
    return NextResponse.json({
      day, budget, clicks, attention,
      counts: { waiting: waiting.size, unreachable: unreachable.size },
    })
  }

  return NextResponse.json({ day, budget, clicks, attention, counts: { waiting: 0, unreachable: 0 } })
}
