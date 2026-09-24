/**
 * ============================================================================
 * File: src/app/api/ai-agent/embed/route.ts
 * Purpose: STEP 2 — Embed one batch of products and return progress
 * ============================================================================
 *
 * Called repeatedly by the frontend after /api/ai-agent/sync completes.
 * Each call embeds up to BATCH_SIZE products that don't have embeddings yet.
 * Frontend loops: POST /embed → check done → POST /embed → … until done.
 *
 * Why batched?
 *   Vercel Hobby plan has a 10s execution limit. Embedding all products
 *   at once would timeout. 10 products per batch ≈ 3-4s, safely under limit.
 *
 * Vector format:
 *   Supabase pgvector accepts embedding as JSON string of float array.
 *   e.g. "[0.12, -0.34, 0.56, ...]" — this is what JSON.stringify() produces.
 *
 * Error handling:
 *   - OpenAI API failure → returns 502, sets embed_status = 'failed'
 *   - DB update failure → logs error, returns 500 with details
 *   - Individual product embed failure → skips it, continues with rest
 * ============================================================================
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// ─── Supabase Admin Client (bypasses RLS) ──────────────────────────────────

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

// ─── Constants ──────────────────────────────────────────────────────────────

const BATCH_SIZE = 10  // 10 products per call ≈ 3-4s (safely under Vercel 10s limit)

// ─── Unicode Sanitizer (same as sync route) ─────────────────────────────────

/**
 * Strip lone surrogates + null bytes from strings before sending to PostgreSQL.
 * Same issue as sync route: Shopify product names/descriptions may contain
 * characters that pgvector/JSONB rejects.
 */
function sanitizeForPg(text: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === 0) continue  // null byte
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0
      if (next >= 0xDC00 && next <= 0xDFFF) {
        result += text[i] + text[i + 1]
        i++
      }
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      // lone low surrogate — skip
    } else {
      result += text[i]
    }
  }
  return result
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST() {
  // ── Auth check ──
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  // ── Fetch next batch of products WITHOUT embeddings ──
  const { data: products, error: fetchErr } = await admin
    .from('ai_agent_products')
    .select('id, external_id, name, description')
    .eq('user_id', user.id)
    .is('embedding', null)
    .limit(BATCH_SIZE)

  if (fetchErr) {
    console.error('[Embed] Fetch error:', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  // ── Count remaining products without embeddings ──
  const { count: remaining } = await admin
    .from('ai_agent_products')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('embedding', null)

  // ── All products already have embeddings → mark done ──
  if (!products || products.length === 0) {
    await admin.from('ai_agent_configs')
      .update({
        embed_status: 'done',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    console.log(`[Embed] All products embedded for user ${user.id}`)
    return NextResponse.json({ done: true, remaining: 0 })
  }

  // ── Build embedding input texts ──
  // Sanitize text to avoid any Unicode issues in the OpenAI API call
  const inputs = products.map((p: { name: string; description: string | null }) => {
    const text = [p.name, p.description].filter(Boolean).join(' — ').slice(0, 500)
    return sanitizeForPg(text)
  })

  console.log(`[Embed] Embedding ${products.length} products (${remaining ?? '?'} remaining)`)

  // ── Call OpenAI Embeddings API ──
  let embJson: { data: Array<{ embedding: number[] }> }

  try {
    const embRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: inputs }),
      signal: AbortSignal.timeout(8_000),  // 8s timeout (Vercel limit is 10s)
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

    embJson = await embRes.json()
  } catch (err) {
    console.error('[Embed] OpenAI request failed:', err)
    await admin.from('ai_agent_configs')
      .update({ embed_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json(
      { error: `OpenAI request failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 502 }
    )
  }

  // ── Save embeddings to database ──
  // Use Promise.allSettled so one failure doesn't block the rest
  const saveResults = await Promise.allSettled(
    products.map((p: { id: string; external_id: string }, idx: number) =>
      admin.from('ai_agent_products')
        .update({
          embedding: JSON.stringify(embJson.data[idx]!.embedding),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('external_id', p.external_id)
        .then((res: { error: { message: string } | null }) => {
          if (res.error) {
            console.error(`[Embed] Failed to save embedding for product ${p.external_id}:`, res.error.message)
            // Fallback: try updating by primary key 'id' instead
            return admin.from('ai_agent_products')
              .update({
                embedding: JSON.stringify(embJson.data[idx]!.embedding),
                updated_at: new Date().toISOString(),
              })
              .eq('id', p.id)
          }
          return res
        })
    )
  )

  // Count how many actually saved
  const savedCount = saveResults.filter((r) => r.status === 'fulfilled').length
  const failedCount = saveResults.filter((r) => r.status === 'rejected').length

  if (failedCount > 0) {
    console.warn(`[Embed] ${failedCount}/${products.length} embeddings failed to save`)
  }

  console.log(`[Embed] Saved ${savedCount}/${products.length} embeddings`)

  // ── Check if all done ──
  // Re-count remaining to be accurate (some may have failed to save)
  const { count: nowRemaining } = await admin
    .from('ai_agent_products')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('embedding', null)

  const isDone = (nowRemaining ?? 0) === 0

  if (isDone) {
    await admin.from('ai_agent_configs')
      .update({
        embed_status: 'done',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    console.log(`[Embed] ✅ All embeddings complete for user ${user.id}`)
  }

  return NextResponse.json({
    done: isDone,
    embedded: savedCount,
    remaining: nowRemaining ?? 0,
  })
}
