// src/app/api/ai/respond/route.ts
//
// Drafts a reply for a human agent to review in the inbox, and answers
// the Chat Flows canvas preview.
//
// ── WHY THIS ROUTE NOW CHECKS WHO IS ASKING ──────────────────────────
// It did not. Any mutating route without an auth check is a problem;
// one that forwards straight to a paid model API on our key is a
// standing invitation — an unauthenticated LLM proxy gets found and
// used as free inference, and the first sign is the bill.
//
// ── AND WHY IT NO LONGER TALKS TO A PROVIDER DIRECTLY ────────────────
// It called Gemini's REST endpoint by hand while the rest of the app
// went through llm-provider. So switching the platform to OpenAI would
// have left this one route quietly still on Gemini, needing a key
// nobody intended to keep paying for. It goes through callLLM() now,
// which means it follows LLM_PROVIDER like everything else.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM, hasProviderKey, activeProvider } from '@/lib/agent/llm-provider'

export const dynamic = 'force-dynamic'

/** Long enough for real context, short enough to bound the cost. */
const MAX_PROMPT = 4_000

export async function POST(req: Request) {
  try {
    // ── Who is asking ──
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasProviderKey()) {
      console.error(`[ai/respond] no API key for provider "${activeProvider()}"`)
      return NextResponse.json(
        { error: 'AI drafting is not configured.' },
        { status: 503 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const raw = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!raw) {
      return NextResponse.json({ error: 'A prompt is required.' }, { status: 400 })
    }

    // Truncated rather than rejected: a long paste should still get an
    // answer, and the caller cannot always know the limit in advance.
    const prompt = raw.slice(0, MAX_PROMPT)

    const systemPrompt =
      'You are helping a human support agent reply to a customer on WhatsApp. ' +
      'Write the reply itself — no preamble, no "here is a draft", no quotation ' +
      'marks around it. Keep it to one to three sentences, warm and plain. ' +
      'Never invent prices, dates, stock or policies: if the information is not ' +
      'in what you were given, ask the customer for what is missing instead.'

    const result = await callLLM(
      systemPrompt,
      [{ role: 'user', text: prompt }],
      // No tools: this drafts text for a human to read and send. Giving
      // it booking or payment tools would let a suggestion take a real
      // action before anybody had approved the wording.
      [],
    )

    const reply = result.text.trim()
    if (!reply) {
      return NextResponse.json(
        { error: 'The model returned nothing. Try rephrasing.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('[ai/respond] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not draft a reply.' },
      { status: 500 },
    )
  }
}
