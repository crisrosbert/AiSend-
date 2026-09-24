/**
 * File: src/app/api/ai-agent/sync/route.ts
 * Purpose: STEP 1 — Scrape products and save raw (no embeddings)
 * Fast: completes in <5s, well within Vercel Hobby 10s limit.
 * After this returns, the frontend calls /api/ai-agent/embed to build embeddings.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

interface ShopifyVariant { id: number; price: string; inventory_quantity: number; title: string }
interface ShopifyImage  { src: string }
interface ShopifyProduct {
  id: number; title: string; body_html: string | null
  handle: string; variants: ShopifyVariant[]; images: ShopifyImage[]
}

function shopifyProductToScraped(p: ShopifyProduct, base: string): ScrapedProduct[] {
  const multi = p.variants.length > 1
  return p.variants.map((v) => ({
    external_id: String(v.id),
    name: multi ? `${p.title} — ${v.title}` : p.title,
    description: p.body_html ? p.body_html.replace(/<[^>]+>/g, '').slice(0, 500) : null,
    price: parseFloat(v.price) || 0,
    currency: 'INR',
    image_url: p.images[0]?.src ?? null,
    product_url: `${base}/products/${p.handle}`,
    in_stock: v.inventory_quantity > 0,
  }))
}

async function scrapeShopify(storeUrl: string): Promise<ScrapedProduct[]> {
  const base = storeUrl.replace(/\/$/, '')
  const all: ScrapedProduct[] = []

  // TEST CAP: 10 products — remove `&limit=10` once confirmed working
  const res = await fetch(`${base}/products.json?limit=10`, {
    headers: { 'User-Agent': 'AiSend-Agent/1.0' },
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) return []
  const data = await res.json() as { products: ShopifyProduct[] }
  if (!data.products?.length) return []
  all.push(...data.products.flatMap((p) => shopifyProductToScraped(p, base)))
  return all
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { storeUrl?: string }
  const storeUrl = body.storeUrl?.trim()
  if (!storeUrl) return NextResponse.json({ error: 'storeUrl is required' }, { status: 400 })

  const admin = supabaseAdmin()

  // Mark running
  await admin.from('ai_agent_configs')
    .update({ scrape_status: 'running', embed_status: 'pending', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  // Scrape
  let products: ScrapedProduct[]
  try {
    products = await scrapeShopify(storeUrl)
  } catch (err) {
    console.error('[Sync] Scrape error:', err)
    await admin.from('ai_agent_configs')
      .update({ scrape_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json({ error: 'Scrape failed — check store URL' }, { status: 502 })
  }

  if (!products.length) {
    await admin.from('ai_agent_configs')
      .update({ scrape_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json(
      { error: 'No products found. Make sure this is a Shopify store URL.' },
      { status: 422 }
    )
  }

  // Save raw products (no embeddings yet)
  const rows = products.map((p) => ({
    user_id: user.id,
    external_id: p.external_id,
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    image_url: p.image_url,
    product_url: p.product_url,
    in_stock: p.in_stock,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertErr } = await admin
    .from('ai_agent_products')
    .upsert(rows, { onConflict: 'user_id,external_id' })

  if (upsertErr) {
    await admin.from('ai_agent_configs')
      .update({ scrape_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json({ error: `Save failed: ${upsertErr.message}` }, { status: 500 })
  }

  // Mark scrape done — frontend will now call /api/ai-agent/embed
  await admin.from('ai_agent_configs')
    .update({ scrape_status: 'done', embed_status: 'pending', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true, productsFound: products.length })
}
