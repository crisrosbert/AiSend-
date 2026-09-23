// src/app/api/webhooks/conversations/[id]/unsubscribe/route.ts
//
// Hand a conversation back to AiSend's own agent/journey/automation
// pipeline.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { unsubscribeConversation } from '@/lib/webhooks/routing'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await unsubscribeConversation(user.id, id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
