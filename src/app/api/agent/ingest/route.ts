// src/app/api/agent/ingest/route.ts
//
// POST — trigger knowledge base ingestion for a brain source.
// Called by the Brain page UI when a merchant uploads a doc or saves a URL.
//
// Body: { source_id, journey_id, source_type, content?, url? }
//
// Hardened: verifies the source belongs to the current user before
// ingesting, validates inputs, and never leaves a source stuck
// "processing" if ingestion fails.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ingestSource } from '@/lib/agent/rag/ingest'

// Mutating action — never cache.
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // ── Auth ──
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse + validate body ──
    const body = await req.json().catch(() => ({}))
    const { source_id, journey_id, source_type, content, url } = body

    if (!source_id || !journey_id || !source_type) {
      return NextResponse.json(
        { error: 'source_id, journey_id, and source_type are required' },
        { status: 400 },
      )
    }

    // ── Verify ownership: the brain_source must belong to a journey the
    //    current user owns. (The original fetched the owner but never
    //    actually checked it — this closes that gap.) ──
    const { data: source, error: sourceErr } = await supabase
      .from('brain_sources')
      .select('id, journey_id, journeys!inner(user_id)')
      .eq('id', source_id)
      .maybeSingle()

    if (sourceErr) {
      console.error('[agent/ingest] source lookup error:', sourceErr.message)
      return NextResponse.json({ error: 'Could not verify source' }, { status: 500 })
    }
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    // journeys!inner(user_id) may be an object or a 1-element array.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const j: any = (source as any).journeys
    const ownerId = Array.isArray(j) ? j[0]?.user_id : j?.user_id
    if (ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (source.journey_id !== journey_id) {
      return NextResponse.json({ error: 'journey_id mismatch for this source' }, { status: 400 })
    }

    // ── Mark processing so the UI can show a spinner ──
    await supabase
      .from('brain_sources')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', source_id)

    // ── Run ingestion. If it throws, revert status so the source doesn't
    //    spin forever, and surface the error. ingestSource owns setting
    //    the final success status, exactly as before. ──
    try {
      const result = await ingestSource({
        tenantId: user.id,
        journeyId: journey_id,
        sourceId: source_id,
        sourceType: source_type,
        content,
        url,
      })
      return NextResponse.json({ ok: true, ...result })
    } catch (ingestErr) {
      console.error('[agent/ingest] ingestion failed:', ingestErr)
      // Revert to 'pending' (a status the original flow already used) so
      // the UI stops spinning and the user can retry. We avoid inventing
      // a new status value that might violate a CHECK constraint.
      await supabase
        .from('brain_sources')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', source_id)
      return NextResponse.json(
        { error: ingestErr instanceof Error ? ingestErr.message : 'Ingestion failed' },
        { status: 500 },
      )
    }
  } catch (err) {
    console.error('[agent/ingest] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
