// src/lib/agent/draft-quality.ts
//
// Post-processing for what train-from-url drafts about a business.
//
// The problem: the model (and sometimes the site's own metadata, e.g. a
// WordPress SEO plugin) wrote the business name the way the web address is
// spelled, so the draft greeting said "Welcome to kalosaaesthetics" instead
// of "Welcome to Kalosa Aesthetics". A domain is not a brand name.
//
// What this does, deterministically (no model call):
//   1. decides whether a name looks like the web address (all one word that
//      equals the domain, or contains ".com" / "www.");
//   2. looks for the properly written name in the site's own text (page
//      titles and body): "Kalosa Aesthetics" has the same letters as
//      "kalosaaesthetics", so the spaced and capitalised form is recovered
//      from the page, never invented;
//   3. swaps any domain spelling left in the greeting / questions / persona
//      for that name.
// If the proper name cannot be found, the text is left exactly as it was.

/** Letters and digits only, lower case: "Kalosa Aesthetics" -> "kalosaaesthetics". */
export function squash(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'])

/** "www.kalosaaesthetics.com" -> "kalosaaesthetics"; "shop.abc.co.in" -> "abc". */
export function hostStem(host: string): string {
  const parts = (host ?? '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('.').filter(Boolean)
  while (parts.length && parts[0] === 'www') parts.shift()
  if (parts.length <= 1) return parts[0] ?? ''
  // Drop the TLD (and a second-level like co/com before it).
  parts.pop()
  if (parts.length > 1 && SECOND_LEVEL.has(parts[parts.length - 1])) parts.pop()
  return parts[parts.length - 1] ?? ''
}

/** Does this "name" look like the web address rather than a brand name? */
export function isDomainLikeName(name: string | null | undefined, host: string): boolean {
  const n = (name ?? '').trim()
  if (!n) return false
  if (/^(?:https?:\/\/|www\.)/i.test(n)) return true
  if (!/\s/.test(n) && /\.[a-z]{2,}(?:\/|$)/i.test(n)) return true // "kalosa.com"
  const stem = squash(hostStem(host))
  if (stem.length < 4 || /\s/.test(n)) return false
  // One word, same letters as the domain, no capital letter after the first:
  // "kalosaaesthetics" or "Kalosaaesthetics", not "KalosaAesthetics" or "Hudle Sports".
  return squash(n) === stem && n.slice(1) === n.slice(1).toLowerCase()
}

/**
 * Find the properly written form of `target` (letters only) in the site's text:
 * 2 to 4 consecutive words whose letters, joined, equal `target`.
 * Returns the most frequent spelling, preferring capitalised words.
 */
export function recoverSpacedName(target: string, texts: string[]): string | null {
  const t = squash(target)
  if (t.length < 4) return null
  const found = new Map<string, { text: string; count: number; caps: number }>()
  for (const raw of texts) {
    const words = (raw ?? '').slice(0, 30_000).match(/[A-Za-z0-9][A-Za-z0-9&'’]*/g) ?? []
    for (let i = 0; i < words.length; i++) {
      let joined = ''
      for (let len = 1; len <= 4 && i + len <= words.length; len++) {
        joined += squash(words[i + len - 1])
        if (joined.length > t.length) break
        if (len >= 2 && joined === t) {
          const slice = words.slice(i, i + len)
          const text = slice.join(' ')
          const key = text.toLowerCase()
          const caps = slice.filter((w) => /^[A-Z]/.test(w)).length
          const prev = found.get(key)
          if (prev) { prev.count++; prev.caps = Math.max(prev.caps, caps) }
          else found.set(key, { text, count: 1, caps })
        }
      }
    }
  }
  let best: { text: string; count: number; caps: number } | null = null
  for (const c of found.values()) {
    // Capitalised spellings win over lower-case ones; then the more frequent.
    if (!best || c.caps > best.caps || (c.caps === best.caps && c.count > best.count)) best = c
  }
  if (!best) return null
  // A lower-case-only match ("kalosa aesthetics") still reads better than the domain: Title Case it.
  if (best.caps === 0) return best.text.replace(/\b[a-z]/g, (m) => m.toUpperCase())
  return best.text
}

/** The brand part of a page title: "Kalosa Aesthetics | Cosmetic Surgery in Gurgaon" -> "Kalosa Aesthetics". */
export function titleBrand(title: string | null | undefined): string | null {
  const first = (title ?? '').split(/\s*[|–—:·]\s*|\s+-\s+/)[0]?.trim()
  return first && first.length >= 2 && first.length <= 60 ? first : null
}

export interface BrandContext {
  host: string
  /** Page titles from the crawl (seed first). */
  titles: string[]
  /** Page text from the crawl. */
  bodies: string[]
}

/**
 * Pick the name to show customers.
 * Order: the name read from the site's metadata, then what the model extracted,
 * then the seed page's title. A domain-looking candidate is repaired from the
 * page text when possible, and skipped otherwise.
 */
export function chooseBrandName(
  candidates: Array<string | null | undefined>,
  ctx: BrandContext,
): string | null {
  const list = [...candidates, titleBrand(ctx.titles[0])].map((c) => (c ?? '').trim()).filter(Boolean)
  const corpus = [...ctx.titles, ...ctx.bodies]
  for (const c of list) {
    if (!isDomainLikeName(c, ctx.host)) return c
    const fixed = recoverSpacedName(c, corpus) ?? recoverSpacedName(hostStem(ctx.host), corpus)
    if (fixed) return fixed
  }
  return list[0] ?? null
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Replace the web-address spelling of the business in free text with its name. */
export function replaceDomainSpelling(text: string | null | undefined, brand: string | null, host: string): string | null {
  if (text == null) return null
  const stem = hostStem(host)
  if (!brand || squash(stem).length < 4) return text
  const b = brand.trim()
  if (!b) return text
  // Whole address forms first (www.x.com, x.com), then the bare stem. The bare
  // stem must not sit inside a longer word, and an already-correct brand is left.
  const full = new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?${escapeRe(stem)}(?:\\.[a-z]{2,}){1,2}(?:\\/[^\\s]*)?`, 'gi')
  const bare = new RegExp(`(^|[^A-Za-z0-9])${escapeRe(stem)}(?![A-Za-z0-9])`, 'gi')
  // "Kalosa Aesthetics" has a space, so the bare stem never matches inside an
  // already-correct brand name and nothing is replaced twice.
  return text.replace(full, b).replace(bare, (_m, before: string) => `${before}${b}`)
}

export interface DraftFacts {
  business_name: string | null
  what_they_do?: string | null
  greeting: string | null
  suggested_questions: string[]
}

export interface DraftBrand {
  name: string | null
}

/**
 * Apply the brand-name rules to a draft. Returns new objects; inputs are not changed.
 */
export function normaliseDraft<F extends DraftFacts, B extends DraftBrand>(
  facts: F,
  brand: B,
  persona: string,
  ctx: BrandContext,
): { facts: F; brand: B; persona: string } {
  const name = chooseBrandName([brand.name, facts.business_name], ctx)
  const fix = (s: string | null | undefined) => replaceDomainSpelling(s, name, ctx.host)
  return {
    brand: { ...brand, name: name ?? brand.name },
    facts: {
      ...facts,
      business_name: name ?? facts.business_name,
      greeting: fix(facts.greeting),
      suggested_questions: (facts.suggested_questions ?? []).map((q) => fix(q) ?? q),
    },
    persona: fix(persona) ?? persona,
  }
}
