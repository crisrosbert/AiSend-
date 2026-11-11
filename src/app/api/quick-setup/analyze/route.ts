// src/app/api/quick-setup/analyze/route.ts
//
// "Check my setup": reads the owner's text and returns the facts it found
// (fees, timings, address link, phone, what to ask) so the owner can
// confirm them before anything is saved.
//
// Writes NOTHING. Sends nothing to WhatsApp. Costs one small model call
// (or none, when the model is not configured: simple rules are used).
//
// Body:    { prompt }
// Returns: { facts, summary, warnings, source }
//
// Privacy: the owner's text is never logged.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callLLM, hasProviderKey } from '@/lib/agent/llm-provider'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { analyzeSetupText } from '@/lib/quick-setup/analyze'
import { summarizeFacts } from '@/lib/quick-setup/facts'
import { QUICK_SETUP_RATE_LIMITS } from '@/lib/quick-setup/limits'
import { validateSetupPrompt } from '@/lib/quick-setup/prompt'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** A setup text is at most 1,500 characters; anything this big is not a real request. */
const MAX_BODY_BYTES = 20_000

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = checkRateLimit(`quick-setup:analyze:${user.id}`, QUICK_SETUP_RATE_LIMITS.analyze)
    if (!rl.success) return rateLimitResponse(rl)

    if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'That request is too large.' }, { status: 413 })
    }
    const body = await req.json().catch(() => ({}))

    const check = validateSetupPrompt(body?.prompt)
    if (!check.ok) return NextResponse.json({ error: check.message, code: check.code }, { status: 400 })

    const result = await analyzeSetupText(
      check.text,
      hasProviderKey() ? (system, turns, tools) => callLLM(system, turns, tools) : null,
    )

    return NextResponse.json({
      facts: result.facts,
      summary: summarizeFacts(result.facts),
      warnings: result.warnings,
      source: result.source,
    })
  } catch {
    // No details in the log line: the request held the owner's text.
    console.error('[quick-setup/analyze] failed')
    return NextResponse.json({ error: 'Could not check your setup. Please try again.' }, { status: 500 })
  }
}
