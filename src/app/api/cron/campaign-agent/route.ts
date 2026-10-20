// GET /api/cron/campaign-agent — advances every running Campaign Agent campaign.
// Drive it from the same pinger as /api/cron/broadcast-sweep (every 5-10 min),
// with `Authorization: Bearer <CRON_SECRET>`. Run it just BEFORE the sweep so a
// step it queues is sent in the sweep that follows.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { verifyCron } from '@/lib/cron/auth'
import { tick } from '@/lib/campaign-agent/scheduler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const auth = verifyCron(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const report = await tick(supabaseAdmin())
  return NextResponse.json(report)
}
