// src/lib/agent/rag/site-facts.ts
//
// Pulls the hard facts a visitor asks for (phone, email, address, hours,
// WhatsApp, socials, the site menu) out of the RAW html of a page.
//
// Why this exists: htmlToText() deliberately drops <nav>, <header> and
// <footer> so menus are not indexed a dozen times. But that is exactly where
// most sites keep their phone number, address and the list of services. A
// bot built from the stripped text answers "How can I contact you?" with
// "I'm not sure". Facts are extracted separately, from the raw html, and
// handed to the model as a short, always-present block.

export interface SiteFacts {
  name: string | null
  phones: string[]
  emails: string[]
  whatsapp: string[]
  social: string[]
  address: string | null
  hours: string | null
  menu: string[]
  footer: string | null
}

export const EMPTY_FACTS: SiteFacts = {
  name: null,
  phones: [],
  emails: [],
  whatsapp: [],
  social: [],
  address: null,
  hours: null,
  menu: [],
  footer: null,
}

const CAPS = { phones: 4, emails: 4, whatsapp: 3, social: 6, menu: 30 }

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function stripTags(html: string): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|br|address)\s*>/gi, ' · ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*·\s*){2,}/g, ' · ')
    .replace(/^[\s·]+|[\s·]+$/g, '')
    .trim()
}

function uniq(list: string[], cap: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of list) {
    const k = v.toLowerCase().replace(/[^a-z0-9@+.]/g, '')
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(v)
    if (out.length >= cap) break
  }
  return out
}

const digits = (s: string) => s.replace(/\D/g, '')
const plausiblePhone = (s: string) => {
  const n = digits(s).length
  return n >= 8 && n <= 15
}

/** Walk any JSON-LD value and yield every object in it. */
function* walk(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n)
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    yield obj
    for (const v of Object.values(obj)) if (v && typeof v === 'object') yield* walk(v)
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

function formatAddress(a: unknown): string | null {
  if (typeof a === 'string') return str(a)
  if (!a || typeof a !== 'object') return null
  const o = a as Record<string, unknown>
  const country = typeof o.addressCountry === 'object' && o.addressCountry
    ? str((o.addressCountry as Record<string, unknown>).name)
    : str(o.addressCountry)
  const parts = [o.streetAddress, o.addressLocality, o.addressRegion, o.postalCode, country]
    .map(str)
    .filter((x): x is string => !!x)
  return parts.length ? parts.join(', ') : null
}

const DAY_CODES: Record<string, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday',
}

/** schema.org writes "Mo-Sa 10:00-19:00". Spell the days out so they read (and parse) as words. */
function expandDayCodes(s: string): string {
  return s.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (c) => DAY_CODES[c])
}

function formatHours(o: Record<string, unknown>): string | null {
  const plain = o.openingHours
  if (typeof plain === 'string') return expandDayCodes(plain)
  if (Array.isArray(plain) && plain.every((p) => typeof p === 'string') && plain.length) {
    return expandDayCodes((plain as string[]).join('; '))
  }
  const spec = o.openingHoursSpecification
  const list = Array.isArray(spec) ? spec : spec ? [spec] : []
  const lines: string[] = []
  for (const s of list) {
    if (!s || typeof s !== 'object') continue
    const r = s as Record<string, unknown>
    const days = Array.isArray(r.dayOfWeek) ? r.dayOfWeek : [r.dayOfWeek]
    const d = days
      .map((x) => (typeof x === 'string' ? x.replace(/^https?:\/\/schema\.org\//, '') : ''))
      .filter(Boolean)
      .join(', ')
    const opens = str(r.opens)
    const closes = str(r.closes)
    if (d && opens && closes) lines.push(`${d} ${opens}-${closes}`)
  }
  return lines.length ? lines.join('; ') : null
}

export function extractFacts(html: string): SiteFacts {
  const f: SiteFacts = { ...EMPTY_FACTS, phones: [], emails: [], whatsapp: [], social: [], menu: [] }

  // tel: / mailto: / WhatsApp / social links
  for (const m of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const href = decode(m[1].trim())
    if (/^tel:/i.test(href)) {
      const v = decodeURIComponent(href.slice(4)).trim()
      if (plausiblePhone(v)) f.phones.push(v)
    } else if (/^mailto:/i.test(href)) {
      const v = decodeURIComponent(href.slice(7).split('?')[0]).trim()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) f.emails.push(v)
    } else {
      const wa = href.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:[^#]*&)?phone=|web\.whatsapp\.com\/send\?phone=)(\+?\d{8,15})/i)
      if (wa) f.whatsapp.push(wa[1])
      else if (
        /^https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|linkedin\.com|youtube\.com|x\.com|twitter\.com|t\.me)\/[^/?#]+/i.test(href) &&
        !/(sharer|share\?|intent\/|\/share\/|plugins)/i.test(href)
      ) {
        f.social.push(href.replace(/[?#].*$/, '').replace(/\/$/, ''))
      }
    }
  }

  // JSON-LD: the most reliable source, written for machines.
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try {
      data = JSON.parse(m[1])
    } catch {
      continue
    }
    for (const o of walk(data)) {
      const tel = str(o.telephone)
      if (tel && plausiblePhone(tel)) f.phones.unshift(tel)
      const mail = str(o.email)
      if (mail) f.emails.unshift(mail.replace(/^mailto:/i, ''))
      f.address ??= formatAddress(o.address)
      f.hours ??= formatHours(o)
      const type = String(o['@type'] ?? '')
      if (!f.name && /Organization|Business|Store|Physician|Clinic|Restaurant|Hospital|Dentist|Salon/i.test(type)) {
        f.name = str(o.name)
      }
      const same = o.sameAs
      for (const s of Array.isArray(same) ? same : same ? [same] : []) {
        if (typeof s === 'string' && /^https?:\/\//.test(s)) f.social.push(s.replace(/\/$/, ''))
      }
    }
  }

  // <address> tag as a fallback for the postal address.
  if (!f.address) {
    const a = html.match(/<address[^>]*>([\s\S]*?)<\/address>/i)
    if (a) {
      const t = stripTags(a[1])
      if (t.length >= 10 && t.length <= 300) f.address = t
    }
  }

  // Site menu: link labels inside <nav> — usually the service / product list.
  const menu: string[] = []
  for (const nav of html.matchAll(/<nav[\s\S]*?<\/nav>/gi)) {
    for (const a of nav[0].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
      const t = stripTags(a[1])
      if (t.length >= 2 && t.length <= 40 && !/^(home|menu|skip|close|search|login|log in|sign in|cart)$/i.test(t)) menu.push(t)
    }
  }
  f.menu = uniq(menu, CAPS.menu)

  // Footer text, also catches a phone / email that is plain text, not a link.
  const footers = [...html.matchAll(/<footer[\s\S]*?<\/footer>/gi)]
  if (footers.length) {
    const text = stripTags(footers[footers.length - 1][0])
    if (text) f.footer = text.slice(0, 700)
    for (const m of text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) f.emails.push(m[0])
    for (const m of text.matchAll(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{4,6}/g)) {
      if (/^\s*\d{4}\s*$/.test(m[0])) continue
      const n = digits(m[0]).length
      if (n >= 9 && n <= 13) f.phones.push(m[0].trim())
    }
  }

  f.phones = uniq(f.phones.map((p) => p.replace(/\s+/g, ' ')), CAPS.phones)
  f.emails = uniq(f.emails, CAPS.emails)
  f.whatsapp = uniq(f.whatsapp, CAPS.whatsapp)
  f.social = uniq(f.social, CAPS.social)
  return f
}

export function mergeFacts(a: SiteFacts, b: SiteFacts): SiteFacts {
  return {
    name: a.name ?? b.name,
    phones: uniq([...a.phones, ...b.phones], CAPS.phones),
    emails: uniq([...a.emails, ...b.emails], CAPS.emails),
    whatsapp: uniq([...a.whatsapp, ...b.whatsapp], CAPS.whatsapp),
    social: uniq([...a.social, ...b.social], CAPS.social),
    address: a.address ?? b.address,
    hours: a.hours ?? b.hours,
    menu: uniq([...a.menu, ...b.menu], CAPS.menu),
    footer: a.footer ?? b.footer,
  }
}

/** The always-present block handed to the model. Empty string if nothing found. */
export function factsToText(f: SiteFacts): string {
  const lines: string[] = []
  if (f.name) lines.push(`Business name: ${f.name}`)
  if (f.phones.length) lines.push(`Phone: ${f.phones.join(', ')}`)
  if (f.whatsapp.length) lines.push(`WhatsApp: ${f.whatsapp.map((n) => (n.startsWith('+') ? n : `+${n}`)).join(', ')}`)
  if (f.emails.length) lines.push(`Email: ${f.emails.join(', ')}`)
  if (f.address) lines.push(`Address: ${f.address}`)
  if (f.hours) lines.push(`Opening hours: ${f.hours}`)
  if (f.social.length) lines.push(`Social: ${f.social.join(', ')}`)
  if (f.menu.length) lines.push(`Website menu: ${f.menu.join(' | ')}`)
  if (f.footer) lines.push(`Footer text: ${f.footer}`)
  return lines.join('\n')
}
