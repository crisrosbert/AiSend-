// src/lib/widget/origin.ts
//
// Who is allowed to talk to /api/widget/*.
//
// ── THE PROBLEM ──────────────────────────────────────────────────────
// Every widget route currently answers `Access-Control-Allow-Origin: *`
// and checks nothing. The embed code is public — it is meant to be
// pasted into a page — so `org_id` and `agent_id` are public too. Anyone
// who views source on a customer's site can copy those two ids and run
// the agent from their own page, or from a script, forever. Every
// message costs the merchant a real LLM call.
//
// ── WHY CORS HEADERS ALONE ARE NOT THE FIX ───────────────────────────
// A browser refuses to *show* a cross-origin response to page script,
// but the request still reached us and we still paid for it. And curl,
// Postman and any server ignore CORS entirely. So the allowlist is
// enforced twice: the request is rejected server-side, and the CORS
// header only ever names an origin that passed.
//
// ── WHY AN EMPTY LIST STILL ALLOWS ───────────────────────────────────
// Widgets are live on customer sites right now with no allowlist
// configured. Defaulting an empty list to "deny" would take those
// chatbots down the moment this deploys. An empty list therefore means
// "not configured yet" and is allowed, with a warning in the log — the
// same trade-off AnythingLLM makes. Set WIDGET_REQUIRE_ALLOWLIST=true
// to flip that to deny once every tenant has filled theirs in.

/** `example.com`, `www.example.com`, `*.example.com`, `https://example.com/` */
export type DomainPattern = string

/**
 * Reduce whatever the merchant typed to a bare hostname pattern.
 *
 * They will paste `https://www.mysite.com/contact`, or type
 * `mysite.com `, or `*.mysite.com`. All three mean the same site.
 */
export function normaliseDomain(input: string): string | null {
  let value = (input || '').trim().toLowerCase()
  if (!value) return null

  // Strip a scheme and anything after the host.
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  value = value.split('/')[0].split('?')[0].split('#')[0]
  // Strip credentials and port.
  value = value.split('@').pop() ?? value
  value = value.replace(/:\d+$/, '')

  if (!value) return null

  // A bare `*` would allow everything — that is what an empty list
  // already means, and saying it explicitly is more likely a mistake
  // than an intention.
  if (value === '*' || value === '*.') return null

  // Reject anything that is not plausibly a hostname pattern.
  if (!/^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(value)) {
    return null
  }

  // A real site has a dot. Requiring one is what stops the list from
  // filling with fragments: the field is split on whitespace, so a
  // merchant typing a sentence would otherwise store "not", "a" and
  // "domain" as three entries. localhost is the one honest exception,
  // for testing an embed before the site is live.
  if (!value.includes('.') && value !== 'localhost') return null

  return value
}

/** Clean a merchant's textarea into a stored list. */
export function parseDomainList(input: string | string[] | null | undefined): string[] {
  if (!input) return []
  const parts = Array.isArray(input) ? input : input.split(/[\s,;\n]+/)
  const out: string[] = []
  for (const part of parts) {
    const domain = normaliseDomain(part)
    if (domain && !out.includes(domain)) out.push(domain)
  }
  return out
}

/**
 * Does this Origin header match the allowlist?
 *
 * `example.com` matches the bare domain and `www.` — merchants think of
 * those as one site and will not thank us for a support ticket about it.
 * Any deeper subdomain needs `*.example.com`, stated deliberately,
 * because `shop.example.com` can belong to someone else entirely on a
 * platform that hands out subdomains.
 */
export function originAllowed(origin: string | null, allowlist: string[]): boolean {
  // Not configured — see the note at the top of this file.
  if (!allowlist || allowlist.length === 0) {
    return process.env.WIDGET_REQUIRE_ALLOWLIST !== 'true'
  }

  if (!origin) return false

  let host: string
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    host = url.hostname.toLowerCase()
  } catch {
    return false
  }

  for (const entry of allowlist) {
    const pattern = entry.toLowerCase()
    if (pattern.startsWith('*.')) {
      const base = pattern.slice(2)
      if (host === base || host.endsWith(`.${base}`)) return true
      continue
    }
    if (host === pattern) return true
    if (host === `www.${pattern}`) return true
    if (pattern.startsWith('www.') && host === pattern.slice(4)) return true
  }

  return false
}

/**
 * CORS headers for one request.
 *
 * When an allowlist exists we echo the caller's own origin rather than
 * `*`. That is not decoration: `*` forbids credentialed requests and
 * tells every reader of the response that we do not care who asked.
 * Echoing a *validated* origin is safe; echoing an unvalidated one
 * would be worse than `*`.
 */
export function corsHeaders(
  origin: string | null,
  allowlist: string[],
  methods = 'POST, OPTIONS',
): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }

  if (allowlist.length > 0 && origin && originAllowed(origin, allowlist)) {
    headers['Access-Control-Allow-Origin'] = origin
    // The answer depends on who asked, so caches must not share it.
    headers['Vary'] = 'Origin'
  } else {
    headers['Access-Control-Allow-Origin'] = '*'
  }

  return headers
}

/** Read the allowlist off a widget_configs row, whatever shape it is in. */
export function allowlistFromConfig(config: unknown): string[] {
  if (!config || typeof config !== 'object') return []
  const raw = (config as Record<string, unknown>).allowed_domains
  if (Array.isArray(raw)) return parseDomainList(raw as string[])
  if (typeof raw === 'string') {
    // Older rows may hold a JSON string rather than a Postgres array.
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parseDomainList(parsed)
    } catch {
      /* fall through to comma splitting */
    }
    return parseDomainList(raw)
  }
  return []
}
