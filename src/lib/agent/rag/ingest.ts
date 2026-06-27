// src/lib/agent/rag/ingest.ts
//
// Reads a merchant's knowledge source (URL, text, FAQ, PDF text),
// splits it into chunks, and stores them in agent_kb_chunks.
//
// Called by:
//   - Brain page UI when merchant uploads a doc or pastes a URL
//   - POST /api/agent/ingest  (API route that calls this)

import { createClient } from '@supabase/supabase-js'

let _client: ReturnType<typeof createClient> | null = null
function db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

export interface IngestSourceArgs {
  tenantId: string
  journeyId: string
  sourceId: string       // brain_sources.id row that triggered this
  sourceType: 'url' | 'text' | 'faq' | 'pdf'
  content?: string       // for type = text / faq (already extracted text)
  url?: string           // for type = url (we fetch it)
}

export interface IngestResult {
  chunksCreated: number
  sourceId: string
  status: 'success' | 'partial' | 'failed'
  error?: string
}

/**
 * Main entry point. Fetches/reads the source, chunks it, stores chunks.
 * Safe to call multiple times — deletes old chunks first (re-ingest on update).
 */
export async function ingestSource(
  args: IngestSourceArgs,
): Promise<IngestResult> {
  try {
    // 1. Get the raw text content
    let rawText: string | null = null

    if (args.sourceType === 'url' && args.url) {
      rawText = await fetchUrlText(args.url)
    } else if (args.content) {
      rawText = args.content
    }

    if (!rawText || rawText.trim().length < 10) {
      return {
        chunksCreated: 0,
        sourceId: args.sourceId,
        status: 'failed',
        error: 'No content extracted from source',
      }
    }

    // 2. Delete old chunks for this source (clean re-ingest)
    await db()
      .from('agent_kb_chunks')
      .delete()
      .eq('source_id', args.sourceId)

    // 3. Split into chunks
    const chunks = chunkText(rawText)
    if (chunks.length === 0) {
      return {
        chunksCreated: 0,
        sourceId: args.sourceId,
        status: 'failed',
        error: 'No chunks generated',
      }
    }

    // 4. Insert chunks in batches of 50
    const rows = chunks.map((content, i) => ({
      tenant_id: args.tenantId,
      journey_id: args.journeyId,
      source_id: args.sourceId,
      chunk_index: i,
      content,
      metadata: {
        source_type: args.sourceType,
        url: args.url ?? null,
        char_count: content.length,
      },
    }))

    // Insert in batches to avoid hitting Supabase body size limits
    const BATCH = 50
    let inserted = 0
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await db()
        .from('agent_kb_chunks')
        .insert(rows.slice(i, i + BATCH))
      if (error) {
        console.error('[rag/ingest] batch insert error:', error.message)
      } else {
        inserted += Math.min(BATCH, rows.length - i)
      }
    }

    // 5. Mark the brain_sources row as ready
    await db()
      .from('brain_sources')
      .update({
        status: 'ready',
        chunk_count: inserted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.sourceId)

    console.log(`[rag/ingest] ${inserted} chunks stored for source ${args.sourceId}`)

    return {
      chunksCreated: inserted,
      sourceId: args.sourceId,
      status: inserted > 0 ? 'success' : 'partial',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[rag/ingest] error:', msg)

    await db()
      .from('brain_sources')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('id', args.sourceId)

    return {
      chunksCreated: 0,
      sourceId: args.sourceId,
      status: 'failed',
      error: msg,
    }
  }
}

/**
 * Fetch a URL and extract its text content.
 * Phase 1: simple fetch + HTML strip (works for server-rendered pages).
 * Phase 2: use Puppeteer for JS-heavy SPAs.
 */
async function fetchUrlText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AiSend-Bot/1.0 (knowledge base indexer)',
        'Accept': 'text/html,text/plain',
      },
      signal: AbortSignal.timeout(10_000), // 10 second timeout
    })

    if (!res.ok) {
      console.warn(`[rag/ingest] URL fetch failed: ${res.status} for ${url}`)
      return null
    }

    const html = await res.text()
    return extractTextFromHtml(html)
  } catch (err) {
    console.error('[rag/ingest] fetchUrlText error:', err)
    return null
  }
}

/**
 * Strip HTML tags and extract readable text.
 * Removes scripts, styles, nav, footer — keeps main content.
 */
function extractTextFromHtml(html: string): string {
  return html
    // Remove script and style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    // Convert block elements to newlines so paragraphs are preserved
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Split text into overlapping chunks for storage.
 *
 * Strategy: split on paragraph boundaries first, then enforce
 * a word-count ceiling. Overlap of ~50 words between chunks
 * prevents answers being cut off at chunk boundaries.
 *
 * Exported so it can be unit-tested independently.
 */
export function chunkText(
  text: string,
  maxWords = 350,
  overlapWords = 50,
): string[] {
  // Split into paragraphs first
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20) // skip very short paragraphs

  const chunks: string[] = []
  let current: string[] = []  // words in current chunk
  let currentWordCount = 0

  for (const para of paragraphs) {
    const words = para.split(/\s+/)

    // If adding this paragraph would exceed the limit
    if (currentWordCount + words.length > maxWords && current.length > 0) {
      // Save current chunk
      chunks.push(current.join(' '))
      // Start next chunk with overlap from end of current
      const overlap = current.slice(-overlapWords)
      current = [...overlap]
      currentWordCount = overlap.length
    }

    current.push(...words)
    currentWordCount += words.length
  }

  // Don't forget the last chunk
  if (current.length > 0) {
    chunks.push(current.join(' '))
  }

  return chunks
}
