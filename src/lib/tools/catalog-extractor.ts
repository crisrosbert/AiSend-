// src/lib/tools/catalog-extractor.ts
//
// Turns a store URL into a product list — name, price, image — for the
// free "WhatsApp Catalog Builder" tool. The same job a merchant would
// otherwise do by hand: opening every product page and copying its
// name, price and photo into a spreadsheet before it can go into a
// WhatsApp catalogue message.
//
// Three sources, tried in order, because no single one covers every
// site a visitor might paste:
//   1. Shopify's own /products.json — when it works, it's the richest
//      source (every price, no guessing) and costs one request.
//   2. schema.org Product markup (JSON-LD) — the same structured data
//      Google reads to show a price in search results. Works on
//      WooCommerce, Magento, and most hand-built stores that care
//      about SEO.
//   3. Open Graph product tags — a thinner fallback for sites with
//      neither of the above.
//
// URL safety (validatePublicUrl, isPublicHost) and link discovery
// (extractLinks, normaliseUrl) are reused from site-crawler.ts rather
// than re-implemented: this crawler needs the exact same "never fetch a
// private address" guarantee, and this route has no login wall in
// front of it — anyone can paste anything.

import {
  validatePublicUrl,
  isPublicHost,
  extractLinks,
  normaliseUrl,
} from '@/lib/agent/rag/site-crawler'

export interface ExtractedProduct {
  name: string
  price: string | null
  currency: string | null
  image: string | null
  url: string
  sku: string | null
}

export interface CatalogResult {
  products: ExtractedProduct[]
  source: 'shopify' | 'jsonld' | 'og' | null
  pagesScanned: number
  truncated: boolean
  error: string | null
}

const MAX_PRODUCTS = 24
const MAX_PAGES = 8
const TOTAL_BUDGET_MS = 18_000
const PER_REQUEST_MS = 6_000

/** Paths worth crawling. Anything else (blog, about, cart) never holds a product. */
const PRODUCT_PATH = /\/(products?|shop|collections?|item|catalog|store)\//i

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'AiSendBot/1.0 (+catalog builder tool)',
        Accept: 'text/html,application/json,application/xhtml+xml',
      },
    })
    if (!res.ok) return null
    // A redirect can leave the origin entirely — check where we landed,
    // same guard crawlSite applies for the same reason.
    if (!isPublicHost(new URL(res.url).hostname)) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Try Shopify's own product feed first — richest source, one request. */
async function tryShopifyFeed(rootUrl: string): Promise<ExtractedProduct[] | null> {
  const feedUrl = new URL('/products.json', rootUrl).toString()
  const body = await fetchText(feedUrl, PER_REQUEST_MS)
  if (!body) return null

  const products = parseShopifyFeed(body, rootUrl)
  return products.length > 0 ? products : null
}

/** Exported for tests — the parsing is where a feed shape surprise breaks this. */
export function parseShopifyFeed(body: string, rootUrl: string): ExtractedProduct[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return []
  }

  const list = (parsed as { products?: unknown[] })?.products
  if (!Array.isArray(list)) return []

  const products: ExtractedProduct[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const p = raw as Record<string, unknown>

    const name = typeof p.title === 'string' ? p.title.trim() : null
    if (!name) continue

    const variants = Array.isArray(p.variants) ? p.variants : []
    const firstVariant = variants[0] as Record<string, unknown> | undefined
    const images = Array.isArray(p.images) ? p.images : []
    const firstImage = images[0] as Record<string, unknown> | undefined

    products.push({
      name,
      price: typeof firstVariant?.price === 'string' ? firstVariant.price : null,
      // The public feed never states a currency — the storefront's own
      // locale decides that, and guessing one would be worse than
      // leaving it blank.
      currency: null,
      image: typeof firstImage?.src === 'string' ? firstImage.src : null,
      url: typeof p.handle === 'string'
        ? new URL(`/products/${p.handle}`, rootUrl).toString()
        : rootUrl,
      sku: typeof firstVariant?.sku === 'string' && firstVariant.sku ? firstVariant.sku : null,
    })
    if (products.length >= MAX_PRODUCTS) break
  }

  return products
}

/** schema.org Product nodes inside <script type="application/ld+json">. */
export function extractJsonLdProducts(html: string, pageUrl: string): ExtractedProduct[] {
  const found: ExtractedProduct[] = []

  for (const block of html.matchAll(
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let parsed: unknown
    try {
      parsed = JSON.parse(block[1].trim())
    } catch {
      continue // Malformed JSON-LD is common. Skip it, keep the rest.
    }

    const graph = (parsed as Record<string, unknown>)?.['@graph']
    const nodes = Array.isArray(parsed)
      ? parsed
      : [parsed, ...(Array.isArray(graph) ? graph : [])]

    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      const n = node as Record<string, unknown>
      if (String(n['@type'] ?? '') !== 'Product') continue

      const name = typeof n.name === 'string' ? n.name.trim() : null
      if (!name) continue

      const offersRaw = n.offers
      const offer = (Array.isArray(offersRaw) ? offersRaw[0] : offersRaw ?? {}) as Record<string, unknown>

      const imageRaw = n.image
      const image = Array.isArray(imageRaw) ? imageRaw[0] : imageRaw

      found.push({
        name,
        price: typeof offer.price === 'string' || typeof offer.price === 'number'
          ? String(offer.price)
          : null,
        currency: typeof offer.priceCurrency === 'string' ? offer.priceCurrency : null,
        image: typeof image === 'string' ? image : null,
        url: pageUrl,
        sku: typeof n.sku === 'string' ? n.sku : null,
      })
    }
  }

  return found
}

/** Open Graph product tags — the thinnest fallback, tried last. */
export function extractOgProduct(html: string, pageUrl: string): ExtractedProduct | null {
  // Attribute order isn't guaranteed by HTML, so property-then-content
  // and content-then-property both get a chance — the same reasoning
  // site-crawler.ts's tagAttr() documents for the same reason.
  const isProduct =
    /property\s*=\s*["']og:type["'][^>]*content\s*=\s*["']product["']/i.test(html) ||
    /content\s*=\s*["']product["'][^>]*property\s*=\s*["']og:type["']/i.test(html)
  if (!isProduct) return null

  const get = (prop: string): string | null => {
    const forward = html.match(
      new RegExp(`<meta[^>]+property\\s*=\\s*["']${prop}["'][^>]+content\\s*=\\s*["']([^"']+)["']`, 'i'),
    )
    const backward = html.match(
      new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]+property\\s*=\\s*["']${prop}["']`, 'i'),
    )
    return forward?.[1]?.trim() || backward?.[1]?.trim() || null
  }

  const name = get('og:title')
  if (!name) return null

  return {
    name,
    price: get('product:price:amount'),
    currency: get('product:price:currency'),
    image: get('og:image'),
    url: pageUrl,
    sku: null,
  }
}

/**
 * Paste a store URL, get back a product list.
 *
 * Tries Shopify's feed first; if the site isn't Shopify (or the feed is
 * disabled), crawls a handful of product-shaped links found on the seed
 * page and reads schema.org / Open Graph markup off each.
 */
export async function extractCatalog(seedUrl: string): Promise<CatalogResult> {
  const empty = (error: string): CatalogResult => ({
    products: [],
    source: null,
    pagesScanned: 0,
    truncated: false,
    error,
  })

  const seed = validatePublicUrl(seedUrl)
  if (!seed.ok) return empty(seed.reason)

  const rootUrl = seed.url.toString()

  // ── 1. Shopify's own feed ──
  const shopify = await tryShopifyFeed(rootUrl)
  if (shopify) {
    return { products: shopify, source: 'shopify', pagesScanned: 1, truncated: false, error: null }
  }

  // ── 2/3. Crawl product-shaped pages, read JSON-LD then Open Graph ──
  const startedAt = Date.now()
  const seedHtml = await fetchText(rootUrl, PER_REQUEST_MS)
  if (!seedHtml) {
    return empty('Could not read that site. Check the address and try again.')
  }

  const seedNormalised = normaliseUrl(rootUrl)
  const links = extractLinks(seedHtml, rootUrl, rootUrl).filter((link) =>
    PRODUCT_PATH.test(new URL(link).pathname),
  )
  const seedIsProductPage = PRODUCT_PATH.test(new URL(rootUrl).pathname)
  const toVisit = [...(seedIsProductPage ? [seedNormalised] : []), ...links].slice(0, MAX_PAGES)

  const products: ExtractedProduct[] = []
  let source: CatalogResult['source'] = null
  let pagesScanned = 0
  let truncated = false

  for (const url of toVisit) {
    if (Date.now() - startedAt > TOTAL_BUDGET_MS) { truncated = true; break }
    if (products.length >= MAX_PRODUCTS) { truncated = true; break }

    const html = url === seedNormalised ? seedHtml : await fetchText(url, PER_REQUEST_MS)
    if (!html) continue
    pagesScanned++

    const jsonLd = extractJsonLdProducts(html, url)
    if (jsonLd.length > 0) {
      source = source ?? 'jsonld'
      products.push(...jsonLd)
      continue
    }

    const og = extractOgProduct(html, url)
    if (og) {
      source = source ?? 'og'
      products.push(og)
    }
  }

  if (products.length === 0) {
    return empty(
      "We couldn't find a product catalogue at that address. This works best on Shopify, WooCommerce, and stores that mark up their product pages for Google — try pasting a specific product page instead of the homepage.",
    )
  }

  return {
    products: products.slice(0, MAX_PRODUCTS),
    source,
    pagesScanned,
    truncated,
    error: null,
  }
}
