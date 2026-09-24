/**
 * File: src/app/api/ai-agent/sync/route.ts
 * Purpose: Trigger product catalog sync for AI Agent
 * Flow: auth → scrape store URL → upsert products → embed → mark done
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// ─── Supabase admin (bypasses RLS for batch upserts) ─────────────────────────

let _admin: ReturnType<typeof createAdminClient> | null = null
function supabaseAdmin() {
  if (!_admin) {
    _admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScrapedProduct {
  external_id: string
  name: string
  description: string | null
  price: number
  currency: string
  image_url: string | null
  product_url: string | null
  in_stock: boolean
}

// ─── Scraper: fetch products from store URL ───────────────────────────────────
// Supports Shopify JSON API. Falls back to empty array on unknown stores.

async function scrapeProducts(storeUrl: string): Promise<ScrapedProduct[]> {
  const url = storeUrl.replace(/\/$/, '')

  // Try Shopify products.json (works on all Shopify stores without auth)
  try {
    const res = await fetch(`${url}/products.json?limit=250`, {
      headers: { 'User-Agent': 'AiSend-Agent/1.0' },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      const data = await res.json() as { products: ShopifyProduct[] }
      return data.products.flatMap(shopifyProductToScraped)
    }
  } catch {
    // Not a Shopify store or network error — fall through
  }

  return []
}

interface ShopifyVariant {
  id: number
  price: string
  inventory_quantity: number
}

interface ShopifyImage {
  src: string
}

interface ShopifyProduct {
  id: number
  title: string
  body_html: string | null
  handle: string
  variants: ShopifyVariant[]
  images: ShopifyImage[]
}

function shopifyProductToScraped(p: ShopifyProduct): ScrapedProduct[] {
  // One row per variant; fall back to first variant price for single-variant products
  return p.variants.map((v) => ({
    external_id: String(v.id),
    name: p.variants.length > 1 ? `${p.title} — ${v.price}` : p.title,
    description: p.body_html ? p.body_html.replace(/<[^>]+>/g, '').slice(0, 500) : null,
    price: parseFloat(v.price),
    currency: 'INR',                       // Shopify doesn't expose currency in products.json
    image_url: p.images[0]?.src ?? null,
    product_url: null,                     // set below after we know store URL
    in_stock: v.inventory_quantity > 0,
  }))
}

// ─── Embedder: batch embed product text with OpenAI ──────────────────────────

const EMBED_BATCH = 100   // OpenAI allows up to 2048 inputs; keep batches safe

async function embedProducts(
  userId: string,
  products: ScrapedProduct[],
  storeUrl: string
): Promise<void> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const admin = supabaseAdmin()
  const base = storeUrl.replace(/\/$/, '')

  for (let i = 0; i < products.length; i += EMBED_BATCH) {
    const batch = products.slice(i, i + EMBED_BATCH)

    // Build embedding input: name + description for semantic richness
    const inputs = batch.map((p) =>
      [p.name, p.description].filter(Boolean).join(' — ').slice(0, 500)
    )

    const { data: embeddings } = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: inputs,
    })

    const rows = batch.map((p, idx) => ({
      user_id: userId,
      external_id: p.external_id,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      image_url: p.image_url,
      product_url: p.product_url ?? `${base}/products/${p.external_id}`,
      in_stock: p.in_stock,
      embedding: JSON.stringify(embeddings[idx].embedding),
      updated_at: new Date().toISOString(),
    }))

    const { error } = await admin
      .from('ai_agent_products')
      .upsert(rows, { onConflict: 'user_id,external_id' })

    if (error) throw new Error(`[Sync] Upsert failed: ${error.message}`)
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse request
  const body = await req.json() as { storeUrl?: string }
  const storeUrl = body.storeUrl?.trim()
  if (!storeUrl) {
    return NextResponse.json({ error: 'storeUrl is required' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // 3. Mark scrape as running
  await admin
    .from('ai_agent_configs')
    .update({ scrape_status: 'running', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  // 4. Scrape products
  let products: ScrapedProduct[]
  try {
    products = await scrapeProducts(storeUrl)
  } catch (err) {
    console.error('[Sync] Scrape error:', err)
    await admin
      .from('ai_agent_configs')
      .update({ scrape_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json({ error: 'Scrape failed' }, { status: 502 })
  }

  if (products.length === 0) {
    await admin
      .from('ai_agent_configs')
      .update({ scrape_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json({ error: 'No products found at that URL' }, { status: 422 })
  }

  // 5. Mark scrape done, embedding running
  await admin
    .from('ai_agent_configs')
    .update({
      scrape_status: 'done',
      embed_status: 'running',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  // 6. Embed + upsert (runs async — client polls for status)
  embedProducts(user.id, products, storeUrl)
    .then(async () => {
      await admin
        .from('ai_agent_configs')
        .update({
          embed_status: 'done',
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    })
    .catch(async (err) => {
      console.error('[Sync] Embed error:', err)
      await admin
        .from('ai_agent_configs')
        .update({ embed_status: 'failed', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    })

  // 7. Return immediately — client polls scrape_status / embed_status
  return NextResponse.json({ ok: true, productsFound: products.length })
}
