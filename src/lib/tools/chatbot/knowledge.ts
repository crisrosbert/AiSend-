// Turns crawled pages into small searchable chunks and finds the ones that
// answer a visitor's question. Plain keyword scoring: no embeddings, so the
// free demo needs no vector store and costs nothing to run.

export interface KnowledgeChunk {
  title: string
  url: string
  text: string
}

export const MAX_CHUNK_CHARS = 1100
export const MAX_KNOWLEDGE_CHARS = 40_000
/** How much site text goes into one prompt. Everything is sent, best passages first. */
export const PROMPT_BUDGET_CHARS = 32_000

const STOP = new Set(
  'a an and are as at be but by can do does for from has have how i in is it its me my of on or our so than that the their them then there these they this to us was we what when where which who why will with you your'.split(' '),
)

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9ऀ-ॿ]{2,}/g) ?? []).filter((w) => !STOP.has(w))
}

function splitLong(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text]
  const out: string[] = []
  let cur = ''
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (cur && cur.length + sentence.length + 1 > MAX_CHUNK_CHARS) {
      out.push(cur)
      cur = ''
    }
    // A single sentence with no breaks at all: hard-cut it.
    if (sentence.length > MAX_CHUNK_CHARS) {
      for (let i = 0; i < sentence.length; i += MAX_CHUNK_CHARS) out.push(sentence.slice(i, i + MAX_CHUNK_CHARS))
    } else {
      cur += (cur ? ' ' : '') + sentence
    }
  }
  if (cur) out.push(cur)
  return out
}

export function toChunks(
  pages: ReadonlyArray<{ url: string; title: string; text: string }>,
  maxTotal = MAX_KNOWLEDGE_CHARS,
): KnowledgeChunk[] {
  const out: KnowledgeChunk[] = []
  let total = 0
  for (const page of pages) {
    const paras = page.text.split(/\n{2,}|(?<=[.!?])\s{2,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length > 25)
    let buf = ''
    const flush = () => {
      const text = buf.trim()
      buf = ''
      if (!text || total >= maxTotal) return
      const t = text.slice(0, Math.min(MAX_CHUNK_CHARS, maxTotal - total))
      out.push({ title: page.title, url: page.url, text: t })
      total += t.length
    }
    for (const para of paras) {
      // A paragraph longer than a chunk is split on sentence ends, not cut off.
      for (const p of splitLong(para)) {
        if (buf && buf.length + p.length > MAX_CHUNK_CHARS) flush()
        buf += (buf ? ' ' : '') + p
      }
    }
    flush()
    if (total >= maxTotal) break
  }
  return out
}

export function topChunks(chunks: readonly KnowledgeChunk[], question: string, n = 4): KnowledgeChunk[] {
  const q = new Set(tokens(question))
  if (q.size === 0) return chunks.slice(0, n)
  const scored = chunks.map((c, i) => {
    const words = tokens(c.text)
    const titleWords = new Set(tokens(c.title + ' ' + c.url))
    let score = 0
    for (const w of words) if (q.has(w)) score += 1
    for (const w of q) if (titleWords.has(w)) score += 3
    return { c, i, score: score / Math.sqrt(words.length + 20) }
  })
  scored.sort((a, b) => b.score - a.score || a.i - b.i)
  const best = scored.filter((s) => s.score > 0).slice(0, n).map((s) => s.c)
  return best.length > 0 ? best : chunks.slice(0, Math.min(2, n))
}

/** Used when no AI key is set or the model fails: quote the best passage. */
export function extractiveAnswer(chunks: readonly KnowledgeChunk[], question: string): string {
  const best = topChunks(chunks, question, 1)[0]
  if (!best) return "I couldn't find that on the website. Please contact the team directly."
  const sentences = best.text.split(/(?<=[.!?])\s+/)
  return sentences.slice(0, 2).join(' ').trim().slice(0, 320)
}

/**
 * All the chunks, most relevant first. The prompt takes them in this order
 * until the budget is spent, so a small site is sent whole (nothing a keyword
 * scorer might miss is ever left out) and a big one drops its least relevant
 * text, not its most.
 */
export function orderChunks(chunks: readonly KnowledgeChunk[], question: string): KnowledgeChunk[] {
  const q = new Set(tokens(question))
  if (q.size === 0) return [...chunks]
  const scored = chunks.map((c, i) => {
    const words = tokens(c.text)
    const titleWords = new Set(tokens(c.title + ' ' + c.url))
    let score = 0
    for (const w of words) if (q.has(w)) score += 1
    for (const w of q) if (titleWords.has(w)) score += 3
    return { c, i, score: score / Math.sqrt(words.length + 20) }
  })
  scored.sort((a, b) => b.score - a.score || a.i - b.i)
  return scored.map((s) => s.c)
}

/** Take chunks in order until `budget` characters are used. */
export function withinBudget(chunks: readonly KnowledgeChunk[], budget = PROMPT_BUDGET_CHARS): KnowledgeChunk[] {
  const out: KnowledgeChunk[] = []
  let used = 0
  for (const c of chunks) {
    if (used + c.text.length > budget) continue
    out.push(c)
    used += c.text.length
  }
  return out
}
