// src/app/api/webhooks/deliveries/route.ts
//
// Recent delivery log for the dashboard — read-only, RLS-scoped.
// ?endpoint_id=<id> narrows to one endpoint (the settings UI shows
// this per-endpoint, expanded on demand).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const endpointId = searchParams.get('endpoint_id')
    const limitParam = Number(searchParams.get('limit') ?? '25')
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 25

    let query = supabase
      .from('webhook_deliveries')
      .select('id, endpoint_id, event_type, event_id, status, attempt_count, next_attempt_at, last_attempt_at, last_status_code, last_error, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (endpointId) query = query.eq('endpoint_id', endpointId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deliveries: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
