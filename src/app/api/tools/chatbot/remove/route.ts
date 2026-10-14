// POST { site, contact, note } → hides the brand from the wall and disables
// its demo links straight away. Logged in tool_removal_requests for review.

import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { cleanHost, removeHost } from '@/lib/tools/chatbot/shares'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const limit = checkRateLimit(`chatbot:remove:${ip}`, { limit: 6, windowMs: 10 * 60_000 })
  if (!limit.success) return rateLimitResponse(limit)

  const body = await req.json().catch(() => ({}))
  const host = cleanHost(body?.site)
  if (!host) return NextResponse.json({ error: 'Enter the website address, like example.com.' }, { status: 400 })
  const contact = typeof body?.contact === 'string' ? body.contact : ''
  const note = typeof body?.note === 'string' ? body.note : ''
  const ok = await removeHost(host, contact, note)
  if (!ok) return NextResponse.json({ error: 'Could not process this right now. Please email us.' }, { status: 503 })
  return NextResponse.json({ ok: true })
}
