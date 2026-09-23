// src/app/api/webhooks/endpoints/route.ts
//
// CRUD for a tenant's own webhook endpoints. Session-authenticated
// (cookie client + RLS), same pattern as /api/canned-replies — every
// query is implicitly scoped to auth.uid() by the table's RLS policy,
// so there's no separate ownership check to get wrong here.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/whatsapp/encryption'
import { generateSecret } from '@/lib/webhooks/sign'
import { isKnownEventType } from '@/lib/webhooks/events'

// GET /api/webhooks/endpoints — list, secret never included
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('id, url, description, events, is_active, consecutive_failures, disabled_at, created_at')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ endpoints: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/webhooks/endpoints — create. Returns the plaintext secret
// exactly once; it is never retrievable again after this response.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const url: string = body?.url
    const description: string | undefined = body?.description
    const events: unknown = body?.events ?? []

    if (!url?.trim()) return NextResponse.json({ error: 'url is required' }, { status: 400 })
    let parsed: URL
    try {
      parsed = new URL(url.trim())
    } catch {
      return NextResponse.json({ error: 'url must be a valid URL' }, { status: 400 })
    }
    if (parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'url must use https://' }, { status: 400 })
    }
    if (!Array.isArray(events) || !events.every((e) => typeof e === 'string' && isKnownEventType(e))) {
      return NextResponse.json({ error: 'events must be an array of known event types' }, { status: 400 })
    }

    const secret = generateSecret()

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .insert({
        user_id: user.id,
        url: parsed.toString(),
        description: description?.trim() || null,
        events,
        secret_encrypted: encrypt(secret),
      })
      .select('id, url, description, events, is_active, consecutive_failures, disabled_at, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ endpoint: data, secret }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
