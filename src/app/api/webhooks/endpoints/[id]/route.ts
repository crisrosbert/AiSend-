// src/app/api/webhooks/endpoints/[id]/route.ts
//
// Update (url/description/events/is_active, or rotate the secret) and
// delete a single endpoint. RLS scopes every query to auth.uid(), same
// as the collection route.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/whatsapp/encryption'
import { generateSecret } from '@/lib/webhooks/sign'
import { isKnownEventType } from '@/lib/webhooks/events'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/webhooks/endpoints/[id]
// Body may include: url, description, events, is_active, rotate_secret.
// When rotate_secret is true, the response includes the new plaintext
// secret once, same as creation.
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.url !== undefined) {
      let parsed: URL
      try {
        parsed = new URL(String(body.url).trim())
      } catch {
        return NextResponse.json({ error: 'url must be a valid URL' }, { status: 400 })
      }
      if (parsed.protocol !== 'https:') {
        return NextResponse.json({ error: 'url must use https://' }, { status: 400 })
      }
      patch.url = parsed.toString()
    }
    if (body.description !== undefined) {
      patch.description = String(body.description).trim() || null
    }
    if (body.events !== undefined) {
      const events = body.events
      if (!Array.isArray(events) || !events.every((e) => typeof e === 'string' && isKnownEventType(e))) {
        return NextResponse.json({ error: 'events must be an array of known event types' }, { status: 400 })
      }
      patch.events = events
    }
    if (body.is_active !== undefined) {
      patch.is_active = !!body.is_active
      if (patch.is_active) {
        // Re-enabling by hand forgives past failures — otherwise one
        // more bad delivery would immediately re-trip the threshold.
        patch.consecutive_failures = 0
        patch.disabled_at = null
      }
    }

    let secret: string | undefined
    if (body.rotate_secret) {
      secret = generateSecret()
      patch.secret_encrypted = encrypt(secret)
    }

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .update(patch)
      .eq('id', id)
      .select('id, url, description, events, is_active, consecutive_failures, disabled_at, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(secret ? { endpoint: data, secret } : { endpoint: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/webhooks/endpoints/[id]
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
