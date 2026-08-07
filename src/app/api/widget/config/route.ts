// src/app/api/widget/config/route.ts
//
// Public GET endpoint the widget.js calls on load to fetch appearance
// + behavior settings. Identified by ?org=<user_id> and optional ?agent=<agent_id>.
// Returns only safe, public fields (no secrets).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: Request) {
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

    return NextResponse.json(config, { headers: CORS })
  } catch (err) {
    console.error('[widget/config] error:', err)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: CORS },
    )
  }
}
