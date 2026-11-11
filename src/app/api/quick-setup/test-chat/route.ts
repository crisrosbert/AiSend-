// src/app/api/quick-setup/test-chat/route.ts
//
// The "Try it" box. Runs the owner's DRAFT setup through the same prompt
// builders and the same model call as the live agent, with tools
// simulated (see lib/quick-setup/dry-run.ts).
//
// It does NOT: send anything on WhatsApp, create a conversation, contact,
// lead or booking row, charge wallet credits, or write a usage log. It
// does not even read or write the database apart from checking who you are.
//
// Body:    { prompt, facts?, history?, message }
// Returns: { reply, events, handoff, emergency, language, error? }
//
// Privacy: neither the draft nor the test messages are logged.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasProviderKey } from '@/lib/agent/llm-provider'
import { parseBusinessHours } from '@/lib/agent/business-hours'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { cleanHistory, runDryRunTurn } from '@/lib/quick-setup/dry-run'
import { extractFactsHeuristic, factsToBusinessHours, groundFacts, mergeFacts, parseExtractedFacts } from '@/lib/quick-setup/facts'
import { MAX_TEST_MESSAGE_CHARS, QUICK_SETUP_RATE_LIMITS } from '@/lib/quick-setup/limits'
import { buildQuickSetupPersona, industryForKind, validateSetupPrompt } from '@/lib/quick-setup/prompt'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BODY_BYTES = 40_000

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkRateLimit(`quick-setup:test:${user.id}`, QUICK_SETUP_RATE_LIMITS.testChat)
    if (!rl.success) return rateLimitResponse(rl)

    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'That request is too large.' }, { status: 413 })
    }
    if (!hasProviderKey()) {
      return NextResponse.json({ error: 'The test chat is not available right now (AI is not configured).' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const check = validateSetupPrompt(body?.prompt)
    if (!check.ok) return NextResponse.json({ error: check.message, code: check.code }, { status: 400 })

    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message) return NextResponse.json({ error: 'Type a test message first.' }, { status: 400 })
    if (message.length > MAX_TEST_MESSAGE_CHARS) {
      return NextResponse.json({ error: `Please keep a test message under ${MAX_TEST_MESSAGE_CHARS} characters.` }, { status: 400 })
    }

    // Facts: what the browser confirmed, checked again here. Anything that
    // does not validate or is not in the owner's text is dropped, and the
    // simple rules fill the gaps, exactly like the Save route does.
    const sent = parseExtractedFacts(body?.facts)
    const facts = groundFacts(mergeFacts(sent.facts, extractFactsHeuristic(check.text)), check.text)

    const persona = buildQuickSetupPersona({ ownerText: check.text, facts })
    const result = await runDryRunTurn({
      persona,
      hours: parseBusinessHours(factsToBusinessHours(facts)),
      industry: industryForKind(facts.business_kind),
      fallbackContact: facts.phone,
      history: cleanHistory(body?.history),
      message,
    })

    return NextResponse.json({
      reply: result.reply,
      events: result.events,
      handoff: result.handoff,
      emergency: result.emergency,
      language: result.language,
      ...(result.error ? { error: 'The assistant could not answer just now. Please try again.' } : {}),
    })
  } catch {
    console.error('[quick-setup/test-chat] failed')
    return NextResponse.json({ error: 'Could not run the test. Please try again.' }, { status: 500 })
  }
}
