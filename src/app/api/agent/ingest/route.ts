// src/app/api/agent/ingest/route.ts
//
// POST — trigger knowledge base ingestion for a brain source.
// Called by the Brain page UI when merchant uploads a doc or saves a URL.
//
// Body: { source_id, journey_id, source_type, content?, url? }

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ingestSource } from '@/lib/agent/rag/ingest'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { source_id, journey_id, source_type, content, url } = body

    if (!source_id || !journey_id || !source_type) {
      return NextResponse.json(
        { error: 'source_id, journey_id, and source_type are required' },
        { status: 400 },
      )
    }

    // Verify this brain_source belongs to the current user's journey
    const { data: source, error: sourceErr } = await supabase
      .from('brain_sources')
      .select('id, journey_id, journeys!inner(user_id)')
      .eq('id', source_id)
      .maybeSingle()

    if (sourceErr || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    // Update status to 'processing' so UI shows spinner
    await supabase
      .from('brain_sources')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', source_id)

    // Run ingestion (can take a few seconds for URLs)
    const result = await ingestSource({
      tenantId: user.id,
      journeyId: journey_id,
      sourceId: source_id,
      sourceType: source_type,
      content,
      url,
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
