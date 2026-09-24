/**
 * File: src/lib/ai-agent/retriever.ts
 * Purpose: RAG (Retrieval-Augmented Generation) product search for AI Ecommerce Agent
 *
 * Flow:
 *   1. Embed customer query using OpenAI text-embedding-3-small
 *   2. Call match_ai_agent_products() PostgreSQL function via Supabase RPC
 *   3. Return typed RetrievedProduct[] array to engine.ts for LLM reply generation
 *
 * Kept separate from engine.ts so retrieval logic can be tuned/swapped independently.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Shape of each product row returned by match_ai_agent_products() RPC.
 * Mirrors the columns defined in 011_ai_agent.sql → ai_agent_products.
 */
export interface RetrievedProduct {
  id: string
  external_id: string        // Product ID from the merchant's store (Shopify/WooCommerce)
  name: string
  description: string | null
  price: number
  currency: string           // e.g. "INR", "USD"
  image_url: string | null
  product_url: string | null
  in_stock: boolean
  similarity: number         // Cosine similarity score from pgvector (0.0 – 1.0)
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** OpenAI embedding model — must match what was used during product ingestion */
const EMBEDDING_MODEL = 'text-embedding-3-small'

/** Minimum cosine similarity score to include a product in results */
const SIMILARITY_THRESHOLD = 0.35

/** Max products to retrieve per customer query (balances LLM context size vs relevance) */
const MAX_PRODUCTS_TO_RETRIEVE = 5

// ─── Embedding ────────────────────────────────────────────────────────────────

/**
 * embedCustomerQuery
 * Converts the customer's text query into a 1536-dim vector using OpenAI Embeddings API.
 * The same model and dimensions must have been used when embedding the product catalog.
 *
 * @param queryText - Raw customer message or extracted product keywords
 * @returns Float array of length 1536
 */
async function embedCustomerQuery(queryText: string): Promise<number[]> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('[AI Agent Retriever] OPENAI_API_KEY environment variable is not set')
  }

  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: queryText.trim(),
    }),
  })

  if (!embeddingResponse.ok) {
    const errorBody = await embeddingResponse.text()
    throw new Error(
      `[AI Agent Retriever] OpenAI Embeddings API error ${embeddingResponse.status}: ${errorBody}`
    )
  }

  const embeddingData = await embeddingResponse.json()
  const queryEmbeddingVector: number[] = embeddingData.data[0].embedding

  return queryEmbeddingVector
}

// ─── Vector Search ────────────────────────────────────────────────────────────

/**
 * searchProductsBySemanticSimilarity
 * Calls the match_ai_agent_products() PostgreSQL function (defined in 011_ai_agent.sql)
 * which performs an HNSW approximate nearest-neighbour search using pgvector.
 *
 * @param userId         - Merchant's user ID (scopes search to their catalog)
 * @param queryVector    - 1536-dim embedding vector of the customer query
 * @param supabase       - Supabase client with service role permissions
 * @returns Array of matching products sorted by similarity descending
 */
async function searchProductsBySemanticSimilarity(
  userId: string,
  queryVector: number[],
  supabase: SupabaseClient
): Promise<RetrievedProduct[]> {
  const { data: matchedProducts, error: rpcError } = await supabase.rpc(
    'match_ai_agent_products',
    {
      p_user_id: userId,
      p_query_embedding: queryVector,
      p_similarity_threshold: SIMILARITY_THRESHOLD,
      p_match_count: MAX_PRODUCTS_TO_RETRIEVE,
    }
  )

  if (rpcError) {
    throw new Error(
      `[AI Agent Retriever] match_ai_agent_products RPC failed: ${rpcError.message}`
    )
  }

  return (matchedProducts as RetrievedProduct[]) ?? []
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * retrieveProductsForQuery
 * Main entry point for the RAG retrieval step.
 * Called by engine.ts when intent is SHOPPING_QUERY or CART_ADD.
 *
 * @param userId          - Merchant's user ID
 * @param customerQuery   - Customer's message text (or extracted keywords from intent.ts)
 * @param supabase        - Supabase client
 * @returns Top-K relevant products from the merchant's catalog, or [] if none found
 */
export async function retrieveProductsForQuery(
  userId: string,
  customerQuery: string,
  supabase: SupabaseClient
): Promise<RetrievedProduct[]> {
  console.log(
    `[AI Agent Retriever] Embedding query for userId=${userId}: "${customerQuery.substring(0, 80)}..."`
  )

  // Step 1: Convert customer query text → embedding vector
  const queryEmbeddingVector = await embedCustomerQuery(customerQuery)

  // Step 2: Semantic search against merchant's product catalog
  const matchedProducts = await searchProductsBySemanticSimilarity(
    userId,
    queryEmbeddingVector,
    supabase
  )

  console.log(
    `[AI Agent Retriever] Found ${matchedProducts.length} products above threshold ${SIMILARITY_THRESHOLD}`
  )

  // Step 3: Filter out out-of-stock products (in-stock first, then fallback to all if none)
  const inStockProducts = matchedProducts.filter((product) => product.in_stock)

  if (inStockProducts.length > 0) {
    return inStockProducts
  }

  // If nothing is in stock, return all matches anyway so the agent can inform the customer
  return matchedProducts
}
