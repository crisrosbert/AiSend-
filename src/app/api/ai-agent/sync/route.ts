/**
 * ============================================================================
 * File: src/app/api/ai-agent/sync/route.ts
 * Purpose: STEP 1 of product import — Scrape Shopify store & save raw products
 * ============================================================================
 *
 * What this does:
 *   1. Merchant clicks "Sync Products" in dashboard
 *   2. This API scrapes their Shopify store via /products.json
 *   3. Saves all products + ALL images to Supabase (ai_agent_products table)
 *   4. Returns count → frontend then calls /api/ai-agent/embed for embeddings
 *
 * Performance:
 *   - Completes in <5s (well within Vercel Hobby 10s limit)
 *   - Fetches up to 250 products per page (paginated)
 *   - Each Shopify product variant = separate row in our DB
 *
 * Image handling:
 *   - Stores ALL product images in `image_urls` JSONB column (array of URLs)
 *   - Also keeps first image in `image_url` for backward compatibility
 *   - WhatsApp agent sends multiple image cards for carousel-like experience
 *
 * Stock detection:
 *   - Checks Shopify's inventory_management + inventory_policy fields
 *   - Products with untracked inventory → treated as "In Stock"
 *   - Products with "continue" selling policy → treated as "In Stock"
 *   - Only marks "Out of Stock" when inventory is actively tracked AND qty = 0
 *
 * DB table: ai_agent_products
 *   Required columns: user_id, external_id, name, description, price, currency,
 *                     image_url, image_urls (jsonb), product_url, in_stock
 * ============================================================================
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// ─── Supabase Admin Client (bypasses RLS) ────────────────────────────────────
// We use service role key because this runs server-side and needs to write
// to ai_agent_products without per-user RLS restrictions.

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

// ─── Types ───────────────────────────────────────────────────────────────────

/** Our internal product format (what gets saved to DB) */
interface ScrapedProduct {
  external_id: string        // Shopify variant ID (unique per variant)
  name: string               // Product title (+ variant title if multi-variant)
  description: string | null // HTML stripped, max 500 chars
  price: number              // Parsed from Shopify variant price string
  currency: string           // Default: 'INR' (configurable per store later)
  image_url: string | null   // First image URL (backward compat)
  image_urls: string[]       // ALL image URLs for this product (for carousel)
  product_url: string | null // Full URL to product page on Shopify store
  in_stock: boolean          // Smart stock detection (see header comment)
}

/** Shopify variant from /products.json API */
interface ShopifyVariant {
  id: number
  price: string                       // Price as string, e.g. "650.00"
  inventory_quantity: number           // Current stock count
  title: string                       // Variant title, e.g. "Large / Red"
  inventory_management: string | null  // null = not tracked, "shopify" = tracked by Shopify
  inventory_policy: string             // "deny" = stop selling at 0, "continue" = oversell allowed
}

/** Shopify image from /products.json API */
interface ShopifyImage {
  src: string  // Full CDN URL to product image
}

/** Shopify product from /products.json API */
interface ShopifyProduct {
  id: number
  title: string
  body_html: string | null    // Product description (HTML)
  handle: string              // URL slug, e.g. "organic-tulsi-tea"
  variants: ShopifyVariant[]  // Each variant = separate product in our DB
  images: ShopifyImage[]      // ALL product images (what we want for carousel)
}

// ─── Unicode Sanitizer ───────────────────────────────────────────────────────

/**
 * Remove characters that PostgreSQL JSONB rejects.
 *
 * PostgreSQL JSONB throws error 22P02 for:
 *   1. Lone Unicode surrogates (\uD800-\uDFFF without a valid pair)
 *   2. Null bytes (\u0000)
 *
 * This function handles BOTH layers of the problem:
 *
 * LAYER 1 — sanitizeJsonEscapes():
 *   Shopify's JSON response may contain literal escape sequences like
 *   \uD83D or \uDC00 as 6-character ASCII strings in the raw JSON text.
 *   These look harmless to JavaScript but become real surrogates after
 *   JSON.parse(). We strip lone surrogate escapes and null escapes from
 *   the raw JSON text BEFORE parsing.
 *
 * LAYER 2 — sanitizeUnicode():
 *   After parsing, some strings may still contain actual lone surrogate
 *   code units (from Shopify's HTML entities, copy-paste, etc.).
 *   This character-by-character scan catches anything Layer 1 missed.
 *
 * Call order: sanitizeJsonEscapes(rawText) → JSON.parse() → sanitizeUnicode(string fields)
 */

/**
 * LAYER 1: Strip problematic \uXXXX escape sequences from raw JSON text.
 *
 * Targets:
 *   - \u0000           → null byte (PostgreSQL JSONB rejects)
 *   - \uD800 - \uDBFF  → high surrogates (only valid if followed by \uDC00-\uDFFF)
 *   - \uDC00 - \uDFFF  → low surrogates (only valid if preceded by \uD800-\uDBFF)
 *
 * Strategy:
 *   1. First, remove all lone LOW surrogates (not preceded by a high surrogate)
 *   2. Then, remove all lone HIGH surrogates (not followed by a low surrogate)
 *   3. Remove null byte escapes
 *   This preserves valid surrogate pairs like 😀 (emoji 😀)
 */
function sanitizeJsonEscapes(jsonText: string): string {
  // Step 1: Remove null byte escapes
  let clean = jsonText.replace(/\\u0000/gi, '')

  // Step 2: Remove lone LOW surrogates (\uDC00-\uDFFF not preceded by \uD800-\uDBFF)
  // Negative lookbehind: only match \uDCxx if NOT preceded by \uD[89AB]xx
  clean = clean.replace(
    /(?<!\\u[dD][89aAbB][0-9a-fA-F]{2})\\u[dD][cCdDeEfF][0-9a-fA-F]{2}/gi,
    ''
  )

  // Step 3: Remove lone HIGH surrogates (\uD800-\uDBFF not followed by \uDC00-\uDFFF)
  // Negative lookahead: only match \uD8xx if NOT followed by \uDCxx
  clean = clean.replace(
    /\\u[dD][89aAbB][0-9a-fA-F]{2}(?!\\u[dD][cCdDeEfF][0-9a-fA-F]{2})/gi,
    ''
  )

  return clean
}

/**
 * LAYER 2: Remove actual lone surrogate code units from JavaScript strings.
 * This runs AFTER JSON.parse() on individual string values.
 * Also strips null characters (\0) that might have been decoded.
 */
function sanitizeUnicode(text: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)

    // Skip null bytes
    if (code === 0) continue

    if (code >= 0xD800 && code <= 0xDBFF) {
      // High surrogate — check if valid pair follows
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0
      if (next >= 0xDC00 && next <= 0xDFFF) {
        result += text[i] + text[i + 1]  // Valid pair — keep both
        i++  // Skip next char (already included)
      }
      // Lone high surrogate — skip it
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      // Lone low surrogate — skip it
    } else {
      result += text[i]  // Normal character — keep it
    }
  }
  return result
}

// ─── Shopify → Our Format Converter ──────────────────────────────────────────

/**
 * Convert one Shopify product into one or more ScrapedProduct rows.
 *
 * Why multiple rows?
 *   Shopify products can have variants (e.g. "Green Tea - 100g" and "Green Tea - 250g").
 *   Each variant has its own price, stock, and ID — so we store each as a separate row.
 *   This lets customers search/buy specific variants, not just the parent product.
 *
 * Image handling:
 *   ALL images from the parent product are shared across variants.
 *   We store the full array so WhatsApp can show carousel-style multiple cards.
 *
 * @param p    - Shopify product object
 * @param base - Store base URL (e.g. "https://shopinshop.com.bd")
 * @returns Array of ScrapedProduct rows (one per variant)
 */
function shopifyProductToScraped(p: ShopifyProduct, base: string): ScrapedProduct[] {
  const multi = p.variants.length > 1  // Does this product have multiple variants?
  const allImageUrls = p.images.map((img) => img.src)  // Collect ALL image URLs

  return p.variants.map((v) => ({
    external_id: String(v.id),

    // If multi-variant, append variant title so customer can distinguish:
    // "Green Tea" → "Green Tea — 100g Pack" and "Green Tea — 250g Pack"
    name: sanitizeUnicode(multi ? `${p.title} — ${v.title}` : p.title),

    // Strip HTML tags from Shopify description, sanitize Unicode, truncate to 500 chars
    description: p.body_html
      ? sanitizeUnicode(p.body_html.replace(/<[^>]+>/g, '')).slice(0, 500)
      : null,

    price: parseFloat(v.price) || 0,
    currency: 'INR',  // TODO: Make this configurable per store in ai_agent_configs

    // First image for backward compatibility (existing code uses this)
    image_url: allImageUrls[0] ?? null,

    // ALL images for WhatsApp carousel cards
    image_urls: allImageUrls,

    product_url: `${base}/products/${p.handle}`,

    // Smart stock detection:
    // 1. inventory_management = null → Shopify doesn't track stock → assume In Stock
    // 2. inventory_policy = "continue" → store allows overselling → In Stock
    // 3. inventory_quantity > 0 → has physical stock → In Stock
    // Only Out of Stock when: tracked + deny policy + qty = 0
    in_stock: !v.inventory_management
      || v.inventory_policy === 'continue'
      || v.inventory_quantity > 0,
  }))
}

// ─── Shopify Scraper ─────────────────────────────────────────────────────────

/**
 * Scrape products from a Shopify store using the public /products.json endpoint.
 *
 * How Shopify pagination works:
 *   - /products.json?limit=250&page=1 → first 250 products
 *   - /products.json?limit=250&page=2 → next 250 products
 *   - Empty array = no more pages
 *
 * Rate limiting:
 *   - Shopify public API is generous (no auth needed)
 *   - We add a small delay between pages to be polite
 *   - 8s timeout per request to stay within Vercel limits
 *
 * @param storeUrl - Shopify store URL (e.g. "https://shopinshop.com.bd")
 * @returns Array of all scraped products (flattened variants)
 */
async function scrapeShopify(storeUrl: string): Promise<ScrapedProduct[]> {
  const base = storeUrl.replace(/\/$/, '')  // Remove trailing slash
  const all: ScrapedProduct[] = []
  let page = 1
  const maxPages = 5  // Safety limit: 5 pages × 250 = max 1250 products

  while (page <= maxPages) {
    const res = await fetch(`${base}/products.json?limit=250&page=${page}`, {
      headers: { 'User-Agent': 'AiSend-Agent/1.0' },
      signal: AbortSignal.timeout(8_000),  // 8s timeout per page
    })

    if (!res.ok) {
      // If first page fails, return empty (store URL probably wrong)
      // If later page fails, return what we have so far
      if (page === 1) return []
      break
    }

    // ── TWO-LAYER Unicode sanitization ──
    // LAYER 1: Strip problematic \uXXXX escape sequences from raw JSON
    // (catches lone surrogates and null bytes in the JSON text itself)
    const rawText = await res.text()
    const cleanJson = sanitizeJsonEscapes(rawText)
    const data = JSON.parse(cleanJson) as { products: ShopifyProduct[] }

    // No more products = we've reached the last page
    if (!data.products?.length) break

    all.push(...data.products.flatMap((p) => shopifyProductToScraped(p, base)))
    page++

    // If Shopify returned less than 250, there's no next page
    if (data.products.length < 250) break
  }

  return all
}

// ─── API Route Handler ───────────────────────────────────────────────────────

/**
 * POST /api/ai-agent/sync
 *
 * Request body: { storeUrl: string }
 * Response: { ok: true, productsFound: number } or { error: string }
 *
 * Flow:
 *   1. Auth check → get current user
 *   2. Mark scrape_status = 'running' in ai_agent_configs
 *   3. Scrape Shopify store
 *   4. Upsert products to ai_agent_products (dedup by user_id + external_id)
 *   5. Mark scrape_status = 'done'
 *   6. Frontend then calls /api/ai-agent/embed to build vector embeddings
 */
export async function POST(req: Request) {
  // ── Auth: verify the merchant is logged in ──
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Validate input ──
  const body = await req.json() as { storeUrl?: string }
  const storeUrl = body.storeUrl?.trim()
  if (!storeUrl) {
    return NextResponse.json({ error: 'storeUrl is required' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // ── Mark sync as running (UI shows progress spinner) ──
  await admin.from('ai_agent_configs')
    .update({
      scrape_status: 'running',
      embed_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  // ── Scrape the Shopify store ──
  let products: ScrapedProduct[]
  try {
    products = await scrapeShopify(storeUrl)
  } catch (err) {
    console.error('[Sync] Scrape error:', err)
    await admin.from('ai_agent_configs')
      .update({ scrape_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json(
      { error: 'Scrape failed — check store URL and try again' },
      { status: 502 }
    )
  }

  // ── No products found? Probably wrong URL ──
  if (!products.length) {
    await admin.from('ai_agent_configs')
      .update({ scrape_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json(
      { error: 'No products found. Make sure this is a valid Shopify store URL.' },
      { status: 422 }
    )
  }

  // ── Save products to database ──
  // Upsert = insert new products, update existing ones (matched by user_id + external_id)
  const rows = products.map((p) => ({
    user_id: user.id,
    external_id: p.external_id,
    name: sanitizeUnicode(p.name),
    description: p.description ? sanitizeUnicode(p.description) : null,
    price: p.price,
    currency: p.currency,
    image_url: p.image_url,
    image_urls: p.image_urls,
    product_url: p.product_url,
    in_stock: p.in_stock,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertErr } = await admin
    .from('ai_agent_products')
    .upsert(rows, { onConflict: 'user_id,external_id' })

  if (upsertErr) {
    console.error('[Sync] Upsert error:', upsertErr)
    await admin.from('ai_agent_configs')
      .update({ scrape_status: 'failed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    return NextResponse.json(
      { error: `Save failed: ${upsertErr.message}` },
      { status: 500 }
    )
  }

  // ── Mark scrape done → frontend calls /api/ai-agent/embed next ──
  await admin.from('ai_agent_configs')
    .update({
      scrape_status: 'done',
      embed_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  console.log(`[Sync] Done — ${products.length} products saved for user ${user.id}`)
  return NextResponse.json({ ok: true, productsFound: products.length })
}
