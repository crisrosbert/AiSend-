// src/app/api/leads/capture/route.ts
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────
// /api/leads/ingest needs a SECRET key, so the form has to be sent from a
// server (WordPress webhook, Zapier, a backend). A plain HTML page has no
// server, and a PHP site needs a developer to write one. Asking a clinic
// owner to do that for each of five websites is not "easy setup".
//
// This is the browser-safe door. The script at /aisend.js posts here with
// a PUBLIC key (pk_...). A public key is fine to show in page source
// because it can only ever do one thing: create a lead for its own tenant,
// and only from the website domains the merchant listed.
//
// ── ABUSE LIMITS (a public endpoint will be probed) ──────────────────
//   • Origin must match the key's allowed_domains when any are set.
//   • Per-IP and per-key rate limits.
//   • A hidden honeypot field silently drops form-filling bots.
//   • Same ingestLead() as every other source, so duplicates collapse by
//     phone number instead of flooding the list.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ingestLead } from '@/lib/leads/ingest'
import { checkRateLimit } from '@/lib/rate-limit'

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

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

function str(v: unknown, max = 300): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

/** "https://www.Clinic.com/x" -> "clinic.com" */
function hostOf(urlOrHost: string | null): string | null {
  if (!urlOrHost) return null
  try {
    const h = new URL(urlOrHost.includes('://') ? urlOrHost : `https://${urlOrHost}`).hostname
    return h.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

function hostAllowed(host: string | null, allowed: string[]): boolean {
  if (allowed.length === 0) return true
  if (!host) return false
  return allowed.some((d) => host === d || host.endsWith(`.${d}`))
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin')
  const cors = corsHeaders(origin)
  const fail = (error: string, status: number) =>
    NextResponse.json({ ok: false, error }, { status, headers: cors })

  try {
    // text/plain on purpose: the script sends it that way so the browser
    // skips the CORS preflight and the lead still goes out when a page is
    // navigating away right after the form is submitted.
    const raw = await req.text()
    if (raw.length > 20_000) return fail('Payload too large', 413)
    let body: Record<string, unknown> | null = null
    try {
      body = JSON.parse(raw)
    } catch {
      body = null
    }
    if (!body || typeof body !== 'object') return fail('Expected a JSON body', 400)

    const key = str(body.key, 80) || new URL(req.url).searchParams.get('key')
    if (!key) return fail('Missing key', 401)

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    const perIp = checkRateLimit(`capture:ip:${ip}:${key}`, { limit: 20, windowMs: 60_000 })
    const perKey = checkRateLimit(`capture:key:${key}`, { limit: 300, windowMs: 60_000 })
    if (!perIp.success || !perKey.success) return fail('Too many requests', 429)

    const { data: source } = await db()
      .from('lead_sources')
      .select('id, user_id, business_id, source_type, is_active, allowed_domains')
      .eq('public_key', key)
      .maybeSingle()

    if (!source || !source.is_active) return fail('Invalid or inactive key', 401)

    // The browser sets Origin itself; a page cannot forge it, so this stops
    // a copied key being used from someone else's site.
    const allowed: string[] = Array.isArray(source.allowed_domains) ? source.allowed_domains : []
    const requestHost = hostOf(origin) || hostOf(req.headers.get('referer'))
    if (!hostAllowed(requestHost, allowed)) return fail('This domain is not allowed for this key', 403)

    // ── Clicks (Call now / WhatsApp button) ──
    // Not a lead yet — we don't know who tapped it. Record it with its
    // attribution so the WhatsApp message that follows can be linked back.
    if (body.type === 'click') {
      const kind = body.kind === 'call_click' || body.kind === 'whatsapp_click' ? body.kind : null
      if (!kind) return fail('Unknown click kind', 400)
      const token = str(body.token, 12)
      if (token && !/^[A-Z0-9]{6}$/.test(token)) return fail('Bad token', 400)
      const clickLimit = checkRateLimit(`capture:click:${ip}:${key}`, { limit: 60, windowMs: 60_000 })
      if (!clickLimit.success) return fail('Too many requests', 429)

      await db().from('lead_events').insert({
        tenant_id: source.user_id,
        source_id: source.id,
        visitor_id: str(body.visitor_id, 60),
        kind,
        target: str(body.target, 200),
        token,
        page_url: str(body.page_url, 500),
        attribution: {
          gclid: str(body.gclid, 300) || str(body.gbraid, 300) || str(body.wbraid, 300),
          fbclid: str(body.fbclid, 300),
          utm_source: str(body.utm_source, 200),
          utm_medium: str(body.utm_medium, 200),
          utm_campaign: str(body.utm_campaign, 200),
          referrer: str(body.referrer, 500),
          landing_page: str(body.landing_page, 500),
        },
      })
      return NextResponse.json({ ok: true }, { headers: cors })
    }

    // Bots fill every field, including the one humans cannot see.
    if (str(body.hp, 50)) return NextResponse.json({ ok: true }, { headers: cors })

    const phone = str(body.phone, 40)
    const email = str(body.email, 200)
    const phoneDigits = (phone ?? '').replace(/\D/g, '')
    if (phone && (phoneDigits.length < 7 || phoneDigits.length > 15)) {
      return fail('That does not look like a phone number', 400)
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail('That does not look like an email address', 400)
    }
    if (!phone && !email) return fail('A phone number or email is required', 400)

    const utmSource = str(body.utm_source, 200)
    const utmMedium = str(body.utm_medium, 200)
    const utmCampaign = str(body.utm_campaign, 200)
    const gclid = str(body.gclid, 300) || str(body.gbraid, 300) || str(body.wbraid, 300)

    // Paid Google traffic is tagged by Google itself (gclid) or by the
    // merchant's UTM convention. Everything else is a plain website lead.
    const isGoogleAds =
      !!gclid ||
      (/google/i.test(utmSource ?? '') && /cpc|ppc|paid/i.test(utmMedium ?? ''))

    const siteHost = hostOf(str(body.page_url, 500)) || requestHost
    const result = await ingestLead({
      tenantId: source.user_id,
      businessId: source.business_id,
      source: isGoogleAds ? 'google_ads' : source.source_type,
      name: str(body.name, 120),
      phone,
      email,
      campaign: str(body.campaign, 200) || utmCampaign,
      interest: str(body.interest, 300),
      utmSource,
      utmMedium,
      utmCampaign,
      gclid,
      lastMessage: str(body.message, 500),
      extra: {
        site: siteHost,
        page_url: str(body.page_url, 500),
        landing_page: str(body.landing_page, 500),
        referrer: str(body.referrer, 500),
        form: str(body.form, 120),
        fbclid: str(body.fbclid, 300),
        visitor_id: str(body.visitor_id, 60),
      },
    })

    if (!result) return fail('Could not save this lead', 400)

    db()
      .from('lead_sources')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', source.id)
      .then(() => {})

    return NextResponse.json({ ok: true, is_new: result.wasNewLead }, { headers: cors })
  } catch (err) {
    console.error('[leads/capture] error:', err)
    return fail('Something went wrong', 500)
  }
}
