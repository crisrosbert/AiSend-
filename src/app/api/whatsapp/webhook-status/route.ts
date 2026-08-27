// src/app/api/whatsapp/webhook-status/route.ts
//
// Is signature verification actually strict on this deployment right
// now?
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// WEBHOOK_SETUP_MODE exists so a first-time connection isn't blocked
// while META_APP_SECRET is still being confirmed — but it is meant to
// be temporary, and "temporary" env vars are exactly the kind that get
// left behind. Left on, this endpoint accepts a POST from anyone who
// knows the URL as if it were a real WhatsApp message: fake contacts,
// fake conversations, automations firing, model credits spent, replies
// sent to whoever the forged payload named.
//
// There was previously no way to check this without reading Vercel's
// env var list and cross-referencing it against webhook-signature.ts's
// logic by hand. This just answers the question.
//
// ── WHAT IT DELIBERATELY DOES NOT RETURN ─────────────────────────────
// Not the App Secret itself, not even whether it "looks right" — only
// whether it is present, and whether setup mode is currently allowing
// unsigned requests through.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Signed in only — same reasoning as /api/billing/status: not a
  // secret, but a description of this deployment's security posture,
  // which has no reason to be handed to an unauthenticated caller.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasSecret = !!process.env.META_APP_SECRET
  const setupMode = process.env.WEBHOOK_SETUP_MODE === 'true'

  return NextResponse.json({
    hasSecret,
    setupMode,
    // "strict" is the only state where a forged webhook POST is
    // actually rejected.
    status: !hasSecret
      ? 'unprotected'
      : setupMode
        ? 'setup_mode'
        : 'strict',

    diagnosis: !hasSecret
      ? 'META_APP_SECRET is not set. Every inbound webhook request is being accepted unverified, signed or not — this needs fixing before real traffic touches it.'
      : setupMode
        ? 'WEBHOOK_SETUP_MODE=true is set. Signature checks run and are logged, but a bad or missing signature is still let through. Watch the logs for "signature OK", then remove WEBHOOK_SETUP_MODE from Vercel — leaving it set means this endpoint accepts a forged request from anyone who has the URL.'
        : 'META_APP_SECRET is set and WEBHOOK_SETUP_MODE is not — signatures are enforced. A request with a missing or wrong signature is rejected.',
  })
}
