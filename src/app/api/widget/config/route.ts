// src/app/api/widget/config/route.ts
//
// Public GET endpoint the widget.js calls on load to fetch appearance
// + behavior settings. Identified by ?org=<user_id> and optional ?agent=<agent_id>.
// Returns only safe, public fields (no secrets).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { allowlistFromConfig, originAllowed, corsHeaders } from '@/lib/widget/origin'

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

const OPEN_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: OPEN_CORS })
}

// What the widget on a stranger's page is allowed to know.
//
// The route previously answered with select('*'), so every column of
// widget_configs went to every visitor — including any column added
// later for internal use. An allowlist of fields cannot leak a column
// that does not exist yet; a SELECT * inevitably will.
// The first six are READ BY public/widget.js and the widget breaks
// without them — business_phone in particular is the WhatsApp handoff
// button. widget-config-fields.test.ts reads widget.js and fails if it
// ever references a field missing from this list, so the two cannot
// drift apart silently.
export const PUBLIC_FIELDS = [
  'bot_name',
  'welcome_message',
  'bubble_message',
  'business_phone',
  'primary_color',
  'trigger_delay_seconds',
  // Not read by widget.js today, but safe and useful to serve.
  'id',
  'org_user_id',
  'agent_id',
  'is_active',
  'greeting',
  'placeholder',
  'accent_color',
  'position',
  'avatar_url',
  'logo_url',
  'theme',
  'launcher_text',
  'show_branding',
  'offline_message',
  'allowed_domains',
  // Merged in from the agent by mergeAgentProfile() when widget_configs
  // has no value of its own. Listed here so the field test counts them
  // as served.
  'suggested_questions',
] as const

/** Drop anything not on the public list, and never echo the allowlist itself. */
export function publicView(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of PUBLIC_FIELDS) {
    // allowed_domains is read to enforce the check, not to publish —
    // telling a caller which origins pass is telling them what to forge.
    if (key === 'allowed_domains') continue
    if (key in config) out[key] = config[key]
  }
  return out
}

/** The agent's own face: what the crawl found and the merchant approved. */
interface AgentProfile {
  avatar_url: string | null
  greeting: string | null
  suggested_questions: string[] | null
  name: string | null
}

/**
 * Merge the agent's profile into the widget config.
 *
 * These live on `agents` because that is where the crawl writes them and
 * where the Agents drawer edits them — but the widget only ever fetches
 * `widget_configs`, so until now the logo we extracted had nowhere to
 * go and the header rendered a hardcoded icon.
 *
 * Precedence is deliberately not uniform:
 *
 *   • welcome_message wins over the agent's greeting. A merchant who
 *     typed their own opening ("Hey! I'm Riya from Kalosa") means it,
 *     and a drafted greeting must not silently replace it.
 *   • avatar_url and suggested_questions have no existing equivalent on
 *     widget_configs, so the agent's values are simply used.
 */
export function mergeAgentProfile(
  view: Record<string, unknown>,
  agent: AgentProfile | null,
): Record<string, unknown> {
  if (!agent) return view

  const merged = { ...view }

  if (agent.avatar_url) merged.avatar_url = agent.avatar_url

  // Only fill the greeting when the widget has none of its own.
  const existing = typeof view.welcome_message === 'string' ? view.welcome_message.trim() : ''
  if (!existing && agent.greeting) merged.welcome_message = agent.greeting

  if (Array.isArray(agent.suggested_questions) && agent.suggested_questions.length > 0) {
    merged.suggested_questions = agent.suggested_questions.slice(0, 3)
  }

  return merged
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin')
  let CORS: Record<string, string> = OPEN_CORS

  try {
    const { searchParams } = new URL(req.url)
    const org = searchParams.get('org')
    const agent = searchParams.get('agent')

    let configQuery = db()
      .from('widget_configs')
      .select('*')
      .eq('is_active', true)

    // Prefer resolving by agent_id (multi-agent). Fall back to the
    // tenant's legacy null-agent row so org-only embeds still work
    // even when multiple agent configs exist.
    if (agent) {
      configQuery = configQuery.eq('agent_id', agent)
    } else {
      configQuery = configQuery.eq('org_user_id', org).is('agent_id', null)
    }

    let { data: config } = await configQuery.maybeSingle()

    // An agent-scoped embed (data-agent=...) looks for that agent's own
    // widget config. Nothing in the app creates one — /widget only ever
    // writes the tenant's org-wide row — so without this fallback every
    // embed copied from the Agents page resolves to nothing and the
    // visitor is told the chat "is not configured yet".
    //
    // Falling back keeps per-agent configs available for anyone who
    // later wants a different colour or greeting per agent, while making
    // the common case work with no extra setup.
    if (!config && agent) {
      const { data: orgConfig } = await db()
        .from('widget_configs')
        .select('*')
        .eq('is_active', true)
        .eq('org_user_id', org)
        .is('agent_id', null)
        .maybeSingle()
      if (orgConfig) config = orgConfig
    }

    if (!config) {
      return NextResponse.json(
        { error: 'Widget not found or inactive' },
        { status: 404, headers: CORS },
      )
    }

    // The config carries the merchant's branding and greeting. Serving
    // it to any origin lets someone stand up a convincing copy of the
    // business's chat on their own page.
    const allowlist = allowlistFromConfig(config)
    CORS = corsHeaders(origin, allowlist, 'GET, OPTIONS')

    if (!originAllowed(origin, allowlist)) {
      return NextResponse.json(
        { error: 'Widget not enabled for this website' },
        { status: 403, headers: CORS },
      )
    }

    // ── The agent's face ──
    //
    // Resolved the same way /api/widget/message resolves it: the
    // config's own agent_id first, then the embed's ?agent= — but only
    // after checking that agent belongs to this tenant, because the
    // query string comes from a public script tag and would otherwise
    // let any page borrow another tenant's branding.
    let profile: AgentProfile | null = null
    const agentId: string | null = config.agent_id ?? (agent || null)

    if (agentId) {
      const { data: row } = await db()
        .from('agents')
        .select('name, avatar_url, greeting, suggested_questions')
        .eq('id', agentId)
        .eq('tenant_id', config.org_user_id)
        .maybeSingle()
      if (row) profile = row
    }

    return NextResponse.json(mergeAgentProfile(publicView(config), profile), {
      headers: CORS,
    })
  } catch (err) {
    console.error('[widget/config] error:', err)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: CORS },
    )
  }
}
