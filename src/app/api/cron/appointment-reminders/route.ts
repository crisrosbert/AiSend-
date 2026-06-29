// src/app/api/cron/appointment-reminders/route.ts
//
// Scheduled job — sends WhatsApp reminders for upcoming appointments.
// Runs via Vercel Cron (configure in vercel.json). Sends:
//   - a 24-hour-before reminder
//   - a 1-hour-before reminder
// Each sent once (tracked by reminder_24h_sent / reminder_1h_sent).
//
// Secured by a CRON_SECRET so only Vercel Cron can trigger it.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null
function db() {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

export async function GET(req: Request) {
  // Verify this is called by Vercel Cron (or an authorized caller)
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results = { sent24h: 0, sent1h: 0, errors: 0 }

  try {
    // ── 24-hour reminders ──
    // Appointments between 23 and 25 hours away, not yet reminded
    const in23h = new Date(now.getTime() + 23 * 3600_000).toISOString()
    const in25h = new Date(now.getTime() + 25 * 3600_000).toISOString()

    const { data: appts24 } = await db()
      .from('agent_appointments')
      .select('*')
      .in('status', ['requested', 'confirmed'])
      .eq('reminder_24h_sent', false)
      .gte('appointment_at', in23h)
      .lte('appointment_at', in25h)

    for (const apt of appts24 ?? []) {
      const ok = await sendReminder(apt, '24h')
      if (ok) {
        await db()
          .from('agent_appointments')
          .update({ reminder_24h_sent: true })
          .eq('id', apt.id)
        results.sent24h++
      } else {
        results.errors++
      }
    }

    // ── 1-hour reminders ──
    const in30m = new Date(now.getTime() + 30 * 60_000).toISOString()
    const in90m = new Date(now.getTime() + 90 * 60_000).toISOString()

    const { data: appts1 } = await db()
      .from('agent_appointments')
      .select('*')
      .in('status', ['requested', 'confirmed'])
      .eq('reminder_1h_sent', false)
      .gte('appointment_at', in30m)
      .lte('appointment_at', in90m)

    for (const apt of appts1 ?? []) {
      const ok = await sendReminder(apt, '1h')
      if (ok) {
        await db()
          .from('agent_appointments')
          .update({ reminder_1h_sent: true })
          .eq('id', apt.id)
        results.sent1h++
      } else {
        results.errors++
      }
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (err) {
    console.error('[cron/reminders] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendReminder(apt: any, kind: '24h' | '1h'): Promise<boolean> {
  try {
    // Only send to real phone numbers (not website web_ placeholders)
    if (!apt.customer_phone || apt.customer_phone.startsWith('web_')) {
      return false
    }

    // Get the tenant's WhatsApp credentials
    const { data: waConfig } = await db()
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('user_id', apt.tenant_id)
      .maybeSingle()

    if (!waConfig?.phone_number_id || !waConfig?.access_token) return false

    const accessToken = decrypt(waConfig.access_token)
    const when = new Date(apt.appointment_at)
    const timeStr = when.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })

    const text =
      kind === '24h'
        ? `Hi ${apt.customer_name}! 😊 Reminder: you have a ${apt.service} appointment tomorrow at ${timeStr}. Reply here if you need to reschedule.`
        : `Hi ${apt.customer_name}! Your ${apt.service} appointment is in about an hour (${timeStr}). See you soon! 😊`

    // NOTE: free-form sends require the customer messaged within 24h.
    // For reminders outside that window, an approved template is needed.
    // This attempts a text send; if it fails, the clinic still sees the
    // appointment in their dashboard.
    await sendTextMessage({
      phoneNumberId: waConfig.phone_number_id,
      accessToken,
      to: apt.customer_phone,
      text,
    })

    return true
  } catch (err) {
    console.error('[cron/reminders] send failed:', err)
    return false
  }
}
