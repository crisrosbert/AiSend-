// src/app/api/webhooks/deliveries/[id]/replay/route.ts
//
// Manual redelivery — the dashboard's "Replay" button on a failed or
// abandoned row. Resets the row to pending and attempts it right away
// with the service-role dispatcher; the ownership check happens via
// the session-authenticated SELECT below (RLS), before any
// service-role write.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { attemptDelivery } from '@/lib/webhooks/deliver'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RLS confirms this delivery belongs to the caller before we ever
    // touch it with the service-role client below.
    const { data: owned, error: ownedError } = await supabase
      .from('webhook_deliveries')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (ownedError) return NextResponse.json({ error: ownedError.message }, { status: 500 })
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const admin = supabaseAdmin()
    const { error: resetError } = await admin
      .from('webhook_deliveries')
      .update({
        status: 'pending',
        attempt_count: 0,
        next_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 })

    await attemptDelivery(id)

    const { data: updated } = await supabase
      .from('webhook_deliveries')
      .select('id, status, attempt_count, last_status_code, last_error')
      .eq('id', id)
      .single()

    return NextResponse.json({ delivery: updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
