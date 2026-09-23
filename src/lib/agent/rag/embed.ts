// src/lib/agent/rag/embed.ts
//
// Turns chunk text into vectors for pgvector similarity search.
//
// Deliberately independent of LLM_PROVIDER (which picks the chat model
// in llm-provider.ts): the embedding column is a fixed 1536 dimensions
// (OpenAI text-embedding-3-small). Letting embeddings follow the chat
// provider would mean a journey ingested under one provider and queried
// under another sits in an incompatible vector space — or worse, two
// providers with the same dimension count but a different meaning per
// dimension, which fails silently instead of erroring.
//
// Requires OPENAI_API_KEY even when LLM_PROVIDER=gemini. Callers treat a
// missing key or a failed call as "no vector search available", not as
// an error — retrieve() falls back to keyword search, and ingest()
// stores the chunk without an embedding rather than losing it.

const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

/** Is embedding actually possible right now? */
export function hasEmbeddingKey(): boolean {
  return !!process.env.OPENAI_API_KEY
}

/** Embed a single string, e.g. a search query. */
export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text])
  return vector
}

/**
 * Embed many chunks in one API call.
 *
 * OpenAI's embeddings endpoint accepts an array of inputs, so ingesting
 * a 40-chunk site costs one request instead of 40 — both faster and a
 * fortieth of the rate-limit pressure.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI embeddings ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const items = (data?.data ?? []) as Array<{ index: number; embedding: number[] }>

  // The API documents same-order-as-input, but sorting by the `index`
  // it also returns costs nothing and removes the failure mode where a
  // provider-side reorder silently attaches chunk 3's text to chunk 7's
  // vector.
  return [...items]
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding)
}
