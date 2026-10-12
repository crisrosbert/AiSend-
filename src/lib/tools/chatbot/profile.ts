// Draws up the chatbot's name, role, greeting and suggested questions from
// what the crawl found. No AI call: it is deterministic, instant and free,
// and the visitor can edit every field afterwards.

import type { SiteBrand } from '@/lib/agent/rag/site-crawler'

export type Tone = 'friendly' | 'professional' | 'casual'
export const TONES: readonly Tone[] = ['friendly', 'professional', 'casual']

export interface BotProfile {
  name: string
  role: string
  tone: Tone
  greeting: string
  suggestions: string[]
  color: string
  logoUrl: string | null
}

const HEX = /^#[0-9a-fA-F]{6}$/
export const DEFAULT_COLOR = '#1B6B4A'

export function hostLabel(siteUrl: string): string {
  try {
    const h = new URL(siteUrl).hostname.replace(/^www\./, '')
    const base = h.split('.')[0] ?? h
    return base.charAt(0).toUpperCase() + base.slice(1)
  } catch {
    return 'Your business'
  }
}

export function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

export function buildProfile(
  brand: SiteBrand,
  pages: ReadonlyArray<{ url: string; title: string }>,
  siteUrl: string,
): BotProfile {
  const name = cleanText(brand.name, 40) || hostLabel(siteUrl)
  const text = pages.map((p) => `${p.url} ${p.title}`).join(' ').toLowerCase()
  const has = (re: RegExp) => re.test(text)

  const suggestions = [`What does ${name} offer?`]
  if (has(/pric|plan|cost|fee/)) suggestions.push('What are your prices?')
  if (has(/shop|product|store|catalog/)) suggestions.push('Which products do you sell?')
  else if (has(/service|solution/)) suggestions.push('What services do you provide?')
  if (has(/ship|deliver|return|refund/)) suggestions.push('What is your return and delivery policy?')
  if (has(/book|appointment|demo|consult/)) suggestions.push('How can I book an appointment?')
  suggestions.push(`How can I contact ${name}?`)

  return {
    name: `${name} AI Assistant`,
    role: `Website assistant that answers visitor questions about ${name}`,
    tone: 'friendly',
    greeting: `Hello! How can I help you with ${name} today?`,
    suggestions: [...new Set(suggestions)].slice(0, 4),
    color: brand.themeColor && HEX.test(brand.themeColor) ? brand.themeColor : DEFAULT_COLOR,
    logoUrl: brand.logoUrl && /^https:\/\//i.test(brand.logoUrl) ? brand.logoUrl : null,
  }
}

/** Accepts whatever the browser sends back and returns a safe profile. */
export function sanitizeProfile(raw: unknown, fallback: BotProfile): BotProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const sugg = Array.isArray(r.suggestions)
    ? r.suggestions.map((s) => cleanText(s, 80)).filter(Boolean).slice(0, 4)
    : fallback.suggestions
  return {
    name: cleanText(r.name, 40) || fallback.name,
    role: cleanText(r.role, 120) || fallback.role,
    tone: TONES.includes(r.tone as Tone) ? (r.tone as Tone) : fallback.tone,
    greeting: cleanText(r.greeting, 160) || fallback.greeting,
    suggestions: sugg.length ? sugg : fallback.suggestions,
    color: typeof r.color === 'string' && HEX.test(r.color) ? r.color : fallback.color,
    logoUrl: fallback.logoUrl,
  }
}
