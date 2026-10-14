// POST { session, profile, listed? } → { url }. Saves the scan so it can be
// opened later by link. The session signature proves the content came from a
// real scan, so nobody can publish arbitrary knowledge through this.

import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { verifySession } from '@/lib/tools/chatbot/session'
import { buildProfile, sanitizeProfile } from '@/lib/tools/chatbot/profile'
import { createShare } from '@/lib/tools/chatbot/shares'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const limit = checkRateLimit(`chatbot:share:${ip}`, { limit: 8, windowMs: 10 * 60_000 })
  if (!limit.success) return rateLimitResponse(limit)

  const body = await req.json().catch(() => ({}))
  const session = verifySession(body?.session)
  if (!session) return NextResponse.json({ error: 'Your session expired. Scan the website again.' }, { status: 401 })

  const fallback = buildProfile({ name: null, logoUrl: null, description: null, themeColor: null }, [], `https://${session.site}`)
  const profile = sanitizeProfile(body?.profile, fallback)
  // The logo comes from the scan, which the browser echoes back; keep only https.
  const logo = typeof body?.profile?.logoUrl === 'string' && /^https:\/\//i.test(body.profile.logoUrl) ? body.profile.logoUrl.slice(0, 500) : null
  profile.logoUrl = logo

  const id = await createShare({
    host: session.site,
    profile,
    chunks: session.chunks,
    facts: session.facts ?? '',
    listed: body?.listed === true,
  })
  if (!id) return NextResponse.json({ error: 'Sharing is not available right now.' }, { status: 503 })
  const origin = new URL(req.url).origin
  return NextResponse.json({ id, url: `${origin}/tools/ai-chatbot-widget/demo/${id}` })
}
