/**
 * ============================================================================
 * File: src/lib/ai-agent/retriever.ts
 * Purpose: RAG product search — embed customer query → vector search → return products
 * ============================================================================
 *
 * This is the SEARCH ENGINE of the AI agent. When a customer asks about products,
 * this module:
 *   1. Converts their query text into a vector (using OpenAI text-embedding-3-small)
 *   2. Runs cosine similarity search against product embeddings in Supabase
 *   3. Returns the best matching products (sorted by relevance)
 *
 * Vector search flow:
 *   "green tea" → [0.12, -0.34, 0.56, ...] → cosine similarity → top 5 products
 *
 * Fallback for generic queries:
 *   "show me products" → doesn't match any specific product well →
 *   falls back to showing popular/recent in-stock products
 *
 * Used by:
 *   - engine.ts (SHOPPING_QUERY intent) → search products → send cards
 *   - engine.ts (CART_ADD intent) → find specific product to add
 *
 * DB dependency:
 *   - Supabase RPC function: match_ai_agent_products
 *   - Table: ai_agent_products (with embedding column)
 * ============================================================================
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Product returned from vector search (includes similarity score) */
export interface RetrievedProduct {
  id: string              // Supabase row ID (UUID)
  external_id: string     // Shopify variant ID
  name: string            // Product name (with variant if applicable)
  description: string | null
  price: number
  compare_at_price: number | null  // Original MRP (for discount % display)
  currency: string        // e.g. "INR"
  image_url: string | null     // First image URL (backward compat)
  image_urls: string[] | null  // ALL image URLs (for carousel)
  product_url: string | null   // Link to product on Shopify store
  in_stock: boolean
  similarity: number      // 0.0–1.0 (higher = better match)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'text-embedding-3-small'  // OpenAI's smallest/cheapest embedding model
const SIMILARITY_THRESHOLD = 0.35                  // Min similarity score to include a result
const MAX_PRODUCTS_TO_RETRIEVE = 5                 // Max products to return per query

// ─── Embed Query ─────────────────────────────────────────────────────────────

/**
 * Convert customer's text query into a vector embedding.
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions, ~$0.00002 per query).
 *
 * @param queryText - Customer's search query (e.g. "green tea for relaxation")
 * @returns Array of 1536 floats representing the query in vector space
 * @throws Error if OpenAI API fails
 */
async function embedQuery(queryText: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: queryText.trim(),
    }),
  })

  if (!response.ok) {
    throw new Error(`[Retriever] Embedding API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

// ─── Generic Browse Detection ────────────────────────────────────────────────

/**
 * Regex to detect generic browsing queries that won't match any specific product.
 *
 * Examples that match:
 *   "show me products"     ✓
 *   "what do you have?"    ✓
 *   "list your items"      ✓
 *   "what products are available?" ✓
 *
 * Examples that DON'T match (these are specific enough for vector search):
 *   "green tea"            ✗
 *   "do you have shampoo?" ✗
 *   "organic honey price"  ✗
 */
const BROWSE_PATTERNS = /^(show|what|list|browse|see|view|display|tell)\b.*(product|item|catalog|collection|have|sell|offer|available|stock)/i

// ─── Fallback: Popular Products ──────────────────────────────────────────────

/**
 * Fetch popular/recent products when vector search returns nothing.
 * Used for generic browse queries like "show me products".
 *
 * Strategy:
 *   1. Try in-stock products first (sorted by most recently updated)
 *   2. If no in-stock products, show any products
 *   3. Returns empty array only if store has zero products
 *
 * Note: similarity = 0 because these weren't matched via vector search.
 *
 * @param userId  - Merchant's user ID
 * @param supabase - Supabase client
 * @param limit   - Max products to return (default 5)
 */
async function fetchPopularProducts(
  userId: string,
  supabase: SupabaseClient,
  limit: number = MAX_PRODUCTS_TO_RETRIEVE
): Promise<RetrievedProduct[]> {
  // Try in-stock products first
  const { data, error } = await supabase
    .from('ai_agent_products')
    .select('id, external_id, name, description, price, compare_at_price, currency, image_url, image_urls, product_url, in_stock')
    .eq('user_id', userId)
    .eq('in_stock', true)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (!error && data?.length) {
    return data.map((p) => ({ ...p, similarity: 0 })) as RetrievedProduct[]
  }

  // No in-stock products? Show any products
  const { data: anyProducts } = await supabase
    .from('ai_agent_products')
    .select('id, external_id, name, description, price, compare_at_price, currency, image_url, image_urls, product_url, in_stock')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (!anyProducts?.length) return []
  return anyProducts.map((p) => ({ ...p, similarity: 0 })) as RetrievedProduct[]
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * retrieveProductsForQuery
 * Main search function — converts customer query to vector → finds matching products.
 *
 * Search strategy:
 *   1. Embed query text into a vector
 *   2. Run cosine similarity search in Supabase (via RPC function)
 *   3. Filter: prefer in-stock products
 *   4. Fallback: if no results AND query is generic browse → show popular products
 *
 * @param userId        - Merchant's user ID (products are scoped per merchant)
 * @param customerQuery - Customer's search text (e.g. "green tea" or "show me products")
 * @param supabase      - Supabase client
 * @returns Array of matching products (sorted by relevance, max 5)
 */
export async function retrieveProductsForQuery(
  userId: string,
  customerQuery: string,
  supabase: SupabaseClient
): Promise<RetrievedProduct[]> {
  // Step 1: Convert query text to vector
  const queryVector = await embedQuery(customerQuery)

  // Step 2: Vector similarity search via Supabase RPC
  // This calls the match_ai_agent_products PostgreSQL function
  const { data: products, error } = await supabase.rpc('match_ai_agent_products', {
    p_user_id: userId,
    p_query_embedding: queryVector,
    p_similarity_threshold: SIMILARITY_THRESHOLD,
    p_match_count: MAX_PRODUCTS_TO_RETRIEVE,
  })

  if (error) {
    throw new Error(`[Retriever] RPC error: ${error.message}`)
  }

  let results = (products as RetrievedProduct[]) ?? []

  // Step 3: Prefer in-stock products; fall back to all if none in stock
  const inStock = results.filter((p) => p.in_stock)
  results = inStock.length > 0 ? inStock : results

  // Step 4: Fallback for generic browse queries
  // "show me products" has no specific product keywords, so vector search
  // returns 0 results. In this case, show popular/recent products instead.
  if (results.length === 0 && BROWSE_PATTERNS.test(customerQuery)) {
    console.log(`[Retriever] Generic browse detected: "${customerQuery}" — fetching popular products`)
    return fetchPopularProducts(userId, supabase)
  }

  return results
}
