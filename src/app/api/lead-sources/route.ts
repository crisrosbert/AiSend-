// src/app/api/lead-sources/route.ts
//
// CRUD for `lead_sources` — the API keys a merchant generates from the
// dashboard so their website form, or a Google Ads lead webhook, can
// POST into /api/leads/ingest. Session-authenticated (dashboard-only);
// the generated key itself is what authenticates the external caller.

import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { currentBusinessId } from '@/lib/business/server'

// Per-user data behind a session cookie: never let a browser or CDN reuse it.
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('lead_sources')
    // Deliberately NOT selecting meta_page_access_token: the Page token
    // never needs to reach the browser.
    .select('id, name, source_type, api_key, public_key, allowed_domains, is_active, created_at, last_used_at, meta_page_id')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Call / WhatsApp button taps in the last 30 days, per source. Counted in
  // JS: the volume per tenant is small and this avoids a SQL function.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events } = await supabase
    .from('lead_events')
    .select('source_id, kind')
    .gte('created_at', since)
    .limit(10000)
  const counts = new Map<string, { call_click: number; whatsapp_click: number }>()
  for (const e of (events ?? []) as { source_id: string | null; kind: 'call_click' | 'whatsapp_click' }[]) {
    if (!e.source_id) continue
    const c = counts.get(e.source_id) ?? { call_click: 0, whatsapp_click: 0 }
    c[e.kind] += 1
    counts.set(e.source_id, c)
  }

  return NextResponse.json(
    {
      lead_sources: (data ?? []).map((s) => ({
        ...s,
        clicks_30d: counts.get(s.id) ?? { call_click: 0, whatsapp_click: 0 },
      })),
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const sourceType = typeof body?.source_type === 'string' ? body.source_type : 'website_form'

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const businessId = await currentBusinessId(supabase, user.id)

  // 32 random bytes of key material — plenty for a bearer secret that
  // is never guessed, only ever leaked, and revocation (deleting the
  // row) is the actual defense against that.
  const apiKey = `aisend_${crypto.randomBytes(24).toString('hex')}`
  // Public key for the browser script. Safe to expose: it can only create
  // leads for this tenant, and only from allowed_domains when set.
  const publicKey = `pk_${crypto.randomBytes(12).toString('hex')}`

  // "https://www.Clinic.com/contact" -> "clinic.com". Accept a list or a
  // comma-separated string; drop anything that is not a plausible host.
  const rawDomains: unknown[] = Array.isArray(body?.allowed_domains)
    ? body.allowed_domains
    : typeof body?.allowed_domains === 'string'
      ? body.allowed_domains.split(',')
      : []
  const allowedDomains = Array.from(
    new Set(
      rawDomains
        .map((d) =>
          String(d)
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .split(/[/?#:]/)[0],
        )
        .filter((d) => /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(d) && d.includes('.')),
    ),
  ).slice(0, 10)

  const { data, error } = await supabase
    .from('lead_sources')
    .insert({
      user_id: user.id,
      business_id: businessId,
      name,
      source_type: sourceType,
      api_key: apiKey,
      public_key: publicKey,
      allowed_domains: allowedDomains,
    })
    .select('id, name, source_type, api_key, public_key, allowed_domains, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead_source: data })
}
