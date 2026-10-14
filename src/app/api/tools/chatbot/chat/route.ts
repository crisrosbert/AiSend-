// POST { session, profile, messages } → the chatbot's next reply, grounded in
// the scanned website. Falls back to quoting the best passage when no AI key is
// configured, so the demo still works.

import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { callLLM, hasProviderKey, type LLMTurn } from '@/lib/agent/llm-provider'
import { BOOKING_TOOLS, bookingContext, resolveHours, runTool, safeTimezone, type LeadCard } from '@/lib/tools/chatbot/booking'
import { extractiveAnswer, orderChunks, topChunks, withinBudget } from '@/lib/tools/chatbot/knowledge'
import { buildSystemPrompt } from '@/lib/tools/chatbot/prompt'
import { buildProfile, cleanText, sanitizeProfile } from '@/lib/tools/chatbot/profile'
import { verifySession } from '@/lib/tools/chatbot/session'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_QUESTION = 400
const MAX_HISTORY = 10

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
  const query = history.slice(-3).map((m) => m.text).join(' ')
  // The whole site goes in, best passages first, so nothing a keyword match
  // would miss is left out. Only a very large site loses its least relevant text.
  const context = withinBudget(orderChunks(session.chunks, query))
  const quoteFrom = topChunks(session.chunks, query, 3)

  // Booking: same opening-hours logic as the paid agent, nothing stored.
  const toolCtx = { hours: resolveHours(session.facts ?? '', session.chunks, safeTimezone(body?.tz)), now: new Date() }
  const system = buildSystemPrompt(profile, session.site, context, session.facts ?? '', bookingContext(toolCtx))

  let reply = ''
  let card: LeadCard | undefined
  if (hasProviderKey()) {
    try {
      let turns: LLMTurn[] = history.map((m) => ({ role: m.role, text: m.text }))
      for (let i = 0; i < 3; i++) {
        const res = await callLLM(system, turns, BOOKING_TOOLS, {
          // Free-tool model: set TOOLS_CHATBOT_MODEL to give the demo a stronger model than the default.
          model: process.env.TOOLS_CHATBOT_MODEL || undefined,
        })
        if (res.toolCall) {
          const out = runTool(res.toolCall.name, res.toolCall.args, toolCtx)
          if (out.card) card = out.card
          turns = [
            ...turns,
            { role: 'model', toolCall: res.toolCall },
            { role: 'tool', toolResult: { name: res.toolCall.name, result: out.result } },
          ]
          continue
        }
        reply = res.text.trim().slice(0, 1200)
        break
      }
    } catch {
      reply = ''
    }
  }
  if (!reply && card) {
    reply = card.kind === 'appointment' ? `Done. Your request for ${card.when ?? 'that time'} has been noted and the team will confirm it.` : 'Done. Your request has been noted and the team will contact you.'
  }
  if (!reply) reply = session.facts && /contact|phone|call|email|address|reach|whatsapp|timing|hours/i.test(question) ? session.facts.split('\n').filter((l) => /^(Phone|WhatsApp|Email|Address|Opening hours):/.test(l)).join('\n') || extractiveAnswer(quoteFrom, question) : extractiveAnswer(quoteFrom, question)

  return NextResponse.json({ reply, card })
}
