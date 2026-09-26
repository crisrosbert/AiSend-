// src/app/api/cron/fire-scheduled-broadcasts/route.ts
//
// Fires broadcasts whose scheduled_at has passed but haven't sent yet.
//
// ── WHAT IT DOES ─────────────────────────────────────────────────────
// Every N minutes (recommended: every 5-10 min via Vercel Cron or an
// external pinger), this route:
//   1. Finds all broadcasts with status='scheduled' and scheduled_at <= now
//   2. For each: calls /api/broadcasts/send to do the actual sending
//      (which owns rate-limiting, opt-out checks, credit deduction, etc.)
//   3. Updates status to 'sending' immediately to prevent double-firing
//
// ── HOW TO SCHEDULE ──────────────────────────────────────────────────
// Add to vercel.json (Pro plan, every 5 min):
//   { "crons": [{ "path": "/api/cron/fire-scheduled-broadcasts", "schedule": "*/5 * * * *" }] }
//
// Or external pinger every 5 min:
//   GET https://<host>/api/cron/fire-scheduled-broadcasts
//   Authorization: Bearer <CRON_SECRET>

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { verifyCron } from '@/lib/cron/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TIME_BUDGET_MS = 50_000

interface BroadcastRow {
  id: string
  user_id: string
  name: string
  template_name: string
  template_language: string
  template_variables: Record<string, unknown>
  audience_filter: Record<string, unknown>
  agent_type: string | null
  agent_id: string | null
  scheduled_at: string
}

export async function GET(request: Request) {
  const auth = verifyCron(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const startTime = Date.now()

  // Find all broadcasts due to fire
  const { data: dueBroadcasts, error: fetchError } = await supabaseAdmin
    .from('broadcasts')
    .select(
      'id, user_id, name, template_name, template_language, template_variables, audience_filter, agent_type, agent_id, scheduled_at',
    )
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(20) // Process at most 20 per sweep to stay within time budget

  if (fetchError) {
    console.error('[FireScheduled] Failed to fetch due broadcasts:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!dueBroadcasts || dueBroadcasts.length === 0) {
    return NextResponse.json({ fired: 0, message: 'No scheduled broadcasts due' })
  }

  console.log(`[FireScheduled] Found ${dueBroadcasts.length} broadcast(s) due to fire`)

  const results: { id: string; name: string; status: 'fired' | 'error' | 'skipped'; error?: string }[] = []

  for (const broadcast of dueBroadcasts as BroadcastRow[]) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      console.warn('[FireScheduled] Time budget exhausted — deferring remaining broadcasts')
      results.push({ id: broadcast.id, name: broadcast.name, status: 'skipped' })
      continue
    }

    // Mark as 'sending' immediately to prevent double-firing if this cron
    // runs again before the send completes
    const { error: lockError } = await supabaseAdmin
      .from('broadcasts')
      .update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', broadcast.id)
      .eq('status', 'scheduled') // Optimistic lock — only update if still 'scheduled'

    if (lockError) {
      console.error(`[FireScheduled] Could not lock broadcast ${broadcast.id}:`, lockError)
      results.push({ id: broadcast.id, name: broadcast.name, status: 'skipped', error: 'lock failed' })
      continue
    }

    // Reconstruct audience and template from stored wizard state
    const audienceFilter = broadcast.audience_filter ?? {}
    const template = (audienceFilter._template as Record<string, unknown>) ?? {
      name: broadcast.template_name,
      language: broadcast.template_language,
    }

    // Remove internal wizard meta-fields before passing audience to send API
    const { _template: _, _current_step: __, ...audience } = audienceFilter

    // Get the user's origin for internal API calls
    // We call /api/broadcasts/send as a server-to-server call using the admin client directly
    try {
      // Use the same send logic: call the send-broadcast API endpoint
      // We need to authenticate as the user, so we use admin client to get a service key
      // and then call the internal send function directly
      const sendRes = await fetch(
        `${getBaseUrl()}/api/broadcasts/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Pass cron secret so the send endpoint knows this is a trusted server call
            Authorization: `Bearer ${process.env.AUTOMATION_CRON_SECRET ?? process.env.CRON_SECRET ?? ''}`,
            // Pass the user_id so the send endpoint can authenticate
            'x-user-id': broadcast.user_id,
          },
          body: JSON.stringify({
            broadcastId: broadcast.id,
            userId: broadcast.user_id,
            template,
            audience,
            variables: broadcast.template_variables ?? {},
            agentType: broadcast.agent_type,
            agentId: broadcast.agent_id,
          }),
        },
      )

      if (!sendRes.ok) {
        let errMsg = `HTTP ${sendRes.status}`
        try {
          const body = await sendRes.json()
          errMsg = body.error ?? errMsg
        } catch { /* ignore */ }

        // Revert status to 'scheduled' so it can be retried
        await supabaseAdmin
          .from('broadcasts')
          .update({ status: 'scheduled', updated_at: new Date().toISOString() })
          .eq('id', broadcast.id)

        console.error(`[FireScheduled] Send failed for ${broadcast.id}: ${errMsg}`)
        results.push({ id: broadcast.id, name: broadcast.name, status: 'error', error: errMsg })
      } else {
        console.log(`[FireScheduled] Fired broadcast ${broadcast.id} (${broadcast.name})`)
        results.push({ id: broadcast.id, name: broadcast.name, status: 'fired' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      // Revert status so it will be retried
      await supabaseAdmin
        .from('broadcasts')
        .update({ status: 'scheduled', updated_at: new Date().toISOString() })
        .eq('id', broadcast.id)

      console.error(`[FireScheduled] Exception firing ${broadcast.id}:`, err)
      results.push({ id: broadcast.id, name: broadcast.name, status: 'error', error: msg })
    }
  }

  const fired = results.filter((r) => r.status === 'fired').length
  const errors = results.filter((r) => r.status === 'error').length

  return NextResponse.json({
    fired,
    errors,
    skipped: results.filter((r) => r.status === 'skipped').length,
    results,
    elapsed_ms: Date.now() - startTime,
  })
}

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  return 'http://localhost:3000'
}
