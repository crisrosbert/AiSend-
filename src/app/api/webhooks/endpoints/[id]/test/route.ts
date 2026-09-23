// src/app/api/webhooks/endpoints/[id]/test/route.ts
//
// "Send test event" button — a test.ping delivery to exactly this
// endpoint, so a developer can verify signature parsing and their
// receiver's plumbing without waiting for a real WhatsApp message.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emitWebhookEventToEndpoint } from '@/lib/webhooks/dispatch'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RLS confirms ownership before the service-role dispatcher touches it.
    const { data: endpoint, error: endpointError } = await supabase
      .from('webhook_endpoints')
      .select('id, is_active')
      .eq('id', id)
      .maybeSingle()
    if (endpointError) return NextResponse.json({ error: endpointError.message }, { status: 500 })
    if (!endpoint) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!endpoint.is_active) return NextResponse.json({ error: 'Endpoint is disabled' }, { status: 400 })

    await emitWebhookEventToEndpoint({
      userId: user.id,
      endpointId: id,
      type: 'test.ping',
      data: { message: 'This is a test event from AiSend.' },
    })

    const { data: delivery } = await supabase
      .from('webhook_deliveries')
      .select('id, status, last_status_code, last_error')
      .eq('endpoint_id', id)
      .eq('event_type', 'test.ping')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ delivery: delivery ?? null })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
