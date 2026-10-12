// POST { session, profile, messages } → the chatbot's next reply, grounded in
// the scanned website. Falls back to quoting the best passage when no AI key is
// configured, so the demo still works.

import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { callLLM, hasProviderKey, type LLMTurn } from '@/lib/agent/llm-provider'
import { extractiveAnswer, topChunks } from '@/lib/tools/chatbot/knowledge'
import { buildSystemPrompt } from '@/lib/tools/chatbot/prompt'
import { buildProfile, cleanText, sanitizeProfile } from '@/lib/tools/chatbot/profile'
import { verifySession } from '@/lib/tools/chatbot/session'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_QUESTION = 400
const MAX_HISTORY = 6

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const limit = checkRateLimit(`chatbot:chat:${ip}`, { limit: 20, windowMs: 10 * 60_000 })
  if (!limit.success) return rateLimitResponse(limit)

  const body = await req.json().catch(() => ({}))
  const session = verifySession(body?.session)
  if (!session) {
    return NextResponse.json({ error: 'This preview expired. Scan your website again.' }, { status: 401 })
  }

  const history: Array<{ role: 'user' | 'model'; text: string }> = (Array.isArray(body?.messages) ? body.messages : [])
    .slice(-MAX_HISTORY)
    .map((m: { role?: string; text?: unknown }) => ({
      role: m?.role === 'user' ? ('user' as const) : ('model' as const),
      text: cleanText(m?.text, MAX_QUESTION),
    }))
    .filter((m: { text: string }) => m.text)
  const question = history.length && history[history.length - 1].role === 'user' ? history[history.length - 1].text : ''
  if (!question) return NextResponse.json({ error: 'Type a question first.' }, { status: 400 })

  const profile = sanitizeProfile(body?.profile, buildProfile({ name: session.site, logoUrl: null, description: null, themeColor: null }, [], `https://${session.site}`))
  const context = topChunks(session.chunks, `${history.slice(-3).map((m) => m.text).join(' ')}`, 4)

  let reply = ''
  if (hasProviderKey()) {
    try {
      const turns: LLMTurn[] = history.map((m) => ({ role: m.role, text: m.text }))
      const res = await callLLM(buildSystemPrompt(profile, session.site, context), turns, [])
      reply = res.text.trim().slice(0, 900)
    } catch {
      reply = ''
    }
  }
  if (!reply) reply = extractiveAnswer(context, question)

  return NextResponse.json({ reply })
}
