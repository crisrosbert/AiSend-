// src/app/api/widget/config/route.ts
//
// Public GET endpoint the widget.js calls on load to fetch appearance
// + behavior settings. Identified by ?org=<user_id>.
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

    if (!org) {
      return NextResponse.json(
        { error: 'org parameter required' },
        { status: 400, headers: CORS },
      )
    }

    const { data: config } = await db()
      .from('widget_configs')
      .select('bot_name, bubble_message, welcome_message, primary_color, trigger_delay_seconds, business_phone, is_active')
      .eq('org_user_id', org)
      .eq('is_active', true)
      .maybeSingle()

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
