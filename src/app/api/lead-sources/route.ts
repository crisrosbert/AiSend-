// src/app/api/lead-sources/route.ts
//
// CRUD for `lead_sources` — the API keys a merchant generates from the
// dashboard so their website form, or a Google Ads lead webhook, can
// POST into /api/leads/ingest. Session-authenticated (dashboard-only);
// the generated key itself is what authenticates the external caller.

import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { currentBusinessId } from '@/lib/business/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('lead_sources')
    // Deliberately NOT selecting meta_page_access_token: the Page token
    // never needs to reach the browser.
    .select('id, name, source_type, api_key, is_active, created_at, last_used_at, meta_page_id')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead_sources: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const sourceType = typeof body?.source_type === 'string' ? body.source_type : 'website_form'

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const businessId = await currentBusinessId(supabase, user.id)

  // 32 random bytes of key material — plenty for a bearer secret that
  // is never guessed, only ever leaked, and revocation (deleting the
  // row) is the actual defense against that.
  const apiKey = `aisend_${crypto.randomBytes(24).toString('hex')}`

  const { data, error } = await supabase
    .from('lead_sources')
    .insert({
      user_id: user.id,
      business_id: businessId,
      name,
      source_type: sourceType,
      api_key: apiKey,
    })
    .select('id, name, source_type, api_key, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead_source: data })
}
