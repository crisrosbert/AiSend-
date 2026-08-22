// src/app/api/widget/lead/route.ts
//
// Public endpoint the website widget POSTs a completed lead form to.
//
// This is the last link in the lead chain:
//   AI calls submit_lead  ->  engine returns showLeadForm
//   -> /api/widget/message forwards it  ->  widget.js renders the form
//   -> the visitor submits  ->  HERE  ->  row in `leads`, visible on /leads
//
// Trust model: this route is unauthenticated (it runs on the customer's own
// website), so nothing from the browser is trusted as identity. The agent and
// tenant are re-derived server-side from the widget config, and the submitted
// values are only ever written as lead fields — never used to pick the tenant.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { allowlistFromConfig, originAllowed, corsHeaders } from '@/lib/widget/origin'
import { businessIdForAgent } from '@/lib/business/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null
function db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

// Used before we know which widget is being addressed.
const OPEN_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OPEN_CORS })
}

/** Keep free-text short so a scripted flood can't bloat the table. */
function clean(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  let CORS: Record<string, string> = OPEN_CORS

  try {
    const body = await req.json().catch(() => ({}))
    const { org_id, agent_id, visitor_id, fields } = body

    if (!org_id || !visitor_id || typeof fields !== 'object' || fields === null) {
      return NextResponse.json(
        { error: 'org_id, visitor_id and fields are required' },
        { status: 400, headers: CORS },
      )
    }

    // Resolve the widget config the same way /message does, so a caller
    // cannot write a lead against a tenant that has no active widget.
    let cfgQuery = db().from('widget_configs').select('*').eq('is_active', true)
    if (agent_id) cfgQuery = cfgQuery.eq('agent_id', agent_id)
    else cfgQuery = cfgQuery.eq('org_user_id', org_id).is('agent_id', null)

    const { data: config } = await cfgQuery.maybeSingle()
    if (!config) {
      return NextResponse.json(
        { error: 'Widget not found or inactive' },
        { status: 404, headers: CORS },
      )
    }

    // Only accept leads from a page the merchant listed. Lead rows are
    // the one thing here that a competitor would pay to pollute, and a
    // flood of fake rows is worse than none — it destroys trust in the
    // whole list.
    const allowlist = allowlistFromConfig(config)
    CORS = corsHeaders(origin, allowlist)

    if (!originAllowed(origin, allowlist)) {
      console.warn(`[widget/lead] blocked origin ${origin ?? '(none)'} for org ${org_id}`)
      return NextResponse.json(
        { error: 'This form is not enabled for this website.' },
        { status: 403, headers: CORS },
      )
    }

    // Bind the lead to the visitor's real conversation. Taking this from the
    // session rather than the request body stops one visitor attaching leads
    // to another visitor's thread.
    const { data: session } = await db()
      .from('widget_sessions')
      .select('conversation_id')
      .eq('org_user_id', config.org_user_id)
      .eq('visitor_id', visitor_id)
      .maybeSingle()

    const conversationId: string | null = session?.conversation_id ?? null

    // The agent's business, falling back to the config's. A lead filed
    // under the wrong business is worse than a missing one: it shows up
    // in a list someone trusts, and nothing about it looks wrong.
    const businessId =
      (await businessIdForAgent(db(), config.agent_id)) ?? config.business_id ?? null

    const record = {
      tenant_id: config.org_user_id,
      business_id: businessId,
      agent_id: config.agent_id ?? null,
      conversation_id: conversationId,
      first_name: clean(fields.first_name, 80),
      last_name: clean(fields.last_name, 80),
      phone: clean(fields.phone, 24),
      email: clean(fields.email, 160),
      company_name: clean(fields.company_name, 120),
      source: 'website_widget',
      status: 'new',
      extra: { page_url: clean(body.page_url, 500), visitor_id: String(visitor_id).slice(0, 64) },
    }

    // A lead with no way to reach the person is worthless — and usually a bot.
    if (!record.phone && !record.email) {
      return NextResponse.json(
        { error: 'A phone number or email is required' },
        { status: 400, headers: CORS },
      )
    }

    const { error } = await db().from('leads').insert(record)
    if (error) {
      console.error('[widget/lead] insert failed:', error.message)
      return NextResponse.json(
        { error: 'Could not save your details. Please try again.' },
        { status: 500, headers: CORS },
      )
    }

    // Surface the new lead to the team and keep the transcript honest about
    // what happened, so the inbox reads correctly on follow-up.
    if (conversationId) {
      const who = [record.first_name, record.last_name].filter(Boolean).join(' ') || 'A visitor'
      const contact = record.phone || record.email
      await db().from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'system',
        content_type: 'text',
        content_text: `📋 Lead captured — ${who} (${contact})`,
        status: 'delivered',
        created_at: new Date().toISOString(),
      })
      await db()
        .from('conversations')
        .update({ needs_attention: true, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    }

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err) {
    console.error('[widget/lead] error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500, headers: CORS },
    )
  }
}
