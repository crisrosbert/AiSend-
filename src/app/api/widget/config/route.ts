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
  /**
   * What this agent is for, drafted from its own site. Drives the
   * teaser. Optional because it arrived in a later migration and rows
   * written before it have no value.
   */
  role?: string | null
}

/**
 * The line on the little pop-up bubble, before the chat is opened.
 *
 * It lives on widget_configs, which means one tenant gets one teaser —
 * so a clinic, a fashion label and an estate agency all greeted their
 * visitors with "Questions about gynecomastia treatment?". Whichever
 * business was configured first wrote the line every other business
 * then showed to its customers.
 *
 * Built from the agent instead. `role` is a description of what this
 * agent does ("Real estate consultant for luxury properties"), drafted
 * from that agent's own website, so it is both specific and already
 * per-agent. The name is the fallback because it is the one thing
 * every agent has.
 */
export function agentBubble(agent: AgentProfile): string | null {
  const role = agent.role?.trim()
  // Long roles get truncated to nothing useful in a 260px bubble, and a
  // teaser that wraps to five lines is worse than a generic one.
  if (role && role.length <= 60) return `Hi! 👋 ${role} — ask me anything.`

  const name = agent.name?.trim()
  if (name) return `Hi! 👋 Questions about ${name}? Ask me anything.`

  return null
}

/**
 * Merge the agent's profile into the widget config.
 *
 * These live on `agents` because that is where the crawl writes them and
 * where the Agents drawer edits them — but the widget only ever fetches
 * `widget_configs`, so until now the logo we extracted had nowhere to
 * go and the header rendered a hardcoded icon.
 *
 * ── WHOSE VALUES WIN DEPENDS ON WHOSE ROW IT IS ────────────────────
 *
 * `shared` says the config row does not belong to this agent: nothing
 * created a row for it, so it fell back to the tenant's org-wide row.
 * That row describes whichever business was set up first. On a tenant
 * running one business that is harmless. On a tenant running three —
 * a clinic, a fashion label, an estate agency — it means the estate
 * agency's widget opens with the clinic's name, the clinic's greeting
 * and the clinic's logo, because the clinic was configured in January.
 *
 * So:
 *   • shared row  — it contributes NO identity whatsoever. Not "the
 *     agent's values where it has them": where the agent has nothing,
 *     the field is derived from its name or cleared, never inherited.
 *     An agent trained but not yet approved has no saved greeting, and
 *     inheriting there is what let a sports-venue site open with
 *     "Hey! I'm Riya from Kalosa Aesthetics."
 *   • the agent's OWN row — the merchant configured that row for this
 *     agent deliberately. A greeting they typed ("Hey! I'm Riya from
 *     Kalosa") beats a drafted one, so only blanks are filled in.
 *
 * Styling — colour, position, trigger delay — is inherited either way.
 * It says nothing about WHICH business this is, so borrowing it is a
 * useful default rather than a false claim.
 */
export function mergeAgentProfile(
  view: Record<string, unknown>,
  agent: AgentProfile | null,
  opts: { shared?: boolean } = {},
): Record<string, unknown> {
  if (!agent) return view

  const merged = { ...view }
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const name = agent.name?.trim()

  // ── A borrowed row contributes NO identity, not "identity the agent
  //    happens to be missing" ─────────────────────────────────────────
  //
  // The first version of this only replaced a field when the agent had
  // a value of its own, which left the hole this is closing. An agent
  // trained but not yet approved has no greeting saved — the drafted
  // one is still sitting in the review panel waiting for Use — so the
  // borrowed row's greeting survived, and a sports-venue booking site
  // opened with "Hey! I'm Riya from Kalosa Aesthetics."
  //
  // Being absent has to mean absent. Where the agent cannot supply a
  // value we build a neutral one from its name, or clear the field —
  // both are better than confidently introducing another business.
  if (opts.shared) {
    merged.bot_name = name || 'Assistant'
    merged.welcome_message =
      agent.greeting?.trim() ||
      (name ? `Hi! How can I help you with ${name} today?` : 'Hi! How can I help you today?')
    // A borrowed logo is another company's trademark on this widget.
    // The script falls back to its own chat icon when this is empty.
    merged.avatar_url = agent.avatar_url || null

    if (Array.isArray(agent.suggested_questions) && agent.suggested_questions.length > 0) {
      merged.suggested_questions = agent.suggested_questions.slice(0, 3)
    } else {
      // Chips answerable only out of another business's pages.
      delete merged.suggested_questions
    }

    merged.bubble_message = agentBubble(agent) ?? undefined
    return merged
  }

  // ── The agent's own row: the merchant configured this one on purpose
  if (agent.avatar_url) merged.avatar_url = agent.avatar_url
  if (name && !text(view.bot_name)) merged.bot_name = name
  if (agent.greeting && !text(view.welcome_message)) merged.welcome_message = agent.greeting

  if (Array.isArray(agent.suggested_questions) && agent.suggested_questions.length > 0) {
    merged.suggested_questions = agent.suggested_questions.slice(0, 3)
  }

  // ── The teaser always follows the agent ──
  //
  // Unlike the name and greeting, this one overrides the stored value
  // even on the agent's own row. There is no per-agent way to author a
  // teaser — /widget writes a single line for the whole tenant — so a
  // stored value here is not evidence that anyone chose it FOR THIS
  // AGENT. It is far likelier to be another business's line, which is
  // exactly the symptom: three widgets, three businesses, one teaser
  // about gynecomastia.
  //
  // The tradeoff is deliberate: a tenant with one agent who hand-wrote
  // a teaser loses it. That is worth fixing properly by giving agents
  // their own teaser field, not by leaving every multi-business tenant
  // advertising the wrong business.
  const bubble = agentBubble(agent)
  if (bubble) merged.bubble_message = bubble

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
    // Remembered, because it changes whose identity the widget shows:
    // a borrowed row's name and greeting describe another business.
    let usedSharedConfig = false

    if (!config && agent) {
      const { data: orgConfig } = await db()
        .from('widget_configs')
        .select('*')
        .eq('is_active', true)
        .eq('org_user_id', org)
        .is('agent_id', null)
        .maybeSingle()
      if (orgConfig) {
        config = orgConfig
        usedSharedConfig = true
      }
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
        .select('name, avatar_url, greeting, suggested_questions, role')
        .eq('id', agentId)
        .eq('tenant_id', config.org_user_id)
        .maybeSingle()
      if (row) profile = row
    }

    return NextResponse.json(
      mergeAgentProfile(publicView(config), profile, { shared: usedSharedConfig }),
      { headers: CORS },
    )
  } catch (err) {
    console.error('[widget/config] error:', err)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: CORS },
    )
  }
}
