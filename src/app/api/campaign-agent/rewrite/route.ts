// POST { body, instruction? } → the same message, rewritten by AI and checked.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { hasProviderKey } from '@/lib/agent/llm-provider'
import { getAccess } from '@/lib/campaign-agent/access'
import { rewriteMessage } from '@/lib/campaign-agent/rewrite'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getAccess(supabaseAdmin(), user.id)
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: 403 })

  const limit = checkRateLimit(`campaign:rewrite:${user.id}`, { limit: 30, windowMs: 10 * 60_000 })
  if (!limit.success) return rateLimitResponse(limit)

  const b = await request.json().catch(() => ({}))
  const body = typeof b?.body === 'string' ? b.body.trim().slice(0, 1000) : ''
  const instruction = typeof b?.instruction === 'string' ? b.instruction.trim().slice(0, 200) : undefined
  if (body.length < 10) return NextResponse.json({ error: 'Write the message first.' }, { status: 400 })
  if (!hasProviderKey()) return NextResponse.json({ error: 'AI is not set up on this server.' }, { status: 503 })

  const out = await rewriteMessage({ body, instruction })
  if (!out) return NextResponse.json({ error: 'Could not write a better version this time. Try again.' }, { status: 422 })
  return NextResponse.json({ body: out })
}
