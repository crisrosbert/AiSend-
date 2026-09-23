// src/lib/agent/rag/retrieve.ts
//
// Phase 1: vector similarity via pgvector — matches on meaning, so
//          "do you take walk-ins?" can find a page that only ever says
//          "appointments welcome, no booking required". Needs
//          OPENAI_API_KEY and 010_kb_chunk_embeddings.sql applied.
// Phase 2: full-text keyword search via Postgres tsvector/tsquery —
//          the original implementation, still what answers every query
//          until the phase 1 migration is applied, and still what
//          answers when phase 1 finds nothing (a chunk stored before
//          010_kb_chunk_embeddings.sql has no embedding yet).
// Phase 3: plain ILIKE, if even the full-text RPC isn't installed.
//
// Called by: src/lib/agent/tools/knowledge-base-tools.ts
// Database:  agent_kb_chunks (created in 015_agent_tables.sql, embedding
//            column added in 2026_09_23_kb_chunk_embeddings.sql)

import { createClient } from '@supabase/supabase-js'
import { embedText, hasEmbeddingKey } from './embed'

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
  /**
   * Which Brain to read.
   *
   *   string    — that journey only.
   *   null      — the caller knows the scope and it is EMPTY. Return
   *               nothing. This is an agent that has never been trained.
   *   undefined — no scope given: search everything this tenant owns.
   *
   * The null/undefined split is the whole point. They used to be the
   * same value, so an agent with no journey fell through to a
   * tenant-wide search and answered out of a different site's pages —
   * a fashion shop quoting a surgery clinic. "I have no knowledge" and
   * "give me all knowledge" must never collapse into one case.
   */
  journeyId?: string | null
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
 * Phase 1 — vector similarity, when OPENAI_API_KEY is set. Matches on
 * meaning: "walk-ins?" can find a page that only ever says "no booking
 * required" without sharing a single word with the question.
 * Phase 2 — Postgres full-text search, always available, and what
 * answers when phase 1 is unconfigured or finds nothing (a chunk stored
 * before the embedding column existed has no vector yet).
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

    // An explicit null scope means there is no Brain to read. Answering
    // from another journey's chunks would be worse than answering from
    // nothing: the agent sounds confident and is describing someone
    // else's business.
    if (args.journeyId === null) return []

    // ── Phase 1: vector similarity via pgvector ──
    const vectorResults = await tryVectorSearch(args, max)
    if (vectorResults && vectorResults.length > 0) return vectorResults

    // ── Phase 2: Postgres full-text search via RPC ──
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
 * Vector similarity via the match_kb_chunks RPC
 * (2026_09_23_kb_chunk_embeddings.sql).
 *
 * Returns null — not [] — for "vector search isn't available right
 * now", so the caller knows to fall through to full-text search rather
 * than reporting a genuine zero-match empty answer. An empty array
 * means "asked pgvector, it found nothing"; null means "didn't get to
 * ask" (no key, RPC missing, embedding call failed).
 */
async function tryVectorSearch(
  args: RetrieveArgs,
  max: number,
): Promise<KnowledgeChunk[] | null> {
  if (!hasEmbeddingKey()) return null

  let queryEmbedding: number[]
  try {
    queryEmbedding = await embedText(args.query)
  } catch (err) {
    console.error('[rag/retrieve] query embedding failed:', err)
    return null
  }

  const { data, error } = await db().rpc('match_kb_chunks', {
    p_tenant_id: args.tenantId,
    p_journey_id: args.journeyId ?? null,
    p_query_embedding: queryEmbedding,
    p_max: max,
  })

  if (error) {
    // Expected until 2026_09_23_kb_chunk_embeddings.sql is applied —
    // logged at a lower level than the full-text error below, since
    // this one is the normal state for every tenant until they migrate.
    console.warn('[rag/retrieve] vector search unavailable:', error.message)
    return null
  }

  if (!data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => ({
    id: row.id,
    content: row.content,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    score: row.rank,
  }))
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
