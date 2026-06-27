// src/lib/agent/rag/retrieve.ts
//
// Phase 1: full-text keyword search via Postgres tsvector/tsquery.
// Phase 2: vector similarity via pgvector (uncomment when ready).
//
// Called by: src/lib/agent/tools/knowledge-base-tools.ts
// Database:  agent_kb_chunks (created in 015_agent_tables.sql)

import { createClient } from '@supabase/supabase-js'

// Untyped admin client. We cast to `any` because this project does not
// generate Supabase types — same pattern as src/lib/journeys/runner.ts.
// Without this, .from()/.rpc() infer `never` and break the build.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null
function db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

export interface RetrieveArgs {
  tenantId: string
  journeyId?: string  // scope to one journey's Brain, or null = all
  query: string
  maxChunks?: number  // default 5
}

export interface KnowledgeChunk {
  id: string
  content: string
  sourceId: string
  chunkIndex: number
  score: number       // relevance score 0-1
}

/**
 * Find the most relevant knowledge chunks for a query.
 *
 * Phase 1 — keyword search using Postgres full-text search.
 * Works out of the box with no extra extensions. Good for FAQs,
 * pricing, timings, policies — structured SMB content.
 *
 * Returns empty array (never throws) so the agent can gracefully
 * fall back to its base knowledge when no chunks match.
 */
export async function retrieve(
  args: RetrieveArgs,
): Promise<KnowledgeChunk[]> {
  try {
    const max = args.maxChunks ?? 5
    const query = args.query.trim()
    if (!query) return []

    // ── Phase 1: Postgres full-text search via RPC ──
    const { data, error } = await db().rpc('search_kb_chunks', {
      p_tenant_id: args.tenantId,
      p_journey_id: args.journeyId ?? null,
      p_query: query,
      p_max: max,
    })

    if (error) {
      console.error('[rag/retrieve] search error:', error.message)
      // Fall back to simple ILIKE if the RPC doesn't exist yet
      return await fallbackIlike(args, max)
    }

    if (!data || data.length === 0) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map((row) => ({
      id: row.id,
      content: row.content,
      sourceId: row.source_id,
      chunkIndex: row.chunk_index,
      score: row.rank,
    }))
  } catch (err) {
    console.error('[rag/retrieve] unhandled error:', err)
    return []
  }
}

/**
 * Fallback: simple ILIKE search when the FTS RPC is not yet installed.
 * Slower but zero setup — works immediately after table creation.
 */
async function fallbackIlike(
  args: RetrieveArgs,
  max: number,
): Promise<KnowledgeChunk[]> {
  const words = args.query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)

  if (words.length === 0) return []

  const filter = words.map((w) => `content.ilike.%${w}%`).join(',')

  let q = db()
    .from('agent_kb_chunks')
    .select('id, content, source_id, chunk_index')
    .eq('tenant_id', args.tenantId)
    .or(filter)
    .limit(max)

  if (args.journeyId) {
    q = q.eq('journey_id', args.journeyId)
  }

  const { data, error } = await q

  if (error || !data) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row, i: number) => ({
    id: row.id,
    content: row.content,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    score: 1 - i * 0.1,
  }))
}
