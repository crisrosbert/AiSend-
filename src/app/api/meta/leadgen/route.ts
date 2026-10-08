// src/app/api/meta/leadgen/route.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// Meta Lead Ads (a lead-generation form that opens INSIDE Facebook/
// Instagram, as opposed to a Click-to-WhatsApp ad which opens a WhatsApp
// chat) does not message this app at all. Instead Meta fires a
// `leadgen` webhook event carrying only a `leadgen_id` — the actual
// name/phone/email the person typed has to be fetched separately from
// the Graph API using a Page Access Token with `leads_retrieval`.
//
// ── SETUP, PLAINLY ───────────────────────────────────────────────────
// This permission sits behind Meta App Review, so until a merchant has
// it approved, this endpoint will receive nothing. That is not a bug —
// it's why /api/leads/ingest exists as the universal fallback: a
// merchant can connect their Meta Lead Form to this app TODAY through
// Zapier, Pabbly or Make (Meta Lead Ads is a native trigger in all
// three) pointed at /api/leads/ingest with their lead_sources API key,
// and switch to this native endpoint later without changing anything
// downstream — both paths converge on the same ingestLead() call.
//
// ── WIRING THIS UP, ONCE APP REVIEW IS APPROVED ─────────────────────
//   1. Facebook App dashboard → Webhooks → Page → subscribe to `leadgen`,
//      callback URL = this route, verify token = META_LEADGEN_VERIFY_TOKEN.
//   2. For each tenant's Page, create a `lead_sources` row with
//      source_type='meta_leadgen', meta_page_id = the Page's id, and
//      meta_page_access_token = a long-lived Page Access Token obtained
//      via Facebook Login for Business with the leads_retrieval scope.
//   3. Meta fires one POST per lead; this route resolves the page_id to
//      a tenant, fetches the lead's field_data from the Graph API, and
//      calls ingestLead().

import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
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

interface LeadgenChange {
  field: string
  value: {
    leadgen_id: string
    page_id: string
    form_id?: string
    ad_id?: string
    adgroup_id?: string
    campaign_id?: string
    created_time?: number
  }
}

interface LeadgenEntry {
  id: string // page id
  changes: LeadgenChange[]
}

// GET — one-time webhook verification, same challenge/response Meta
// uses for every webhook type. A single shared token (not per-tenant,
// unlike the WhatsApp webhook) because this subscription is made once,
// at the App level, by whoever owns the Meta App — not per merchant.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = searchParams.get('hub.verify_token')

  const expected = process.env.META_LEADGEN_VERIFY_TOKEN
  if (!expected) {
    console.error('[meta-leadgen] META_LEADGEN_VERIFY_TOKEN not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  if (mode === 'subscribe' && challenge && verifyToken === expected) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

/** field_data looks like [{ name: 'full_name', values: ['Amit Shah'] }, ...] */
function fieldValue(fieldData: Array<{ name: string; values: string[] }>, ...names: string[]): string | null {
  for (const name of names) {
    const match = fieldData.find((f) => f.name.toLowerCase() === name)
    if (match?.values?.[0]) return match.values[0]
  }
  return null
}

async function processLeadgenEvent(change: LeadgenChange) {
  const { leadgen_id, page_id, ad_id, form_id, campaign_id } = change.value

  const { data: source } = await db()
    .from('lead_sources')
    .select('user_id, business_id, meta_page_access_token')
    .eq('meta_page_id', page_id)
    .eq('source_type', 'meta_leadgen')
    .eq('is_active', true)
    .maybeSingle()

  if (!source?.meta_page_access_token) {
    // Not an error — most likely a page this app doesn't manage, or a
    // merchant who hasn't finished connecting their Page Access Token
    // yet. Meta will not retry based on our response either way.
    console.warn(`[meta-leadgen] no active lead_sources row for page ${page_id}`)
    return
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${leadgen_id}?access_token=${encodeURIComponent(source.meta_page_access_token)}`,
    )
    const json = await res.json()
    if (!res.ok || !json?.field_data) {
      console.error('[meta-leadgen] Graph API fetch failed:', JSON.stringify(json).slice(0, 300))
      return
    }

    const fieldData: Array<{ name: string; values: string[] }> = json.field_data

    await ingestLead({
      tenantId: source.user_id,
      businessId: source.business_id,
      source: 'meta_leadgen',
      name: fieldValue(fieldData, 'full_name', 'name'),
      firstName: fieldValue(fieldData, 'first_name'),
      lastName: fieldValue(fieldData, 'last_name'),
      phone: fieldValue(fieldData, 'phone_number', 'phone'),
      email: fieldValue(fieldData, 'email'),
      companyName: fieldValue(fieldData, 'company_name', 'company'),
      adId: ad_id ?? null,
      campaign: campaign_id ?? null,
      // Meta Lead Forms often carry a custom question like "Which
      // procedure are you interested in?" — surface it generically.
      interest: fieldValue(fieldData, 'interest', 'procedure_interest', 'product_interest'),
      extra: { leadgen_id, form_id, raw_fields: fieldData },
      consent: true, // submitting a native Meta Lead Form is itself the opt-in
    })
  } catch (err) {
    console.error('[meta-leadgen] processing failed:', err)
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn('[meta-leadgen] rejected — invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { entry?: LeadgenEntry[] }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Meta expects a fast 200 ack and retries on timeout — do the Graph
  // API round-trips after responding, same pattern as the WhatsApp
  // webhook uses for its own background work.
  after(async () => {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'leadgen') continue
        await processLeadgenEvent(change)
      }
    }
  })

  return NextResponse.json({ ok: true })
}
