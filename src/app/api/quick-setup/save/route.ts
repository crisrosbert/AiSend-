// src/app/api/quick-setup/save/route.ts
//
// "Save & Activate": turns the owner's text into ONE agent in the existing
// `agents` table and (optionally) points the WhatsApp number at it.
//
//   - Reuses the existing agent + engine path. No new table, no migration.
//   - The agent is found again by a marker line in its persona, so pressing
//     the button twice updates the same agent instead of making a second.
//   - Every query runs with the signed-in user's own session (row level
//     security) AND is filtered by tenant_id = user.id and the current
//     business, the same scoping the AI Agents page uses. The service-role
//     key is not used here.
//   - Facts sent by the browser are re-validated and re-checked against the
//     owner's text on the server; the browser is not trusted.
//   - It never replaces a different agent chosen in whatsapp_config
//     (whatsapp_agent_id) unless the caller says `replace_whatsapp: true`.
//     NOTE: at the base commit the WhatsApp router picks among all ACTIVE
//     agents of the tenant; an agent being active is what makes it answer.
//
// Body:    { prompt, facts?, activate?, assign_whatsapp?, replace_whatsapp? }
// Returns: { agent_id, is_active, created, whatsapp, other_active_agents, notes }
//
// Privacy: the owner's text is never logged.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentBusinessId } from '@/lib/business/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { extractFactsHeuristic, groundFacts, mergeFacts, parseExtractedFacts } from '@/lib/quick-setup/facts'
import { QUICK_SETUP_RATE_LIMITS } from '@/lib/quick-setup/limits'
import { buildQuickSetupPersona, QUICK_SETUP_MARKER, validateSetupPrompt } from '@/lib/quick-setup/prompt'
import {
  buildAgentUpdate,
  buildNewAgentRow,
  decideWhatsAppAssignment,
  isMissingColumnError,
  readBool,
  stripOptionalColumns,
} from '@/lib/quick-setup/save-helpers'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BODY_BYTES = 40_000

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkRateLimit(`quick-setup:save:${user.id}`, QUICK_SETUP_RATE_LIMITS.save)
    if (!rl.success) return rateLimitResponse(rl)

    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'That request is too large.' }, { status: 413 })
    }
    const body = await req.json().catch(() => ({}))

    const check = validateSetupPrompt(body?.prompt)
    if (!check.ok) return NextResponse.json({ error: check.message, code: check.code }, { status: 400 })

    const activate = readBool(body?.activate, true)
    const assign = readBool(body?.assign_whatsapp, true)
    const replace = readBool(body?.replace_whatsapp, false)

    // Facts the browser confirmed, validated again, grounded in the text,
    // gaps filled by the simple rules.
    const sent = parseExtractedFacts(body?.facts)
    const facts = groundFacts(mergeFacts(sent.facts, extractFactsHeuristic(check.text)), check.text)
    const persona = buildQuickSetupPersona({ ownerText: check.text, facts })

    // The business this request acts on (cookie checked against what the user owns).
    const businessId = await currentBusinessId(supabase, user.id, req)
    if (!businessId) {
      return NextResponse.json({ error: 'Your business profile is not ready yet. Please reload the page and try again.' }, { status: 409 })
    }

    const notes: string[] = []

    // ── Find the agent Quick Setup made earlier, if any ──
    const { data: existing, error: findErr } = await supabase
      .from('agents')
      .select('id')
      .eq('tenant_id', user.id)
      .eq('business_id', businessId)
      .like('persona', `%${QUICK_SETUP_MARKER}%`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (findErr) {
      console.error('[quick-setup/save] lookup failed:', findErr.message)
      return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
    }

    const rowInput = { userId: user.id, businessId, facts, persona, activate }
    let agentId: string | null = existing?.id ?? null
    const created = !agentId

    if (agentId) {
      const patch = buildAgentUpdate(rowInput)
      let res = await supabase.from('agents').update(patch).eq('id', agentId).eq('tenant_id', user.id).select('id').single()
      if (res.error && isMissingColumnError(res.error)) {
        notes.push('Some optional settings (hours / phone) could not be saved on this account, so defaults were kept.')
        res = await supabase.from('agents').update(stripOptionalColumns(patch)).eq('id', agentId).eq('tenant_id', user.id).select('id').single()
      }
      if (res.error || !res.data) {
        console.error('[quick-setup/save] update failed:', res.error?.message)
        return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
      }
    } else {
      const row = buildNewAgentRow(rowInput)
      let res = await supabase.from('agents').insert(row).select('id').single()
      if (res.error && isMissingColumnError(res.error)) {
        notes.push('Some optional settings (hours / phone) could not be saved on this account, so defaults were kept.')
        res = await supabase.from('agents').insert(stripOptionalColumns(row)).select('id').single()
      }
      if (res.error || !res.data) {
        console.error('[quick-setup/save] insert failed:', res.error?.message)
        return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
      }
      agentId = res.data.id as string
    }

    // ── Point the WhatsApp number at this agent (never silently replacing another) ──
    let whatsapp = decideWhatsAppAssignment({
      activate, assign, replace, config: null, agentId: agentId!,
    })
    if (activate && assign) {
      const { data: cfg } = await supabase
        .from('whatsapp_config')
        .select('whatsapp_agent_id')
        .eq('user_id', user.id)
        .maybeSingle()
      whatsapp = decideWhatsAppAssignment({
        activate, assign, replace,
        config: cfg ? { whatsapp_agent_id: (cfg.whatsapp_agent_id as string | null) ?? null } : null,
        agentId: agentId!,
      })
      if (whatsapp.action === 'update') {
        const { error: waErr } = await supabase
          .from('whatsapp_config')
          .update({ whatsapp_agent_id: agentId })
          .eq('user_id', user.id)
        if (waErr) {
          console.error('[quick-setup/save] whatsapp assign failed:', waErr.message)
          notes.push('The assistant was saved, but your WhatsApp number could not be pointed at it. Choose it in AI Agents.')
          whatsapp = { action: 'none', outcome: 'skipped' }
        }
      }
    }

    // The WhatsApp router chooses among ALL of this tenant's active agents,
    // so tell the owner when other agents are active (they may be picked
    // instead of this one for some messages).
    let otherActiveAgents = 0
    if (activate) {
      const { count } = await supabase
        .from('agents')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', user.id)
        .eq('is_active', true)
        .neq('id', agentId)
      otherActiveAgents = count ?? 0
    }

    return NextResponse.json({
      agent_id: agentId,
      is_active: activate,
      created,
      whatsapp: whatsapp.outcome,
      other_active_agents: otherActiveAgents,
      notes,
    })
  } catch {
    console.error('[quick-setup/save] failed')
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
}
