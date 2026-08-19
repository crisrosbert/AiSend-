// src/lib/agent/rag/site-crawler.test.ts
//
// The security tests here are not decoration. The reference
// implementation this replaces validated only the URL the user typed and
// then followed every link it found — which turns the crawler into an
// SSRF tool that fetches internal addresses on our behalf. Those cases
// come first.

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isPublicHost,
  validatePublicUrl,
  normaliseUrl,
  extractLinks,
  extractBrand,
  htmlToText,
  looksJsRendered,
  withSourceHeader,
  tidyName,
  crawlSite,
} from './site-crawler'

/* ─────────────────────────────────────────────────────────────────────
   SSRF
   ───────────────────────────────────────────────────────────────────── */

describe('isPublicHost', () => {
  it('accepts ordinary public hostnames', () => {
    for (const host of ['example.com', 'www.kalosa.in', 'shop.example.co.uk', '8.8.8.8']) {
      expect(isPublicHost(host), host).toBe(true)
    }
  })

  it('rejects the cloud metadata endpoint', () => {
    // 169.254.169.254 serves instance credentials on AWS, GCP and Azure.
    // One <a href> pointing here is the whole attack.
    expect(isPublicHost('169.254.169.254')).toBe(false)
  })

  it('rejects loopback, private and link-local addresses', () => {
    const blocked = [
      'localhost',
      '127.0.0.1',
      '127.1.2.3',
      '10.0.0.1',
      '10.255.255.255',
      '192.168.1.1',
      '172.16.0.1',
      '172.20.5.5',
      '172.31.255.254',
      '0.0.0.0',
      '0.1.2.3',
      '::1',
      'fd00::1',
      'fc00::1234',
      'fe80::1',
    ]
    for (const host of blocked) {
      expect(isPublicHost(host), host).toBe(false)
    }
  })

  it('does not over-block the public 172.32-172.15 neighbours', () => {
    // Only 172.16–172.31 is private. 172.15 and 172.32 are public and a
    // real customer site could sit there.
    expect(isPublicHost('172.15.0.1')).toBe(true)
    expect(isPublicHost('172.32.0.1')).toBe(true)
  })

  it('rejects internal TLDs', () => {
    expect(isPublicHost('printer.local')).toBe(false)
    expect(isPublicHost('vault.internal')).toBe(false)
    expect(isPublicHost('api.localhost')).toBe(false)
  })

  it('is case-insensitive and unwraps bracketed IPv6', () => {
    expect(isPublicHost('LOCALHOST')).toBe(false)
    expect(isPublicHost('[::1]')).toBe(false)
    expect(isPublicHost('[FE80::1]')).toBe(false)
  })
})

describe('validatePublicUrl', () => {
  it('accepts http and https', () => {
    expect(validatePublicUrl('https://example.com').ok).toBe(true)
    expect(validatePublicUrl('http://example.com/about').ok).toBe(true)
  })

  it('rejects non-http schemes that can read local files or run code', () => {
    for (const raw of [
      'file:///etc/passwd',
      'ftp://example.com',
      'javascript:alert(1)',
      'data:text/html,<h1>hi',
      'gopher://example.com',
    ]) {
      expect(validatePublicUrl(raw).ok, raw).toBe(false)
    }
  })

  it('rejects garbage input without throwing', () => {
    expect(validatePublicUrl('not a url').ok).toBe(false)
    expect(validatePublicUrl('').ok).toBe(false)
  })

  it('rejects a private address even when it is well-formed', () => {
    const result = validatePublicUrl('http://169.254.169.254/latest/meta-data/')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/public internet/i)
  })

  it('tolerates surrounding whitespace from a paste', () => {
    const result = validatePublicUrl('  https://example.com/  ')
    expect(result.ok).toBe(true)
  })
})

/* ─────────────────────────────────────────────────────────────────────
   Deduplication
   ───────────────────────────────────────────────────────────────────── */

describe('normaliseUrl', () => {
  it('collapses the four ways a site links to the same page', () => {
    const canonical = normaliseUrl('https://example.com/about')
    expect(normaliseUrl('https://example.com/about/')).toBe(canonical)
    expect(normaliseUrl('https://example.com/about#team')).toBe(canonical)
    expect(normaliseUrl('https://example.com/about?utm_source=fb')).toBe(canonical)
  })

  it('strips every tracking parameter it knows', () => {
    const url = normaliseUrl(
      'https://example.com/p?utm_source=a&utm_medium=b&gclid=c&fbclid=d&ref=e',
    )
    expect(url).toBe('https://example.com/p')
  })

  it('keeps parameters that select content', () => {
    // ?id=5 is a different product. Dropping it would merge pages.
    expect(normaliseUrl('https://example.com/p?id=5')).toContain('id=5')
  })

  it('sorts parameters so order does not create a duplicate', () => {
    expect(normaliseUrl('https://example.com/p?b=2&a=1')).toBe(
      normaliseUrl('https://example.com/p?a=1&b=2'),
    )
  })

  it('leaves the root path alone', () => {
    expect(normaliseUrl('https://example.com/')).toBe('https://example.com/')
  })
})

/* ─────────────────────────────────────────────────────────────────────
   Link discovery
   ───────────────────────────────────────────────────────────────────── */

describe('extractLinks', () => {
  const root = 'https://example.com'

  it('finds same-site links and resolves relative hrefs', () => {
    const html = `
      <a href="/about">About</a>
      <a href="pricing">Pricing</a>
      <a href="https://example.com/contact">Contact</a>
    `
    const links = extractLinks(html, 'https://example.com/', root)
    expect(links).toContain('https://example.com/about')
    expect(links).toContain('https://example.com/pricing')
    expect(links).toContain('https://example.com/contact')
  })

  it('does not follow a link to an internal address', () => {
    // The whole point. A compromised or hostile page links inward and a
    // naive crawler fetches it from inside our network.
    const html = `
      <a href="http://169.254.169.254/latest/meta-data/">docs</a>
      <a href="http://localhost:3000/admin">admin</a>
      <a href="http://192.168.0.1/">router</a>
    `
    expect(extractLinks(html, 'https://example.com/', root)).toEqual([])
  })

  it('stays on the site', () => {
    const html = `
      <a href="https://facebook.com/example">Facebook</a>
      <a href="https://evil.example.com.attacker.net/">lookalike</a>
    `
    expect(extractLinks(html, 'https://example.com/', root)).toEqual([])
  })

  it('treats www and the bare domain as one site', () => {
    const html = '<a href="https://www.example.com/services">Services</a>'
    expect(extractLinks(html, 'https://example.com/', root)).toHaveLength(1)
  })

  it('ignores non-page schemes', () => {
    const html = `
      <a href="mailto:hi@example.com">Mail</a>
      <a href="tel:+919000000000">Call</a>
      <a href="whatsapp://send?phone=91">Chat</a>
      <a href="javascript:void(0)">Menu</a>
      <a href="#top">Top</a>
    `
    expect(extractLinks(html, 'https://example.com/', root)).toEqual([])
  })

  it('skips files that are not pages', () => {
    const html = `
      <a href="/brochure.pdf">Brochure</a>
      <a href="/logo.png">Logo</a>
      <a href="/data.zip">Download</a>
      <a href="/real-page">Page</a>
    `
    const links = extractLinks(html, 'https://example.com/', root)
    expect(links).toEqual(['https://example.com/real-page'])
  })

  it('skips carts, logins and admin paths', () => {
    const html = `
      <a href="/cart">Cart</a>
      <a href="/checkout">Checkout</a>
      <a href="/wp-admin/">Admin</a>
      <a href="/my-account">Account</a>
      <a href="/services">Services</a>
    `
    const links = extractLinks(html, 'https://example.com/', root)
    expect(links).toEqual(['https://example.com/services'])
  })

  it('deduplicates a nav repeated in a mobile menu', () => {
    const html = `
      <nav><a href="/about">About</a></nav>
      <div class="mobile"><a href="/about/">About</a></div>
      <footer><a href="/about#team">About</a></footer>
    `
    expect(extractLinks(html, 'https://example.com/', root)).toHaveLength(1)
  })

  it('reads links out of a subdirectory page relative to that page', () => {
    const html = '<a href="team">Team</a>'
    const links = extractLinks(html, 'https://example.com/company/', root)
    expect(links).toEqual(['https://example.com/company/team'])
  })

  it('handles single quotes and extra attributes', () => {
    const html = `<a class="btn" data-x='1' href='/pricing' rel="nofollow">Pricing</a>`
    expect(extractLinks(html, 'https://example.com/', root)).toEqual([
      'https://example.com/pricing',
    ])
  })
})

/* ─────────────────────────────────────────────────────────────────────
   Brand — the part that makes pasting a URL feel like magic
   ───────────────────────────────────────────────────────────────────── */

describe('extractBrand', () => {
  const page = 'https://kalosa.in/'

  it('prefers JSON-LD, which is the site stating its own identity', () => {
    const html = `
      <title>Home | Kalosa</title>
      <meta property="og:site_name" content="Kalosa Clinic">
      <script type="application/ld+json">
        {"@type":"Organization","name":"Kalosa Skin & Hair","logo":"https://kalosa.in/logo.png"}
      </script>
    `
    const brand = extractBrand(html, page)
    // og:site_name still wins for the name — it is what the site wants
    // shown — but the logo comes from JSON-LD.
    expect(brand.name).toBe('Kalosa Clinic')
    expect(brand.logoUrl).toBe('https://kalosa.in/logo.png')
  })

  it('reads a JSON-LD logo given as an ImageObject', () => {
    const html = `<script type="application/ld+json">
      {"@type":"LocalBusiness","name":"Sharma Retail","logo":{"@type":"ImageObject","url":"/img/mark.svg"}}
    </script>`
    const brand = extractBrand(html, page)
    expect(brand.name).toBe('Sharma Retail')
    expect(brand.logoUrl).toBe('https://kalosa.in/img/mark.svg')
  })

  it('walks an @graph', () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","name":"Home"},
        {"@type":"Organization","name":"Skyline Realty","logo":"https://cdn.example.com/s.png"}
      ]}
    </script>`
    expect(extractBrand(html, page).name).toBe('Skyline Realty')
  })

  it('survives malformed JSON-LD, which is common', () => {
    const html = `
      <title>Acme</title>
      <script type="application/ld+json">{ not json at all }</script>
    `
    expect(() => extractBrand(html, page)).not.toThrow()
    expect(extractBrand(html, page).name).toBe('Acme')
  })

  it('trims the tagline off a title', () => {
    const html = '<title>Sharma Retail | Best prices in Delhi</title>'
    expect(extractBrand(html, page).name).toBe('Sharma Retail')
  })

  it('prefers apple-touch-icon over og:image', () => {
    // og:image is usually a wide share card with text baked in; the
    // touch icon is a clean square mark, which is what a chat avatar
    // needs.
    const html = `
      <meta property="og:image" content="https://kalosa.in/share-card.jpg">
      <link rel="apple-touch-icon" href="/apple-icon.png">
    `
    expect(extractBrand(html, page).logoUrl).toBe('https://kalosa.in/apple-icon.png')
  })

  it('falls back through og:image, rel=icon, then /favicon.ico', () => {
    expect(
      extractBrand('<meta property="og:image" content="/card.jpg">', page).logoUrl,
    ).toBe('https://kalosa.in/card.jpg')

    expect(
      extractBrand('<link rel="shortcut icon" href="/fav.png">', page).logoUrl,
    ).toBe('https://kalosa.in/fav.png')

    expect(extractBrand('<title>Nothing</title>', page).logoUrl).toBe(
      'https://kalosa.in/favicon.ico',
    )
  })

  it('will not return a logo hosted on a private address', () => {
    const html = '<link rel="apple-touch-icon" href="http://192.168.1.5/logo.png">'
    // Falls through to the favicon rather than pointing the browser at
    // an internal host.
    expect(extractBrand(html, page).logoUrl).toBe('https://kalosa.in/favicon.ico')
  })

  it('picks up description and theme colour', () => {
    const html = `
      <meta name="description" content="Skin &amp; hair clinic in Indore.">
      <meta name="theme-color" content="#0a7c5a">
    `
    const brand = extractBrand(html, page)
    expect(brand.description).toBe('Skin & hair clinic in Indore.')
    expect(brand.themeColor).toBe('#0a7c5a')
  })

  it('returns nulls for a page that says nothing about itself', () => {
    const brand = extractBrand('<p>hello</p>', page)
    expect(brand.name).toBeNull()
    expect(brand.description).toBeNull()
    expect(brand.themeColor).toBeNull()
  })
})

/* ─────────────────────────────────────────────────────────────────────
   Text
   ───────────────────────────────────────────────────────────────────── */

describe('htmlToText', () => {
  it('drops the nav, header and footer that repeat on every page', () => {
    const html = `
      <header><a href="/">Home</a> <a href="/about">About</a></header>
      <nav>Menu Menu Menu</nav>
      <main><p>We open at 10am and close at 7pm.</p></main>
      <footer>© 2026 Kalosa. All rights reserved.</footer>
    `
    const text = htmlToText(html)
    expect(text).toContain('We open at 10am')
    expect(text).not.toContain('Menu')
    expect(text).not.toContain('All rights reserved')
  })

  it('removes script, style and svg content entirely', () => {
    const html = `
      <script>var secret = "apikey123"</script>
      <style>.a{color:red}</style>
      <svg><path d="M0 0"/></svg>
      <p>Real copy.</p>
    `
    const text = htmlToText(html)
    expect(text).toBe('Real copy.')
  })

  it('keeps block boundaries so sentences do not run together', () => {
    const html = '<p>First line.</p><p>Second line.</p>'
    expect(htmlToText(html)).toBe('First line.\nSecond line.')
  })

  it('decodes the entities that appear in body copy', () => {
    expect(htmlToText('<p>Skin &amp; hair &#39;care&#39;</p>')).toBe("Skin & hair 'care'")
  })

  it('strips HTML comments', () => {
    expect(htmlToText('<!-- internal note --><p>Visible.</p>')).toBe('Visible.')
  })

  it('collapses runs of blank lines', () => {
    const text = htmlToText('<p>A</p><div></div><div></div><div></div><p>B</p>')
    expect(text).not.toMatch(/\n{3,}/)
  })
})

describe('looksJsRendered', () => {
  it('flags a React shell that returned almost no text', () => {
    const html = `<div id="root"></div><script>${'x'.repeat(3000)}</script>`
    expect(looksJsRendered('Loading...', html)).toBe(true)
  })

  it('flags Next and Nuxt mount points too', () => {
    const bulk = `<script>${'x'.repeat(3000)}</script>`
    expect(looksJsRendered('', `<div id="__next"></div>${bulk}`)).toBe(true)
    expect(looksJsRendered('', `<div id="__nuxt"></div>${bulk}`)).toBe(true)
  })

  it('does not flag a server-rendered page that happens to use React', () => {
    const html = `<div id="root">${'<p>real content</p>'.repeat(50)}</div>`
    expect(looksJsRendered('a'.repeat(400), html)).toBe(false)
  })

  it('does not flag a genuinely short static page', () => {
    // A thin page is a thin page, not a broken crawl — no mount point.
    expect(looksJsRendered('Short.', '<html><body><p>Short.</p></body></html>')).toBe(false)
  })
})

describe('withSourceHeader', () => {
  it('names the page the chunk came from', () => {
    const out = withSourceHeader('We open at 10am.', 'Contact', 'https://x.com/contact')
    expect(out).toContain('url="https://x.com/contact"')
    expect(out).toContain('title="Contact"')
    expect(out).toContain('We open at 10am.')
  })

  it('does not let a quote in the title break the attribute', () => {
    const out = withSourceHeader('body', 'The "Best" Clinic', 'https://x.com/')
    expect(out).toContain(`title="The 'Best' Clinic"`)
  })
})

/* ─────────────────────────────────────────────────────────────────────
   The crawl, against a stubbed fetch
   ───────────────────────────────────────────────────────────────────── */

function htmlResponse(body: string, url: string) {
  return {
    ok: true,
    status: 200,
    url,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'text/html' : null) },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  } as unknown as Response
}

const FILLER = 'Kalosa is a skin and hair clinic in Indore. '.repeat(8)

function stubSite(pages: Record<string, string>) {
  return vi.fn(async (input: string | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    const key = url.replace(/\/$/, '') || url
    const body = pages[url] ?? pages[key] ?? pages[`${key}/`]
    if (!body) return { ok: false, status: 404, url } as unknown as Response
    return htmlResponse(body, url)
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('crawlSite', () => {
  it('refuses a private seed without making a request', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    return crawlSite('http://169.254.169.254/').then((result) => {
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(result.pages).toEqual([])
      expect(result.skipped[0].reason).toMatch(/public internet/i)
    })
  })

  it('reads the seed page and the pages it links to', async () => {
    vi.stubGlobal(
      'fetch',
      stubSite({
        'https://example.com/': `
          <title>Kalosa Clinic</title>
          <meta property="og:site_name" content="Kalosa">
          <p>${FILLER}</p>
          <a href="/services">Services</a><a href="/contact">Contact</a>`,
        'https://example.com/services': `<title>Services</title><p>Hydrafacial and laser. ${FILLER}</p>`,
        'https://example.com/contact': `<title>Contact</title><p>Open 10am to 7pm daily. ${FILLER}</p>`,
      }),
    )

    const result = await crawlSite('https://example.com/')

    expect(result.pages.map((p) => p.url).sort()).toEqual([
      'https://example.com/',
      'https://example.com/contact',
      'https://example.com/services',
    ])
    expect(result.brand.name).toBe('Kalosa')
    expect(result.pages.find((p) => p.url.endsWith('/contact'))?.text).toContain('10am to 7pm')
  })

  it('fetches each page exactly once', async () => {
    // The implementation this replaces fetched every page twice — once
    // for links, once for text. Fifteen pages became thirty requests.
    const fetchSpy = stubSite({
      'https://example.com/': `<p>${FILLER}</p><a href="/a">A</a><a href="/b">B</a>`,
      'https://example.com/a': `<p>Page A. ${FILLER}</p><a href="/b">B</a><a href="/">Home</a>`,
      'https://example.com/b': `<p>Page B. ${FILLER}</p><a href="/a">A</a><a href="/">Home</a>`,
    })
    vi.stubGlobal('fetch', fetchSpy)

    await crawlSite('https://example.com/', { maxDepth: 2 })

    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('stops at maxPages and says it was truncated', async () => {
    const links = Array.from({ length: 30 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join('')
    const pages: Record<string, string> = {
      'https://example.com/': `<p>${FILLER}</p>${links}`,
    }
    for (let i = 0; i < 30; i++) {
      pages[`https://example.com/p${i}`] = `<p>Page ${i}. ${FILLER}</p>`
    }
    vi.stubGlobal('fetch', stubSite(pages))

    const result = await crawlSite('https://example.com/', { maxPages: 5 })

    expect(result.pages.length).toBeLessThanOrEqual(5)
    expect(result.truncated).toBe(true)
  })

  it('honours maxDepth 0 — the given page only', async () => {
    const fetchSpy = stubSite({
      'https://example.com/': `<p>${FILLER}</p><a href="/a">A</a>`,
      'https://example.com/a': `<p>A. ${FILLER}</p>`,
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await crawlSite('https://example.com/', { maxDepth: 0 })

    expect(result.pages).toHaveLength(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('records a page that could not be fetched instead of failing the crawl', async () => {
    vi.stubGlobal(
      'fetch',
      stubSite({
        'https://example.com/': `<p>${FILLER}</p><a href="/gone">Gone</a><a href="/ok">Ok</a>`,
        'https://example.com/ok': `<p>Fine. ${FILLER}</p>`,
      }),
    )

    const result = await crawlSite('https://example.com/')

    expect(result.pages).toHaveLength(2)
    expect(result.skipped.some((s) => s.url.endsWith('/gone') && s.reason === 'HTTP 404')).toBe(true)
  })

  it('will not follow a redirect that lands on a private address', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse('<p>internal</p>', 'http://169.254.169.254/')),
    )

    const result = await crawlSite('https://example.com/')

    expect(result.pages).toEqual([])
    expect(result.skipped[0].reason).toMatch(/private address/i)
  })

  it('reports a JavaScript-rendered site in words a merchant can act on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        htmlResponse(`<div id="root"></div><script>${'x'.repeat(4000)}</script>`, 'https://example.com/'),
      ),
    )

    const result = await crawlSite('https://example.com/')

    expect(result.pages).toEqual([])
    expect(result.skipped.some((s) => s.reason === 'js_rendered_shell')).toBe(true)
    expect(result.skipped.some((s) => /builds its pages in the browser/i.test(s.reason))).toBe(true)
  })

  it('rejects a response that is not HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        url: 'https://example.com/',
        headers: { get: () => 'application/pdf' },
        arrayBuffer: async () => new ArrayBuffer(10),
      }) as unknown as Response),
    )

    const result = await crawlSite('https://example.com/')
    expect(result.skipped[0].reason).toBe('not an HTML page')
  })

  it('rejects a page over the byte cap', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse('<p>'.padEnd(5000, 'x'), 'https://example.com/')),
    )

    const result = await crawlSite('https://example.com/', { maxBytesPerPage: 100 })
    expect(result.skipped[0].reason).toBe('page too large')
  })

  it('gives up on a request that hangs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
      ),
    )

    const result = await crawlSite('https://example.com/', { perRequestMs: 20 })
    expect(result.skipped[0].reason).toBe('timed out')
  })

  it('carries the page URL on every result so an answer can be traced', async () => {
    vi.stubGlobal(
      'fetch',
      stubSite({ 'https://example.com/': `<title>Home</title><p>${FILLER}</p>` }),
    )

    const result = await crawlSite('https://example.com/')
    expect(result.pages[0].chunkSource).toBe('link://https://example.com/')
    expect(result.pages[0].title).toBe('Home')
    expect(result.pages[0].wordCount).toBeGreaterThan(10)
  })
})

describe('tidyName', () => {
  it('cleans the real string Kalosa produced', () => {
    // Verbatim from the agents table after a live crawl. Three faults
    // in one value: dangling separator, SEO tagline, and a length no
    // chat header can show.
    expect(
      tidyName('Kalosa Aesthetics — Board-Certified Plastic & Cosmetic Surgery India |'),
    ).toBe('Kalosa Aesthetics')
  })

  it('strips a dangling separator at either end', () => {
    expect(tidyName('Acme |')).toBe('Acme')
    expect(tidyName('| Acme')).toBe('Acme')
    expect(tidyName('Acme -')).toBe('Acme')
    expect(tidyName('Acme :')).toBe('Acme')
  })

  it('drops the tagline after a separator', () => {
    expect(tidyName('Sharma Retail | Best prices in Delhi')).toBe('Sharma Retail')
    expect(tidyName('Skyline Realty - Flats in Pune')).toBe('Skyline Realty')
    expect(tidyName('Kalosa · Skin and hair')).toBe('Kalosa')
  })

  it('keeps a hyphenated name intact', () => {
    // The hyphen here is part of the word, not a separator — it has no
    // surrounding spaces.
    expect(tidyName('Coca-Cola India')).toBe('Coca-Cola India')
    expect(tidyName('Board-Certified Surgeons')).toBe('Board-Certified Surgeons')
  })

  it('does not trim down to a fragment', () => {
    // "Dr | Smith" must not become "Dr".
    expect(tidyName('Dr | Smith Clinic')).toBe('Dr | Smith Clinic')
  })

  it('collapses whitespace from a multi-line title tag', () => {
    expect(tidyName('  Acme\n   Clinic  ')).toBe('Acme Clinic')
  })

  it('caps the length for a chat header', () => {
    expect(tidyName('A'.repeat(200))!.length).toBe(60)
  })

  it('returns null for nothing usable', () => {
    expect(tidyName('')).toBeNull()
    expect(tidyName('   ')).toBeNull()
    expect(tidyName('|')).toBeNull()
    expect(tidyName(' — ')).toBeNull()
  })
})
