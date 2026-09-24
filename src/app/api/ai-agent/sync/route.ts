/**
 * File: src/app/api/ai-agent/sync/route.ts
 * Purpose: Trigger product catalog sync for AI Agent
 * Flow: auth → scrape store URL → upsert raw products → embed in small batches → mark done
 *
 * Strategy: Save all products first (no embeddings), then embed batch-by-batch.
 * Each batch is committed immediately so progress survives a timeout.
 * Works on Vercel Hobby (60s limit) for stores with ≤ ~300 products.
 * For larger stores, upgrade to Vercel Pro (maxDuration = 300).
 */

export const maxDuration = 60 // Hobby plan limit; change to 300 on Pro

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// ─── Supabase admin (bypasses RLS for batch upserts) ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function supabaseAdmin(): any {
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

// ─── Scraper ──────────────────────────────────────────────────────────────────

async function scrapeProducts(storeUrl: string): Promise<ScrapedProduct[]> {
  const base = storeUrl.replace(/\/$/, '')
  const all: ScrapedProduct[] = []

  // Shopify: paginate through products.json (250 per page max)
  // TEST MODE: limited to 5 pages (~1250 products max)
  const MAX_PAGES = 5
  let page = 1
  while (page <= MAX_PAGES) {
    try {
      const res = await fetch(`${base}/products.json?limit=250&page=${page}`, {
        headers: { 'User-Agent': 'AiSend-Agent/1.0' },
        signal: AbortSignal.timeout(15_000), // 15s per page fetch
      })
      if (!res.ok) break
      const data = await res.json() as { products: ShopifyProduct[] }
      if (!data.products || data.products.length === 0) break

      const scraped = data.products.flatMap((p) => shopifyProductToScraped(p, base))
      all.push(...scraped)

      if (data.products.length < 250) break // last page
      page++
    } catch {
      break
    }
  }

  return all
}

interface ShopifyVariant {
  id: number
  price: string
  inventory_quantity: number
  title: string
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

function shopifyProductToScraped(p: ShopifyProduct, base: string): ScrapedProduct[] {
  const hasMultipleVariants = p.variants.length > 1
  return p.variants.map((v) => ({
    external_id: String(v.id),
    name: hasMultipleVariants ? `${p.title} — ${v.title}` : p.title,
    description: p.body_html ? p.body_html.replace(/<[^>]+>/g, '').slice(0, 500) : null,
    price: parseFloat(v.price) || 0,
    currency: 'INR',
    image_url: p.images[0]?.src ?? null,
    product_url: `${base}/products/${p.handle}`,
    in_stock: v.inventory_quantity > 0,
  }))
}

// ─── Save raw products (no embeddings yet) ────────────────────────────────────

async function saveRawProducts(
  userId: string,
  products: ScrapedProduct[],
): Promise<void> {
  const admin = supabaseAdmin()
  const BATCH = 100

  for (let i = 0; i < products.length; i += BATCH) {
    const rows = products.slice(i, i + BATCH).map((p) => ({
      user_id: userId,
      external_id: p.external_id,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      image_url: p.image_url,
      product_url: p.product_url,
      in_stock: p.in_stock,
      // embedding intentionally null — filled in next step
      updated_at: new Date().toISOString(),
    }))

    const { error } = await admin
      .from('ai_agent_products')
      .upsert(rows, { onConflict: 'user_id,external_id' })

    if (error) throw new Error(`[Sync] Save raw failed: ${error.message}`)
  }
}

// ─── Embed products in small batches ─────────────────────────────────────────

const EMBED_BATCH = 20 // small batches: faster per-batch, survives partial timeout

async function embedProducts(
  userId: string,
  products: ScrapedProduct[],
): Promise<{ embedded: number; failed: number }> {
  const admin = supabaseAdmin()
  let embedded = 0
  let failed = 0

  for (let i = 0; i < products.length; i += EMBED_BATCH) {
    const batch = products.slice(i, i + EMBED_BATCH)

    const inputs = batch.map((p) =>
      [p.name, p.description].filter(Boolean).join(' — ').slice(0, 500)
    )

    try {
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: inputs }),
        signal: AbortSignal.timeout(20_000), // 20s per batch
      })

      if (!embRes.ok) {
        const errText = await embRes.text()
        console.error(`[Sync] OpenAI embed error ${embRes.status}: ${errText}`)
        failed += batch.length
        continue
      }

      const embJson = await embRes.json() as { data: Array<{ embedding: number[] }> }

      // Update each product's embedding individually (avoids full row re-upsert)
      const updates = batch.map((p, idx) =>
        admin
          .from('ai_agent_products')
          .update({
            embedding: JSON.stringify(embJson.data[idx]!.embedding),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('external_id', p.external_id)
      )
      await Promise.all(updates)
      embedded += batch.length
    } catch (err) {
      console.error(`[Sync] Embed batch ${i}–${i + EMBED_BATCH} failed:`, err)
      failed += batch.length
    }
  }

  return { embedded, failed }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  const body = await req.json() as { storeUrl?: string }
  const storeUrl = body.storeUrl?.trim()
  if (!storeUrl) {
    return NextResponse.json({ error: 'storeUrl is required' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // 3. Mark scrape as running
  await admin
    .from('ai_agent_configs')
    .update({ scrape_status: 'running', embed_status: 'pending', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  // 4. Scrape
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

  // ── TESTING CAP: limit to 10 products — remove once sync is confirmed working ──
  if (products.length > 10) products = products.slice(0, 10)
  // ─────────────────────────────────────────────────────────────────────────────

  if (products.length === 0) {
    await admin
      .from('ai_agent_configs')
      .update({ scrape_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json(
      { error: 'No products found. Make sure the URL is a Shopify store (e.g. https://yourstore.myshopify.com).' },
      { status: 422 }
    )
  }

  // 5. Save raw products (fast — no embeddings yet)
  try {
    await saveRawProducts(user.id, products)
  } catch (err) {
    console.error('[Sync] Save raw error:', err)
    await admin
      .from('ai_agent_configs')
      .update({ scrape_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json({ error: 'Failed to save products' }, { status: 500 })
  }

  // 6. Mark scrape done, embedding starting
  await admin
    .from('ai_agent_configs')
    .update({
      scrape_status: 'done',
      embed_status: 'running',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  // 7. Embed (synchronous — must finish before Vercel kills the function)
  let embedded = 0
  let failed = 0
  try {
    const result = await embedProducts(user.id, products)
    embedded = result.embedded
    failed = result.failed
  } catch (err) {
    console.error('[Sync] Embed error:', err)
    await admin
      .from('ai_agent_configs')
      .update({ embed_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json({ error: 'Embedding failed' }, { status: 500 })
  }

  // 8. Mark done (even if some batches failed — partial catalog still usable)
  const finalStatus = failed === 0 ? 'done' : embedded > 0 ? 'done' : 'failed'
  await admin
    .from('ai_agent_configs')
    .update({
      embed_status: finalStatus,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  return NextResponse.json({
    ok: true,
    productsFound: products.length,
    embedded,
    failed,
  })
}
