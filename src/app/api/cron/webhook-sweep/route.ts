// src/app/api/cron/webhook-sweep/route.ts
//
// Drains due retries — rows in webhook_deliveries with status
// 'pending' and next_attempt_at in the past. The immediate attempt in
// emitWebhookEvent() handles the common case (receiver is up); this
// exists for the rows that failed that first try and are waiting out
// their backoff.
//
// NOT in vercel.json — same reasoning as /api/cron/broadcast-sweep:
// the plan already uses its daily cron slots, and retries need to run
// every minute or two, not once a day. Drive it from an external
// pinger:
//
//   GET https://<host>/api/cron/webhook-sweep
//   Authorization: Bearer <CRON_SECRET>

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { verifyCron } from '@/lib/cron/auth'
import { attemptDelivery } from '@/lib/webhooks/deliver'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TIME_BUDGET_MS = 45_000
const BATCH_SIZE = 20

export async function GET(request: Request) {
  const startedAt = Date.now()

  const auth = verifyCron(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const admin = supabaseAdmin()
  let attempted = 0
  let succeeded = 0

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const { data: due, error } = await admin
      .from('webhook_deliveries')
      .select('id')
      .eq('status', 'pending')
      .lte('next_attempt_at', new Date().toISOString())
      .order('next_attempt_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (error) {
      console.error('[webhook-sweep] could not list due deliveries:', error.message)
      break
    }
    if (!due || due.length === 0) break

    await Promise.all(
      due.map(async (row: { id: string }) => {
        attempted++
        await attemptDelivery(row.id)
        const { data: after } = await admin
          .from('webhook_deliveries')
          .select('status')
          .eq('id', row.id)
          .single()
        if (after?.status === 'succeeded') succeeded++
      }),
    )

    if (due.length < BATCH_SIZE) break
  }

  return NextResponse.json({ attempted, succeeded })
}
