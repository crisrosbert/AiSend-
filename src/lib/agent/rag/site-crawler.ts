// src/lib/agent/rag/site-crawler.ts
//
// Reads a whole website — not just one page — so pasting a URL can build
// an agent that knows the business: its pages, its name, its logo.
//
// ── WHAT THIS REPLACES ───────────────────────────────────────────────
// train-from-url previously fetched exactly one page. That is enough to
// draft a persona and not much else: the pricing page, the services
// page and the contact details all sat one link away and were never
// read. This walks the site breadth-first from the address given.
//
// ── WHY NO CHEERIO, NO PUPPETEER, NO LANGCHAIN ───────────────────────
// Puppeteer cannot run in a Vercel function — that part of the usual
// advice is right. But cheerio, uuid and a tokenizer are not free
// either: every dependency added here means editing package.json AND
// package-lock.json, and this project is deployed by copying files
// through a web editor. A lock file edited by hand is a broken `npm ci`
// and a red deploy. The regex extraction below is less elegant than a
// DOM parser and costs nothing to ship.
//
// Chunking already exists in ingest.ts and is paragraph-aware with
// overlap, which suits prose better than a blind character splitter.
//
// ── THREE THINGS THE OBVIOUS IMPLEMENTATION GETS WRONG ───────────────
//   1. It validates only the URL the user typed. A crawler FOLLOWS
//      links, and a link can point at 169.254.169.254 or a private
//      address. Every URL is re-checked here before it is fetched.
//   2. It fetches each page twice — once to read its links, once to
//      read its text. Fifteen pages become thirty requests and twice
//      the time budget. This reads both from one response.
//   3. It bounds each request but not the whole crawl, so a site with
//      slow pages runs until the platform kills the function mid-write.

/* ─────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────── */

export interface CrawledPage {
  url: string
  title: string
  /** `link://<url>` — travels with each chunk so an answer can cite its page. */
  chunkSource: string
  text: string
  wordCount: number
}

/** What the site says about itself, for pre-filling the agent. */
export interface SiteBrand {
  name: string | null
  logoUrl: string | null
  description: string | null
  themeColor: string | null
}

export interface CrawlResult {
  pages: CrawledPage[]
  brand: SiteBrand
  /** URLs fetched but not usable, with the reason. */
  skipped: Array<{ url: string; reason: string }>
  /** True when a cap or the time budget stopped us early. */
  truncated: boolean
}

export interface CrawlOptions {
  /** 0 = the given page only. 1 = it and what it links to. */
  maxDepth?: number
  maxPages?: number
  /** Whole-crawl budget. Must stay under the route's maxDuration. */
  totalBudgetMs?: number
  perRequestMs?: number
  maxBytesPerPage?: number
}

const DEFAULTS: Required<CrawlOptions> = {
  maxDepth: 1,
  maxPages: 12,
  // 40s against a 60s route: leaves room for chunking, embedding and
  // the database writes that follow.
  totalBudgetMs: 40_000,
  perRequestMs: 8_000,
  maxBytesPerPage: 1_500_000,
}

/* ─────────────────────────────────────────────────────────────────────
   URL safety — applied to every URL, not just the first
   ───────────────────────────────────────────────────────────────────── */

/**
 * Is this address on the public internet?
 *
 * Exported and applied to every discovered link. A crawler that checks
 * only its seed is a server-side request forgery tool: one `<a href>`
 * pointing at a metadata endpoint or an internal admin panel and it
 * fetches that on our behalf, from inside our own network.
 */
export function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) return false

  // IPv4 private and link-local ranges. 169.254.x.x matters most: that
  // is where cloud providers serve instance credentials.
  if (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^0\./.test(host)
  ) return false

  // IPv6 unique-local and link-local.
  if (/^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return false

  return true
}

export function validatePublicUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, reason: 'That does not look like a valid address.' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https addresses can be read.' }
  }
  if (!isPublicHost(url.hostname)) {
    return { ok: false, reason: 'That address is not reachable from the public internet.' }
  }
  return { ok: true, url }
}

/**
 * One canonical form per page, so the same page discovered by three
 * different links is fetched once.
 *
 * Drops the fragment, sorts and strips tracking parameters, and removes
 * a trailing slash. Without this, `/about`, `/about/`, `/about#team` and
 * `/about?utm_source=x` are four pages of identical text in the index.
 */
export function normaliseUrl(input: string | URL): string {
  const url = typeof input === 'string' ? new URL(input) : new URL(input.href)
  url.hash = ''

  const drop = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'fbclid', 'msclkid', 'ref', 'mc_cid', 'mc_eid', '_ga',
  ]
  for (const key of drop) url.searchParams.delete(key)
  url.searchParams.sort()

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1)
  }
  return url.toString()
}

/** Files that are not pages. Fetching a 40MB PDF wastes the budget. */
const NON_PAGE = /\.(pdf|zip|rar|7z|gz|tar|mp4|mp3|wav|avi|mov|jpe?g|png|gif|webp|svg|ico|css|js|json|xml|rss|woff2?|ttf|eot|dmg|exe|apk|csv|xlsx?|docx?|pptx?)($|\?)/i

/**
 * Paths that never contain useful business copy.
 *
 * The optional `word-` prefix matters: WooCommerce ships `/my-account`
 * and Shopify themes ship `/shopping-cart`, so anchoring these to the
 * start of a segment misses the very platforms most merchants use.
 */
const NOISE_PATH = /\/(?:[a-z]+-)?(wp-admin|wp-login|wp-json|cart|checkout|basket|login|signin|sign-in|register|signup|sign-up|logout|account|admin|feed|tag|author|search)(\/|$|\?)/i

/* ─────────────────────────────────────────────────────────────────────
   Extraction — regex, deliberately
   ───────────────────────────────────────────────────────────────────── */

/**
 * Same-site links from one page.
 *
 * Scoped to the whole origin rather than the starting directory. A
 * marketing site keeps its pricing at /pricing and its services at
 * /services; confining the crawl to the seed's folder — as the common
 * implementation does — reads the homepage and finds nothing.
 *
 * www and the bare domain count as the same site, because most sites
 * link between the two forms inconsistently.
 */
export function extractLinks(html: string, pageUrl: string, rootUrl: string): string[] {
  const root = new URL(rootUrl)
  const rootHost = root.hostname.toLowerCase().replace(/^www\./, '')
  const found = new Set<string>()

  const hrefs = html.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi)

  for (const match of hrefs) {
    const href = match[1].trim()
    if (!href || href.startsWith('#')) continue
    if (/^(mailto:|tel:|javascript:|data:|sms:|whatsapp:)/i.test(href)) continue

    let abs: URL
    try {
      abs = new URL(href, pageUrl)
    } catch {
      continue
    }

    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue
    if (abs.hostname.toLowerCase().replace(/^www\./, '') !== rootHost) continue
    if (!isPublicHost(abs.hostname)) continue
    if (NON_PAGE.test(abs.pathname)) continue
    if (NOISE_PATH.test(abs.pathname)) continue

    found.add(normaliseUrl(abs))
  }

  return [...found]
}

/**
 * Turn a page title or site name into something usable as a name.
 *
 * A real example this was written against:
 *
 *   "Kalosa Aesthetics — Board-Certified Plastic & Cosmetic Surgery
 *    India |"
 *
 * Three separate problems in one string, and every one of them shows up
 * in the chat header a customer reads:
 *
 *   1. The trailing "|" — SEO plugins append a separator and then the
 *      site name, and when the site name is blank the separator is left
 *      hanging. Splitting on separators surrounded by whitespace misses
 *      it because there is nothing after it to be whitespace.
 *   2. The tagline after the dash. The business is "Kalosa Aesthetics";
 *      the rest is marketing aimed at Google.
 *   3. Length. Anything past about 40 characters wraps or truncates in
 *      a 320px-wide chat header.
 *
 * Trimming is conservative: if splitting would leave almost nothing,
 * the fuller string is kept. "Dr | Smith" must not become "Dr".
 */
export function tidyName(raw: string): string | null {
  let name = raw.replace(/\s+/g, ' ').trim()
  if (!name) return null

  // Drop a dangling separator at either end before anything else.
  name = name.replace(/^[\s|–—·\-:]+/, '').replace(/[\s|–—·\-:]+$/, '').trim()
  if (!name) return null

  // Take the first segment, but only if it is substantial enough to be
  // a name on its own.
  const head = name.split(/\s+[|–—·:]\s+|\s+-\s+/)[0].trim()
  if (head.length >= 3) name = head

  return name.slice(0, 60).trim() || null
}

function metaContent(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern)
  return match?.[1]?.trim() || null
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/**
 * What the site calls itself, and its logo.
 *
 * This is what makes pasting a URL feel like magic rather than like
 * filling in a form: the agent comes back already named, already
 * described, with the right picture.
 *
 * Order matters. og:site_name is the site's own name for itself;
 * <title> is a page name that usually carries a tagline after a
 * separator, so it is trimmed and used last. For the logo, an
 * apple-touch-icon is nearly always a clean square mark, whereas
 * og:image is often a wide social share card with text baked in — so
 * the icon wins even though og:image is the more obvious choice.
 */
export function extractBrand(html: string, pageUrl: string): SiteBrand {
  const abs = (value: string | null): string | null => {
    if (!value) return null
    try {
      const url = new URL(value, pageUrl)
      return isPublicHost(url.hostname) ? url.toString() : null
    } catch {
      return null
    }
  }

  // JSON-LD is the only place a site states its identity unambiguously.
  let ldName: string | null = null
  let ldLogo: string | null = null
  for (const block of html.matchAll(
    /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(block[1].trim())
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] ?? [])]
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue
        const type = String(node['@type'] ?? '')
        if (/Organization|LocalBusiness|Corporation|Store|WebSite/i.test(type)) {
          if (!ldName && typeof node.name === 'string') ldName = node.name
          if (!ldLogo) {
            const logo = node.logo
            if (typeof logo === 'string') ldLogo = logo
            else if (logo && typeof logo.url === 'string') ldLogo = logo.url
          }
        }
      }
    } catch {
      // Malformed JSON-LD is common. Skip it, keep the rest.
    }
  }

  const rawTitle =
    metaContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? null
  // "Sharma Retail | Best prices in Delhi" → "Sharma Retail"
  const titleName = rawTitle ? tidyName(decodeEntities(rawTitle)) : null

  const name =
    metaContent(html, /<meta[^>]+property\s*=\s*["']og:site_name["'][^>]+content\s*=\s*["']([^"']+)["']/i) ??
    ldName ??
    metaContent(html, /<meta[^>]+name\s*=\s*["']application-name["'][^>]+content\s*=\s*["']([^"']+)["']/i) ??
    titleName

  const logoUrl =
    abs(ldLogo) ??
    abs(metaContent(html, /<link[^>]+rel\s*=\s*["'][^"']*apple-touch-icon[^"']*["'][^>]+href\s*=\s*["']([^"']+)["']/i)) ??
    abs(metaContent(html, /<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i)) ??
    abs(metaContent(html, /<link[^>]+rel\s*=\s*["'][^"']*icon[^"']*["'][^>]+href\s*=\s*["']([^"']+)["']/i)) ??
    abs('/favicon.ico')

  const description =
    metaContent(html, /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']+)["']/i) ??
    metaContent(html, /<meta[^>]+property\s*=\s*["']og:description["'][^>]+content\s*=\s*["']([^"']+)["']/i)

  return {
    // Applied to whichever source won, not just the title. Kalosa's
    // dangling "|" came through og:site_name — WordPress SEO plugins
    // write the same padded string into every name field they touch.
    name: name ? tidyName(decodeEntities(name)) : null,
    logoUrl,
    description: description ? decodeEntities(description).slice(0, 300) : null,
    themeColor: metaContent(html, /<meta[^>]+name\s*=\s*["']theme-color["'][^>]+content\s*=\s*["']([^"']+)["']/i),
  }
}

/**
 * Readable text, with navigation and boilerplate removed.
 *
 * Headers, navs and footers repeat on every page. Left in, the same
 * menu is indexed a dozen times and crowds out the answer the customer
 * was looking for.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)\s*\/?>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => decodeEntities(line).replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Did this page render its content in the browser rather than on the
 * server?
 *
 * A React or Vue site with no server rendering returns a nearly empty
 * shell to a plain fetch. Reporting that honestly is worth more than
 * indexing forty words of loading text and calling it knowledge.
 */
export function looksJsRendered(text: string, html: string): boolean {
  if (text.length >= 250) return false
  return (
    html.length > 2000 &&
    /<div[^>]+id\s*=\s*["'](root|app|__next|__nuxt|q-app)["']/i.test(html)
  )
}

/**
 * Prefix each chunk with where it came from.
 *
 * The model sees this text verbatim, so it can say "on your pricing
 * page it says…" instead of stating a number with no provenance. It
 * also makes a wrong answer traceable to the page that caused it.
 */
export function withSourceHeader(chunk: string, title: string, url: string): string {
  return `<source title="${title.replace(/"/g, "'")}" url="${url}">\n${chunk}`
}

/* ─────────────────────────────────────────────────────────────────────
   The crawl
   ───────────────────────────────────────────────────────────────────── */

async function fetchPage(
  url: string,
  perRequestMs: number,
  maxBytes: number,
): Promise<{ html: string } | { error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), perRequestMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Identify honestly. Pretending to be Chrome is how a crawler
        // gets an IP range banned.
        'User-Agent': 'AiSendBot/1.0 (+website training)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!res.ok) return { error: `HTTP ${res.status}` }

    // A redirect can leave the origin entirely — check where we landed.
    if (!isPublicHost(new URL(res.url).hostname)) {
      return { error: 'redirected to a private address' }
    }

    const type = res.headers.get('content-type') ?? ''
    if (type && !/text\/html|application\/xhtml/i.test(type)) {
      return { error: 'not an HTML page' }
    }

    const buffer = await res.arrayBuffer()
    if (buffer.byteLength > maxBytes) return { error: 'page too large' }

    return { html: new TextDecoder('utf-8').decode(buffer) }
  } catch (err) {
    return {
      error: err instanceof Error && err.name === 'AbortError' ? 'timed out' : 'could not be reached',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Walk a site breadth-first from `seedUrl`.
 *
 * Breadth-first rather than depth-first on purpose: the pages one click
 * from the homepage are the ones that describe the business. Depth-first
 * would spend the budget deep in a blog archive.
 */
export async function crawlSite(
  seedUrl: string,
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const opts = { ...DEFAULTS, ...options }
  const startedAt = Date.now()

  const seed = validatePublicUrl(seedUrl)
  if (!seed.ok) {
    return {
      pages: [],
      brand: { name: null, logoUrl: null, description: null, themeColor: null },
      skipped: [{ url: seedUrl, reason: seed.reason }],
      truncated: false,
    }
  }

  const rootUrl = seed.url.toString()
  const start = normaliseUrl(seed.url)

  const queued = new Set<string>([start])
  let frontier: Array<{ url: string; depth: number }> = [{ url: start, depth: 0 }]

  const pages: CrawledPage[] = []
  const skipped: Array<{ url: string; reason: string }> = []
  let brand: SiteBrand = { name: null, logoUrl: null, description: null, themeColor: null }
  let truncated = false

  while (frontier.length > 0) {
    const next: Array<{ url: string; depth: number }> = []

    for (const { url, depth } of frontier) {
      if (pages.length >= opts.maxPages) { truncated = true; break }
      if (Date.now() - startedAt > opts.totalBudgetMs) { truncated = true; break }

      // Re-checked here even though it passed on discovery: cheap, and
      // the one place a mistake would be exploitable.
      const checked = validatePublicUrl(url)
      if (!checked.ok) { skipped.push({ url, reason: checked.reason }); continue }

      const result = await fetchPage(url, opts.perRequestMs, opts.maxBytesPerPage)
      if ('error' in result) { skipped.push({ url, reason: result.error }); continue }

      const html = result.html

      // The seed page speaks for the site's identity.
      if (pages.length === 0 && skipped.length === 0) brand = extractBrand(html, url)

      const text = htmlToText(html)

      if (looksJsRendered(text, html)) {
        skipped.push({ url, reason: 'js_rendered_shell' })
      } else if (text.length < 120) {
        skipped.push({ url, reason: 'too little text' })
      } else {
        const rawTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        pages.push({
          url,
          title: rawTitle ? decodeEntities(rawTitle).trim().slice(0, 120) : url,
          chunkSource: `link://${url}`,
          text,
          wordCount: text.split(/\s+/).length,
        })
      }

      // Links come from the same response — never a second fetch.
      if (depth < opts.maxDepth) {
        for (const link of extractLinks(html, url, rootUrl)) {
          if (queued.has(link)) continue
          if (queued.size >= opts.maxPages * 3) break // discovery cap
          queued.add(link)
          next.push({ url: link, depth: depth + 1 })
        }
      }
    }

    if (pages.length >= opts.maxPages) { truncated = true; break }
    if (Date.now() - startedAt > opts.totalBudgetMs) { truncated = true; break }
    frontier = next
  }

  // A site whose homepage is a shell is almost certainly a shell
  // throughout — say so plainly rather than reporting a vague failure.
  if (pages.length === 0 && skipped.some((s) => s.reason === 'js_rendered_shell')) {
    skipped.push({
      url: rootUrl,
      reason: 'This site builds its pages in the browser, so its text cannot be read this way.',
    })
  }

  return { pages, brand, skipped, truncated }
}
