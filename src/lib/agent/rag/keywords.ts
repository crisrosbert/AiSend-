// src/lib/agent/rag/keywords.ts
//
// Plain keyword helpers for the knowledge-base fallback search.
//
// Why: the main search (Postgres full-text) can require EVERY word of the
// question to appear in one chunk. "What does gynecomastia surgery involve?"
// then finds nothing when the FAQ says "Gynecomastia surgery removes excess
// breast tissue ...", because the word "involve" is not in it. The model is
// then told NOT FOUND and answers "I can't provide details" although the
// answer is in the knowledge base. This fallback drops filler words, trims
// word endings, and ranks chunks by how many of the remaining words they
// contain.
//
// Pure functions, no I/O. Used by rag/retrieve.ts.

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'for', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'is', 'are', 'was', 'were',
  'be', 'been', 'do', 'does', 'did', 'done', 'can', 'could', 'will', 'would', 'should', 'shall', 'may', 'might', 'have', 'has', 'had',
  'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'any', 'some', 'there', 'here', 'this', 'that', 'these', 'those',
  'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'about', 'into', 'than', 'then', 'also', 'just', 'tell', 'please', 'kindly',
  'want', 'need', 'know', 'get', 'give', 'say', 'like', 'much', 'many', 'very', 'really', 'involve', 'involves', 'involved',
])

/** Strip a common ending so "involves/involved/involving" and "surgeries" meet their root. */
function trim(word: string): string {
  if (word.length <= 5) return word
  for (const end of ['ing', 'ies', 'ed', 'es', 's']) {
    if (word.endsWith(end) && word.length - end.length >= 4) return end === 'ies' ? `${word.slice(0, -3)}y` : word.slice(0, -end.length)
  }
  return word
}

/**
 * The words worth searching for: lower case, letters and digits only (so they
 * are safe inside a PostgREST filter), at least 3 characters, no filler words.
 * At most `max` terms, longest first (longer words are more specific).
 */
export function extractSearchTerms(query: string, max = 6): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of (query ?? '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOP.has(raw)) continue
    const t = trim(raw)
    if (t.length < 3 || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out.sort((a, b) => b.length - a.length).slice(0, max)
}

/** How many of the terms appear in the text. */
export function termHits(text: string, terms: string[]): number {
  const lower = (text ?? '').toLowerCase()
  let n = 0
  for (const t of terms) if (lower.includes(t)) n++
  return n
}

/** Keep rows that contain at least one term, best match first, at most `max`. */
export function rankByTerms<T extends { content: string }>(rows: T[], terms: string[], max: number): Array<T & { hits: number }> {
  return rows
    .map((r) => ({ ...r, hits: termHits(r.content, terms) }))
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, max)
}
