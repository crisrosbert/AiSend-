// POST /api/broadcasts/send — server-side start of a SCHEDULED broadcast.
//
// Called by /api/cron/broadcast-sweep (phase 1) with the cron secret when a
// scheduled broadcast's time has come. Until this route existed the sweep got
// a 404, put the broadcast back to 'scheduled' and tried again forever.
//
// It does NOT send messages. It works out who the audience is, queues one
// recipient row per contact (with the template params already resolved), and
// hands over to the same sender the dashboard uses (see prepareRecipients).

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { verifyCron } from '@/lib/cron/auth'
import { firstName, prepareRecipients, resolveAudience, type CampaignAudience } from '@/lib/campaign-agent/audience'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Mapping = { type: 'static' | 'field' | 'custom_field'; value: string }

export async function POST(request: Request) {
  const auth = verifyCron(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const broadcastId = typeof body?.broadcastId === 'string' ? body.broadcastId : ''
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  if (!broadcastId || !userId) return NextResponse.json({ error: 'broadcastId and userId are required' }, { status: 400 })

  const db = supabaseAdmin()
  const { data: bc } = await db.from('broadcasts').select('*').eq('id', broadcastId).eq('user_id', userId).maybeSingle()
  if (!bc) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })

  const audience = (body.audience ?? {}) as Record<string, unknown>
  const type = audience.type === 'tags' ? 'tags' : audience.type === 'all' ? 'all' : null
  if (!type) {
    await db.from('broadcasts').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', broadcastId)
    return NextResponse.json({ error: 'This audience type cannot be sent automatically. Send it from the dashboard.' }, { status: 422 })
  }

  try {
    const { contacts } = await resolveAudience(
      db,
      { userId, businessId: (bc as { business_id?: string | null }).business_id ?? null },
      audience as unknown as CampaignAudience,
    )
    if (contacts.length === 0) {
      await db.from('broadcasts').update({ status: 'failed', total_recipients: 0, updated_at: new Date().toISOString() }).eq('id', broadcastId)
      return NextResponse.json({ error: 'No contacts found for this audience.' }, { status: 422 })
    }

    // Template parameters, resolved once per contact now so everyone in the
    // campaign gets the message as it stood at send time.
    const variables = (body.variables ?? bc.template_variables ?? {}) as Record<string, Mapping>
    const keys = Object.keys(variables).sort((a, b) => Number(a) - Number(b))
    const full = new Map<string, Record<string, string | null>>()
    const needsFull = keys.some((k) => variables[k].type === 'field' && variables[k].value !== 'name' && variables[k].value !== 'phone')
    if (needsFull) {
      for (let i = 0; i < contacts.length; i += 200) {
        const { data } = await db.from('contacts').select('id, email, company').in('id', contacts.slice(i, i + 200).map((c) => c.id))
        for (const r of data ?? []) full.set(r.id, r)
      }
    }
    const custom = new Map<string, Map<string, string>>()
    if (keys.some((k) => variables[k].type === 'custom_field')) {
      for (let i = 0; i < contacts.length; i += 200) {
        const { data } = await db.from('contact_custom_values').select('contact_id, custom_field_id, value').in('contact_id', contacts.slice(i, i + 200).map((c) => c.id))
        for (const r of data ?? []) {
          const m = custom.get(r.contact_id) ?? new Map<string, string>()
          m.set(r.custom_field_id, r.value ?? '')
          custom.set(r.contact_id, m)
        }
      }
    }

    const queued = await prepareRecipients(db, broadcastId, contacts, (c) =>
      keys.map((k) => {
        const v = variables[k]
        if (v.type === 'static') return v.value
        if (v.type === 'field') {
          if (v.value === 'name') return firstName(c.name)
          if (v.value === 'phone') return c.phone
          return (full.get(c.id)?.[v.value] as string | null) ?? ''
        }
        return custom.get(c.id)?.get(v.value) ?? ''
      }),
    )
    return NextResponse.json({ ok: true, queued })
  } catch (err) {
    console.error('[broadcasts/send]', err)
    // Leave it as 'sending' with nothing queued? No: put it back so the sweep retries.
    await db.from('broadcasts').update({ status: 'scheduled', updated_at: new Date().toISOString() }).eq('id', broadcastId)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not start the broadcast' }, { status: 500 })
  }
}
