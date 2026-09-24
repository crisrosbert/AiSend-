/**
 * File: src/lib/ai-agent/retriever.ts
 * Purpose: RAG product search — embed customer query → vector search in ai_agent_products
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetrievedProduct {
  id: string
  external_id: string
  name: string
  description: string | null
  price: number
  currency: string
  image_url: string | null
  product_url: string | null
  in_stock: boolean
  similarity: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'text-embedding-3-small'
const SIMILARITY_THRESHOLD = 0.35
const MAX_PRODUCTS_TO_RETRIEVE = 5

// ─── Embed Query ──────────────────────────────────────────────────────────────

async function embedQuery(queryText: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: queryText.trim() }),
  })

  if (!response.ok) throw new Error(`[Retriever] Embedding API error: ${response.status}`)

  const data = await response.json()
  return data.data[0].embedding
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * retrieveProductsForQuery
 * Converts customer query to vector → cosine similarity search → returns top-K products
 */
export async function retrieveProductsForQuery(
  userId: string,
  customerQuery: string,
  supabase: SupabaseClient
): Promise<RetrievedProduct[]> {
  const queryVector = await embedQuery(customerQuery)

  const { data: products, error } = await supabase.rpc('match_ai_agent_products', {
    p_user_id: userId,
    p_query_embedding: queryVector,
    p_similarity_threshold: SIMILARITY_THRESHOLD,
    p_match_count: MAX_PRODUCTS_TO_RETRIEVE,
  })

  if (error) throw new Error(`[Retriever] RPC error: ${error.message}`)

  const results = (products as RetrievedProduct[]) ?? []

  // Prefer in-stock products; fall back to all if none in stock
  const inStock = results.filter((p) => p.in_stock)
  return inStock.length > 0 ? inStock : results
}
