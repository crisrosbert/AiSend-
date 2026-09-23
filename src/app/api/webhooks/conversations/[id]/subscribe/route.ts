// src/app/api/webhooks/conversations/[id]/subscribe/route.ts
//
// BYOA handoff: route this one conversation to a webhook endpoint,
// bypassing AiSend's own agent/journey/automation reply pipeline for
// it. Body: { endpoint_id }.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { subscribeConversation } from '@/lib/webhooks/routing'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const endpointId: string | undefined = body?.endpoint_id
    if (!endpointId) return NextResponse.json({ error: 'endpoint_id is required' }, { status: 400 })

    const result = await subscribeConversation(user.id, id, endpointId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
