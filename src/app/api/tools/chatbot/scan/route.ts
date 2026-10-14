// POST { url } → reads the website and returns a drafted chatbot profile plus
// a signed session the chat endpoint will accept. Public and unauthenticated
// (it is a free tool), so it is rate-limited per visitor and the crawler
// refuses private addresses.

import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { crawlSite, normaliseUrl, validatePublicUrl } from '@/lib/agent/rag/site-crawler'
import { toChunks } from '@/lib/tools/chatbot/knowledge'
import { buildProfile } from '@/lib/tools/chatbot/profile'
import { signSession } from '@/lib/tools/chatbot/session'
import { factsToText } from '@/lib/agent/rag/site-facts'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const limit = checkRateLimit(`chatbot:scan:${ip}`, { limit: 5, windowMs: 10 * 60_000 })
  if (!limit.success) return rateLimitResponse(limit)

  const body = await req.json().catch(() => ({}))
  const input = typeof body?.url === 'string' ? body.url.trim().slice(0, 300) : ''
  if (!input) return NextResponse.json({ error: 'Enter your website address.' }, { status: 400 })

  let url: string
  try {
    url = normaliseUrl(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  } catch {
    return NextResponse.json({ error: 'That does not look like a website address.' }, { status: 400 })
  }
  const check = validatePublicUrl(url)
  if (!check.ok) return NextResponse.json({ error: 'Enter a public website address.' }, { status: 400 })

  const crawl = await crawlSite(url, {
    maxPages: 16,
    maxDepth: 1,
    totalBudgetMs: 30_000,
    perRequestMs: 7_000,
    concurrency: 5,
    preferKeyPages: true,
  })
  const chunks = toChunks(crawl.pages)
  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "We couldn't read text from that website. It may block bots or load everything with JavaScript." },
      { status: 422 },
    )
  }

  const host = new URL(url).hostname.replace(/^www\./, '')
  const profile = buildProfile(crawl.brand, crawl.pages, url)
  return NextResponse.json({
    site: host,
    profile,
    pages: crawl.pages.length,
    facts: crawl.facts ? factsToText(crawl.facts) : '',
    session: signSession({ site: host, chunks, facts: crawl.facts ? factsToText(crawl.facts) : '' }),
  })
}
