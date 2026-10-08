// src/app/api/leads/ingest/route.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// The ONE door every external lead source POSTs through: a website
// contact form's webhook action, a Google Ads lead-form extension's
// webhook, Zapier/Make connecting a form builder, or a merchant's own
// script. Internal sources (the WhatsApp webhook's Click-to-WhatsApp
// capture) call src/lib/leads/ingest.ts directly in-process instead —
// this route exists for everything OUTSIDE this server.
//
// ── AUTH MODEL ───────────────────────────────────────────────────────
// No Supabase session exists here — the caller is a form on the
// merchant's own website or a third party's webhook dispatcher. Each
// integration gets one API key (a `lead_sources` row, created from the
// dashboard), sent as `x-api-key` or `?key=`. The key resolves to
// exactly one tenant — nothing in the request body can pick a
// different one.
//
// IMPORTANT for anyone wiring this up: configure the key as a
// SERVER-SIDE webhook action (WordPress/Elementor "Webhook" action,
// Google's Lead Form webhook, Zapier/Make), never embedded in a
// browser-side fetch() — a key visible in page source can be read by
// anyone and used to flood this tenant's lead list.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ingestLead } from '@/lib/leads/ingest'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null
function db() {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _db
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const apiKey = req.headers.get('x-api-key') || url.searchParams.get('key')

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key. Pass it as the x-api-key header or ?key= query param.' },
        { status: 401, headers: CORS },
      )
    }

    const { data: lead_source } = await db()
      .from('lead_sources')
      .select('id, user_id, business_id, source_type, is_active')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (!lead_source || !lead_source.is_active) {
      return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401, headers: CORS })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400, headers: CORS })
    }

    const result = await ingestLead({
      tenantId: lead_source.user_id,
      businessId: lead_source.business_id,
      // The caller can narrow the source (e.g. a form builder sending
      // several form types through one key), but defaults to the key's
      // own configured type — the common case of one key per form.
      source: str(body.source) || lead_source.source_type,
      name: str(body.name),
      firstName: str(body.first_name) || str(body.firstName),
      lastName: str(body.last_name) || str(body.lastName),
      phone: str(body.phone),
      email: str(body.email),
      companyName: str(body.company_name) || str(body.company),
      campaign: str(body.campaign),
      adset: str(body.adset),
      adId: str(body.ad_id) || str(body.ad),
      adHeadline: str(body.ad_headline),
      adName: str(body.ad_name),
      interest: str(body.interest) || str(body.procedure_interest) || str(body.product_interest),
      utmSource: str(body.utm_source),
      utmMedium: str(body.utm_medium),
      utmCampaign: str(body.utm_campaign),
      gclid: str(body.gclid),
      consent: typeof body.consent === 'boolean' ? body.consent : null,
      extra: typeof body.extra === 'object' && body.extra !== null ? body.extra : undefined,
    })

    if (!result) {
      return NextResponse.json(
        { error: 'Could not save this lead — a phone number or email is required.' },
        { status: 400, headers: CORS },
      )
    }

    // Fire-and-forget bookkeeping — never worth failing the request over.
    db()
      .from('lead_sources')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', lead_source.id)
      .then(() => {})

    return NextResponse.json(
      { ok: true, lead_id: result.leadId, is_new: result.wasNewLead },
      { headers: CORS },
    )
  } catch (err) {
    console.error('[leads/ingest] error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500, headers: CORS })
  }
}
