// POST { goal, plan, audience } → creates the campaign, submits every message
// template to Meta, and starts the scheduler's work. Only runs after the user
// pressed Launch on the review step.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { currentBusinessId } from '@/lib/business/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getOrgBalance, getOrgIdForUser } from '@/lib/billing/credits'
import { templateName, validatePlan } from '@/lib/campaign-agent/plan'
import { cleanAudience, resolveAudience } from '@/lib/campaign-agent/audience'
import { estimateCost } from '@/lib/campaign-agent/estimate'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FOOTER = 'Reply STOP to unsubscribe'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = checkRateLimit(`campaign:launch:${user.id}`, { limit: 6, windowMs: 10 * 60_000 })
  if (!limit.success) return rateLimitResponse(limit)

  const body = await request.json().catch(() => ({}))
  const goal = typeof body?.goal === 'string' ? body.goal.trim().slice(0, 800) : ''
  const checked = validatePlan(body?.plan)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })
  const plan = checked.plan
  const audience = cleanAudience(body?.audience)

  const db = supabaseAdmin()
  const { data: cfg } = await supabase.from('whatsapp_config').select('waba_id').eq('user_id', user.id).maybeSingle()
  if (!cfg?.waba_id) return NextResponse.json({ error: 'Connect your WhatsApp Business account in Settings first.' }, { status: 400 })

  // Re-check the audience and wallet now, not from what the browser remembers.
  const businessId = await currentBusinessId(supabase, user.id, request)
  const { contacts } = await resolveAudience(db, { userId: user.id, businessId }, audience)
  if (contacts.length === 0) return NextResponse.json({ error: 'No contacts match this audience.' }, { status: 400 })
  const est = estimateCost(contacts.length, plan.followups.length)
  const orgId = await getOrgIdForUser(db, user.id)
  if (orgId) {
    const balance = await getOrgBalance(db, orgId)
    if (balance < est.firstMessage) {
      return NextResponse.json({ error: `Not enough credits for the first message: it needs about ₹${est.firstMessage.toFixed(2)} and your balance is ₹${balance.toFixed(2)}.` }, { status: 402 })
    }
  }

  const { data: campaign, error: cErr } = await db
    .from('campaign_agents')
    .insert({
      user_id: user.id,
      business_id: businessId,
      name: plan.name,
      goal,
      status: 'running',
      audience,
      plan,
      est_contacts: contacts.length,
      est_cost: est.upperBound,
    })
    .select('id')
    .single()
  if (cErr || !campaign) return NextResponse.json({ error: cErr?.message ?? 'Could not create the campaign.' }, { status: 500 })

  const rows = [
    ...plan.variants.map((v, i) => ({ grp: 0, variant: i, label: v.label, body: v.body, wait: 0, rule: null as string | null, kind: 'v', idx: i })),
    ...plan.followups.map((f, i) => ({ grp: i + 1, variant: 0, label: f.label, body: f.body, wait: f.waitHours, rule: f.rule as string | null, kind: 'f', idx: i + 1 })),
  ]

  // Submit each message to Meta through the existing template route, as the user.
  const origin = new URL(request.url).origin
  const cookie = request.headers.get('cookie') ?? ''
  const steps: Array<Record<string, unknown>> = []
  let firstGroupFailure: string | null = null
  for (const r of rows) {
    const name = templateName(campaign.id, r.kind, r.idx)
    let status: 'waiting_template' | 'ready' | 'failed' = 'waiting_template'
    let error: string | null = null
    try {
      const res = await fetch(`${origin}/api/whatsapp/templates/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ name, category: 'Marketing', language: 'en_US', body_text: r.body, footer_text: FOOTER, sample_values: [plan.sampleName] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        status = 'failed'
        error = data?.error ?? `Meta did not accept this message (${res.status}).`
        if (r.grp === 0) firstGroupFailure = error
      } else if (String(data?.status).toLowerCase() === 'approved') status = 'ready'
    } catch (e) {
      status = 'failed'
      error = e instanceof Error ? e.message : 'Could not reach Meta.'
      if (r.grp === 0) firstGroupFailure = error
    }
    steps.push({
      campaign_id: campaign.id, grp: r.grp, variant: r.variant, label: r.label, body: r.body,
      template_name: name, template_language: 'en_US', wait_hours: r.wait, rule: r.rule, status, error,
      completed_at: status === 'failed' ? new Date().toISOString() : null,
    })
  }

  if (firstGroupFailure) {
    // The first message is the campaign. If Meta refused it there is nothing to run.
    await db.from('campaign_agents').delete().eq('id', campaign.id)
    return NextResponse.json({ error: `Meta did not accept the first message: ${firstGroupFailure}` }, { status: 422 })
  }
  const { error: sErr } = await db.from('campaign_steps').insert(steps)
  if (sErr) {
    await db.from('campaign_agents').delete().eq('id', campaign.id)
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }
  return NextResponse.json({ id: campaign.id })
}
