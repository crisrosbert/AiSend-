/**
 * File: src/app/api/ai-agent/embed/route.ts
 * Purpose: STEP 2 — Embed one batch of products and return progress.
 * Called repeatedly by the frontend until all products have embeddings.
 * Each call embeds up to BATCH_SIZE products (stays under 10s Vercel limit).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function supabaseAdmin(): any {
  if (!_admin) {
    _admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

const BATCH_SIZE = 5 // 5 products per call ≈ 2–3s, safely under 10s limit

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = supabaseAdmin()

  // Mark embedding running
  await admin.from('ai_agent_configs')
    .update({ embed_status: 'running', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  // Fetch next batch of products without embeddings
  const { data: products, error: fetchErr } = await admin
    .from('ai_agent_products')
    .select('id, external_id, name, description')
    .eq('user_id', user.id)
    .is('embedding', null)
    .limit(BATCH_SIZE)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  // Count remaining (including this batch)
  const { count: remaining } = await admin
    .from('ai_agent_products')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('embedding', null)

  if (!products || products.length === 0) {
    // All done
    await admin.from('ai_agent_configs')
      .update({
        embed_status: 'done',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    return NextResponse.json({ done: true, remaining: 0 })
  }

  // Call OpenAI embeddings
  const inputs = products.map((p: { name: string; description: string | null }) =>
    [p.name, p.description].filter(Boolean).join(' — ').slice(0, 500)
  )

  const embRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: inputs }),
    signal: AbortSignal.timeout(8_000),
  })

  if (!embRes.ok) {
    const errText = await embRes.text()
    console.error('[Embed] OpenAI error:', embRes.status, errText)
    await admin.from('ai_agent_configs')
      .update({ embed_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json(
      { error: `OpenAI error ${embRes.status}: ${errText}` },
      { status: 502 }
    )
  }

  const embJson = await embRes.json() as { data: Array<{ embedding: number[] }> }

  // Save embeddings
  await Promise.all(
    products.map((p: { external_id: string }, idx: number) =>
      admin.from('ai_agent_products')
        .update({
          embedding: JSON.stringify(embJson.data[idx]!.embedding),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('external_id', p.external_id)
    )
  )

  const stillRemaining = (remaining ?? 0) - products.length
  const isDone = stillRemaining <= 0

  if (isDone) {
    await admin.from('ai_agent_configs')
      .update({
        embed_status: 'done',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
  }

  return NextResponse.json({
    done: isDone,
    embedded: products.length,
    remaining: Math.max(0, stillRemaining),
  })
}
